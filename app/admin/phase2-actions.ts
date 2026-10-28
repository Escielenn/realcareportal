"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
type R = { ok?: boolean; error?: string; message?: string; id?: string };
const s = (v: FormDataEntryValue | null, max = 2000) => String(v ?? "").trim().slice(0, max);
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);

// ---------- people supported (fictional in the demo; real PHI only after the HIPAA review)
export async function saveIndividual(_p: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const id = uuid(fd.get("id"));
  const full_name = s(fd.get("full_name"), 120);
  if (full_name.length < 2) return { error: "Enter a name." };
  const dob = s(fd.get("date_of_birth"), 10);
  const goals = s(fd.get("goals"), 4000).split("\n").map((g) => g.trim()).filter(Boolean).slice(0, 12);
  const row = { full_name, date_of_birth: DATE.test(dob) ? dob : null, goals, notes: s(fd.get("notes"), 2000), active: fd.has("active_flag") ? fd.get("active") === "on" : true };
  const { data, error } = id
    ? await supabase.from("individuals").update(row).eq("id", id).select("id").single()
    : await supabase.from("individuals").insert(row).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/individuals", "layout");
  return { ok: true, id: data.id, message: "Saved." };
}

export async function linkProvider(_p: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const individual_id = uuid(fd.get("individual_id"));
  const provider_id = uuid(fd.get("provider_id"));
  const starts_on = s(fd.get("starts_on"), 10);
  if (!individual_id || !provider_id || !DATE.test(starts_on)) return { error: "Choose a provider and a start date." };
  const { error } = await supabase.from("provider_individuals").upsert({ individual_id, provider_id, starts_on, ends_on: null });
  if (error) return { error: error.message };
  revalidatePath("/admin/individuals", "layout");
  return { ok: true, message: "Linked. The provider can see this person's forms from today." };
}

export async function endLink(individualId: string, providerId: string, endsOn: string): Promise<R> {
  if (!uuid(individualId) || !uuid(providerId) || !DATE.test(endsOn)) return { error: "Pick an end date." };
  const supabase = await createClient();
  const { error } = await supabase.from("provider_individuals").update({ ends_on: endsOn }).eq("individual_id", individualId).eq("provider_id", providerId);
  if (error) return { error: error.message };
  revalidatePath("/admin/individuals", "layout");
  return { ok: true };
}

// ---------- forms
export async function assignForm(_p: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const template = uuid(fd.get("template"));
  const providers = fd.getAll("providers").map(uuid).filter(Boolean) as string[];
  const individual = uuid(fd.get("individual"));
  const due = s(fd.get("due"), 10);
  const frequency = s(fd.get("frequency"), 20) || "once";
  if (!template) return { error: "Choose a form." };
  if (providers.length === 0) return { error: "Choose at least one provider." };
  if (!DATE.test(due)) return { error: "Pick a due date." };
  if (!["once", "daily", "weekly", "monthly", "quarterly"].includes(frequency)) return { error: "Choose how often." };
  const { data, error } = await supabase.rpc("assign_form", { p_template: template, p_providers: providers, p_individual: individual, p_due: due, p_frequency: frequency });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Assigned to ${data} provider(s)${frequency !== "once" ? `, repeating ${frequency}` : ""}. Each got a notification.` };
}

export async function publishVersion(templateId: string, schemaText: string, note: string): Promise<R> {
  if (!uuid(templateId)) return { error: "Invalid form" };
  let schema: unknown;
  try { schema = JSON.parse(schemaText); } catch (e) { return { error: "The JSON has a mistake: " + (e as Error).message }; }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_form_version", { p_template: templateId, p_schema: schema, p_note: note.slice(0, 300) || null });
  if (error) return { error: error.message };
  revalidatePath("/admin/forms", "layout");
  return { ok: true, message: `Published version ${data}. Forms already started keep the version they began with.` };
}

export async function createTemplate(_p: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const title_en = s(fd.get("title_en"), 120);
  if (title_en.length < 3) return { error: "Give the form a name." };
  const schema = {
    instructions_en: [{ title: "How to fill this out", steps: ["Answer each question.", "Sign and submit."] }],
    instructions_es: [{ title: "Cómo llenar este formulario", steps: ["Conteste cada pregunta.", "Firme y envíe."] }],
    sections: [{ title_en: "Details", title_es: "Detalles", fields: [
      { id: "date", type: "date", label_en: "Date", label_es: "Fecha", required: true },
      { id: "notes", type: "textarea", label_en: "Notes", label_es: "Notas", required: true },
      { id: "signature", type: "signature", label_en: "Signature", label_es: "Firma", required: true },
    ] }],
  };
  const { data, error } = await supabase.rpc("create_form_template", {
    p_title_en: title_en, p_title_es: s(fd.get("title_es"), 120) || title_en, p_category: s(fd.get("category"), 40) || "general",
    p_per_individual: fd.get("per_individual") === "on", p_self_start: fd.get("self_start") === "on", p_schema: schema,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/forms", "layout");
  return { ok: true, id: data as string };
}

export async function setTemplateFlags(templateId: string, flags: { active?: boolean; self_start?: boolean }): Promise<R> {
  if (!uuid(templateId)) return { error: "Invalid form" };
  const supabase = await createClient();
  const { error } = await supabase.from("form_templates").update(flags).eq("id", templateId);
  if (error) return { error: error.message };
  revalidatePath("/admin/forms", "layout");
  return { ok: true };
}

export async function stopRecurring(id: string): Promise<R> {
  if (!uuid(id)) return { error: "Invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_assignments").update({ active: false }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/forms", "layout");
  return { ok: true };
}

// ---------- applications
export async function inviteApplicant(applicationId: string): Promise<R & { link?: string }> {
  if (!uuid(applicationId)) return { error: "Invalid" };
  const supabase = await createClient();
  const { data: a, error: e1 } = await supabase.from("applications").select("*").eq("id", applicationId).single();
  if (e1 || !a) return { error: "Application not found" };
  const { data: { user } } = await supabase.auth.getUser();
  const { data: inv, error } = await supabase.from("invites").insert({ email: a.email, full_name: a.full_name, provider_types: a.provider_types, locale: a.locale, created_by: user?.id }).select("id, token").single();
  if (error) return { error: error.message };
  await supabase.from("applications").update({ status: "invited", invite_id: inv.id }).eq("id", applicationId);
  revalidatePath("/admin/applications", "layout");
  return { ok: true, link: `/join/${inv.token}` };
}

export async function declineApplicant(applicationId: string): Promise<R> {
  if (!uuid(applicationId)) return { error: "Invalid" };
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ status: "declined" }).eq("id", applicationId);
  if (error) return { error: error.message };
  revalidatePath("/admin/applications", "layout");
  return { ok: true };
}

export async function markStaffNotificationsRead(): Promise<R> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in" };
  const { data } = await supabase.from("notifications").select("id").eq("profile_id", user.id).is("read_at", null);
  if (data?.length) await supabase.rpc("mark_notifications_read", { p_ids: data.map((d) => d.id) });
  revalidatePath("/admin", "layout");
  return { ok: true };
}
