"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Phase 1 operations: providers without logins, roster import, course assignment/exemption, staff levels,
// acknowledgment lessons. Every rule is enforced again in the database (staff_can, RLS); these only validate input.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = ["host_home", "family_caregiver", "scc_dsp", "nmt"];
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const str = (v: FormDataEntryValue | null | undefined, max = 200) => String(v ?? "").trim().slice(0, max);
const date = (v: unknown) => (typeof v === "string" && DATE.test(v) ? v : null);
type R = { ok?: boolean; error?: string; message?: string; link?: string; results?: { row: number; ok: boolean; error?: string }[] };

// ---------- 1. add one provider (no login yet)
export async function addProvider(_p: R | undefined, fd: FormData): Promise<R> {
  const types = fd.getAll("types").map(String).filter((t) => TYPES.includes(t));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_add_provider", {
    p_full_name: str(fd.get("full_name"), 120), p_email: str(fd.get("email"), 200), p_phone: str(fd.get("phone"), 40),
    p_types: types, p_hire_date: date(fd.get("hire_date")), p_cycle_start: date(fd.get("cycle_start")),
    p_locale: fd.get("locale") === "es" ? "es" : "en",
  });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  redirect(`/admin/providers/${data}?added=1`);
}

// ---------- 1. roster upload (rows parsed and checked on the screen first)
type Row = { full_name: string; email: string; phone?: string; provider_types: string[]; hire_date?: string; cycle_start?: string; locale?: string };
export async function importProviders(rows: Row[]): Promise<R> {
  if (!Array.isArray(rows) || rows.length === 0) return { error: "No rows to import." };
  if (rows.length > 2000) return { error: "Upload up to 2,000 rows at a time." };
  const clean = rows.map((r) => ({
    full_name: String(r.full_name ?? "").trim().slice(0, 120),
    email: String(r.email ?? "").trim().slice(0, 200),
    phone: String(r.phone ?? "").trim().slice(0, 40),
    provider_types: (Array.isArray(r.provider_types) ? r.provider_types : []).map(String).filter((t) => TYPES.includes(t)),
    hire_date: date(r.hire_date) ?? "",
    cycle_start: date(r.cycle_start) ?? "",
    locale: r.locale === "es" ? "es" : "en",
  }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_import_providers", { p_rows: clean });
  if (error) return { error: error.message };
  const results = (data ?? []) as { row: number; ok: boolean; error?: string }[];
  revalidatePath("/admin", "layout");
  const added = results.filter((r) => r.ok).length;
  return { ok: true, results, message: `${added} of ${results.length} providers added.` };
}

// ---------- 1. send a login later
export async function inviteProvider(providerId: string): Promise<R> {
  const id = uuid(providerId);
  if (!id) return { error: "Invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_invite_provider", { p_provider: id });
  if (error) return { error: error.message };
  revalidatePath(`/admin/providers/${id}`);
  return { ok: true, link: `/join/${data}` };
}

// ---------- 1. admins turn logins on for many providers at once (only those without a login)
export async function inviteProviders(providerIds: string[]): Promise<R> {
  const ids = (providerIds ?? []).map(uuid).filter((x): x is string => !!x).slice(0, 2000);
  if (ids.length === 0) return { error: "Choose providers." };
  const supabase = await createClient();
  const { data: rows } = await supabase.from("profiles").select("id").in("id", ids).eq("role", "provider").eq("login_enabled", false).eq("active", true);
  let made = 0;
  for (const r of rows ?? []) {
    const { error } = await supabase.rpc("staff_invite_provider", { p_provider: r.id });
    if (error) return { error: error.message, message: `${made} invite(s) made before the error.` };
    made++;
  }
  revalidatePath("/admin", "layout");
  const skipped = ids.length - made;
  return { ok: true, message: `${made} login invite(s) ready under Invite providers${skipped ? `; ${skipped} skipped (already have a login)` : ""}.` };
}

// ---------- 1. edit a provider's details (email stays fixed; it is their sign-in)
export async function updateProvider(_p: R | undefined, fd: FormData): Promise<R> {
  const id = uuid(fd.get("id"));
  if (!id) return { error: "Invalid" };
  const types = fd.getAll("types").map(String).filter((t) => TYPES.includes(t));
  if (types.length === 0) return { error: "Choose at least one provider type." };
  const name = str(fd.get("full_name"), 120);
  if (name.length < 2) return { error: "Add the provider's full name." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    full_name: name, phone: str(fd.get("phone"), 40) || null, provider_types: types,
    hire_date: date(fd.get("hire_date")), locale: fd.get("locale") === "es" ? "es" : "en",
  }).eq("id", id).eq("role", "provider");
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved." };
}

// ---------- 2. assign, exempt or clear a course for one or many providers
export async function setCourseOverrides(providerIds: string[], courseId: string, mode: "assigned" | "exempt" | "clear", frequency: "once" | "annual", note: string): Promise<R> {
  const ids = (providerIds ?? []).map(uuid).filter((x): x is string => !!x);
  const course = uuid(courseId);
  if (!course || ids.length === 0) return { error: "Choose providers and a course." };
  if (!["assigned", "exempt", "clear"].includes(mode)) return { error: "Unknown choice" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_course_overrides", {
    p_providers: ids, p_course: course, p_mode: mode, p_frequency: frequency === "annual" ? "annual" : "once", p_note: String(note ?? "").slice(0, 500),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  const verb = mode === "assigned" ? "Assigned to" : mode === "exempt" ? "Exempted" : "Cleared for";
  return { ok: true, message: `${verb} ${data} provider(s).` };
}

// ---------- 3. lesson attachment (a page of the notice: PDF or image) and acknowledgment
export async function setLessonAttachment(lessonId: string, path: string | null): Promise<R> {
  const id = uuid(lessonId);
  if (!id) return { error: "Invalid" };
  const supabase = await createClient();
  const { data: lesson } = await supabase.from("lessons").select("course_id").eq("id", id).single();
  if (!lesson) return { error: "Lesson not found" };
  if (path !== null) {
    const prefix = `courses/${lesson.course_id}/lessons/${id}/`;
    if (!path.startsWith(prefix) || !/^[\w.\-]{1,120}$/.test(path.slice(prefix.length))) return { error: "Invalid file path" };
  }
  const { error } = await supabase.from("lessons").update({ attachment_path: path }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/courses", "layout");
  return { ok: true };
}

export async function saveAcknowledgment(_p: R | undefined, fd: FormData): Promise<R> {
  const id = uuid(fd.get("lesson"));
  if (!id) return { error: "Invalid" };
  const en = str(fd.get("ack_en"), 600);
  if (en.length < 5) return { error: "Write the statement providers agree to." };
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update({ ack_statement_en: en, ack_statement_es: str(fd.get("ack_es"), 600) || null }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/courses", "layout");
  return { ok: true, message: "Saved." };
}

export async function acknowledgeLesson(lessonId: string, typedName: string, lang: "en" | "es"): Promise<R & { courseComplete?: boolean }> {
  const id = uuid(lessonId);
  if (!id) return { error: "Invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("acknowledge_lesson", { p_lesson: id, p_typed_name: String(typedName ?? "").slice(0, 120), p_lang: lang === "es" ? "es" : "en" });
  if (error) return { error: error.message };
  revalidatePath("/training", "layout");
  return { ok: true, courseComplete: !!(data as { course_complete?: boolean } | null)?.course_complete };
}

// ---------- 5. staff permission levels
export async function setStaffLevel(profileId: string, level: string): Promise<R> {
  const id = uuid(profileId);
  if (!id || !["reviewer", "training_admin", "super_admin"].includes(level)) return { error: "Invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_level", { p_profile: id, p_level: level });
  if (error) return { error: error.message };
  revalidatePath("/admin/staff");
  return { ok: true, message: "Saved." };
}
