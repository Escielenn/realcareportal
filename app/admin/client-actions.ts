"use server";

import { revalidatePath } from "next/cache";
import { getProfile, staffCan, clientFeaturesOn } from "@/lib/auth";

// Client records (people supported). Clients never sign in; staff keep the record and attach providers, staff and forms.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const s = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);
const date = (v: FormDataEntryValue | null) => { const x = s(v, 10); return DATE.test(x) ? x : null; };
const pick = <T extends string>(v: FormDataEntryValue | null, allowed: readonly T[], fallback: T) => (allowed.includes(String(v) as T) ? (String(v) as T) : fallback);
type R = { ok?: boolean; error?: string; message?: string; id?: string };

// Server-side gate for every action (RLS and the database functions check again): signed-in, active staff, client features on.
async function staffClient() {
  const { supabase, profile } = await getProfile();
  if (!profile || !profile.active || !staffCan(profile, "reviewer")) return { supabase, denied: "Staff only." };
  if (!(await clientFeaturesOn(supabase))) return { supabase, denied: "Client records are turned off." };
  return { supabase, denied: null as string | null };
}

const STATUSES = ["prospective", "active", "on_hold", "discharged"] as const;
const RELATIONSHIPS = ["primary", "respite", "temporary", "prospective"] as const;
const STAFF_ROLES = ["coordinator", "nurse", "supervisor", "other"] as const;

export async function saveClient(_p: R | undefined, fd: FormData): Promise<R> {
  const id = uuid(fd.get("id"));
  const full_name = s(fd.get("full_name"), 120);
  if (full_name.length < 2) return { error: "Enter the client's name." };
  const row = {
    full_name,
    preferred_name: s(fd.get("preferred_name"), 80) || null,
    client_number: s(fd.get("client_number"), 40) || null,
    date_of_birth: date(fd.get("date_of_birth")),
    status: pick(fd.get("status"), STATUSES, "active"),
    program: s(fd.get("program"), 60) || null,
    county: s(fd.get("county"), 60) || null,
    residence_type: s(fd.get("residence_type"), 60) || null,
    primary_language: pick(fd.get("primary_language"), ["en", "es", "other"] as const, "en"),
    service_start: date(fd.get("service_start")),
    service_end: date(fd.get("service_end")),
    case_management_agency: s(fd.get("case_management_agency"), 120) || null,
    case_manager_name: s(fd.get("case_manager_name"), 120) || null,
    case_manager_phone: s(fd.get("case_manager_phone"), 40) || null,
    case_manager_email: s(fd.get("case_manager_email"), 200) || null,
    goals: s(fd.get("goals"), 4000).split("\n").map((g) => g.trim()).filter(Boolean).slice(0, 12),
    notes: s(fd.get("notes"), 2000),
  };
  const { supabase, denied } = await staffClient();
  if (denied) return { error: denied };
  const { data, error } = id
    ? await supabase.from("individuals").update(row).eq("id", id).select("id").single()
    : await supabase.from("individuals").insert(row).select("id").single();
  if (error) return { error: error.code === "23505" ? "That client number is already used." : error.message };
  revalidatePath("/admin/individuals", "layout");
  return { ok: true, id: data.id, message: "Saved." };
}

export async function linkClientProvider(_p: R | undefined, fd: FormData): Promise<R> {
  const individual_id = uuid(fd.get("individual_id"));
  const provider_id = uuid(fd.get("provider_id"));
  const starts_on = date(fd.get("starts_on"));
  if (!individual_id || !provider_id || !starts_on) return { error: "Choose a provider and a start date." };
  const { supabase, denied } = await staffClient();
  if (denied) return { error: denied };
  const { error } = await supabase.from("provider_individuals").upsert({
    individual_id, provider_id, starts_on, ends_on: date(fd.get("ends_on")),
    relationship: pick(fd.get("relationship"), RELATIONSHIPS, "primary"), note: s(fd.get("note"), 500) || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Provider linked." };
}

export async function assignClientStaff(_p: R | undefined, fd: FormData): Promise<R> {
  const individual_id = uuid(fd.get("individual_id"));
  const staff_id = uuid(fd.get("staff_id"));
  if (!individual_id || !staff_id) return { error: "Choose a staff member." };
  const { supabase, denied } = await staffClient();
  if (denied) return { error: denied };
  const { error } = await supabase.from("individual_staff").upsert({
    individual_id, staff_id, role: pick(fd.get("role"), STAFF_ROLES, "coordinator"), starts_on: date(fd.get("starts_on")) ?? new Date().toISOString().slice(0, 10), ends_on: null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/individuals", "layout");
  return { ok: true, message: "Staff assigned." };
}

export async function endClientStaff(individualId: string, staffId: string, role: string): Promise<R> {
  if (!uuid(individualId) || !uuid(staffId) || !(STAFF_ROLES as readonly string[]).includes(role)) return { error: "Invalid" };
  const { supabase, denied } = await staffClient();
  if (denied) return { error: denied };
  const { error } = await supabase.from("individual_staff").update({ ends_on: new Date().toISOString().slice(0, 10) })
    .eq("individual_id", individualId).eq("staff_id", staffId).eq("role", role);
  if (error) return { error: error.message };
  revalidatePath("/admin/individuals", "layout");
  return { ok: true };
}

// Assign a form for this client to one or more of the client's current providers.
export async function assignClientForm(_p: R | undefined, fd: FormData): Promise<R> {
  const individual = uuid(fd.get("individual"));
  const template = uuid(fd.get("template"));
  const providers = fd.getAll("providers").map((v) => uuid(v)).filter((v): v is string => !!v);
  const due = date(fd.get("due"));
  const frequency = pick(fd.get("frequency"), ["once", "daily", "weekly", "monthly", "quarterly"] as const, "once");
  if (!individual || !template || !due) return { error: "Choose a form and a due date." };
  if (providers.length === 0) return { error: "Choose at least one provider." };
  const { supabase, denied } = await staffClient();
  if (denied) return { error: denied };
  const { data, error } = await supabase.rpc("assign_form", { p_template: template, p_providers: providers, p_individual: individual, p_due: due, p_frequency: frequency === "once" ? null : frequency });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Assigned to ${data} provider(s)${frequency === "once" ? "" : `, repeating ${frequency}`}.` };
}
