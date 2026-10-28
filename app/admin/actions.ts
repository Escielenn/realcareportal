"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function id(v: unknown): string {
  if (typeof v !== "string" || !UUID.test(v)) throw new Error("Invalid id");
  return v;
}
function ids(v: unknown): string[] {
  if (!Array.isArray(v) || v.length === 0 || v.length > 500) throw new Error("Select at least one provider");
  return v.map(id);
}
const str = (v: FormDataEntryValue | null, max = 5000) => String(v ?? "").trim().slice(0, max);
type R = { ok?: boolean; error?: string; count?: number; message?: string };
const done = (path = "/admin") => revalidatePath(path, "layout");

// ---------- bulk training actions
export async function bulkAction(action: "open" | "remind" | "extend", providerIds: string[], due?: string): Promise<R> {
  const supabase = await createClient();
  const p = ids(providerIds);
  if (action === "open") {
    const { data, error } = await supabase.rpc("open_cycles", { p_providers: p });
    if (error) return { error: error.message };
    done(); return { ok: true, message: `Opened a new training cycle for ${data} provider(s). History kept.` };
  }
  if (action === "remind") {
    const { data, error } = await supabase.rpc("send_reminders_now", { p_providers: p });
    if (error) return { error: error.message };
    done(); return { ok: true, message: `Sent ${data} reminder(s). See Outbox for the emails.` };
  }
  if (!due || !DATE.test(due)) return { error: "Pick a new due date" };
  const { data, error } = await supabase.rpc("extend_due", { p_providers: p, p_due: due });
  if (error) return { error: error.message };
  done(); return { ok: true, message: `Moved the due date for ${data} provider(s).` };
}

export async function markComplete(_prev: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const date = str(fd.get("date"));
  if (!DATE.test(date)) return { error: "Pick the date it was completed" };
  const { error } = await supabase.rpc("staff_mark_complete", {
    p_provider: id(fd.get("provider")), p_course: id(fd.get("course")), p_date: date, p_note: str(fd.get("note"), 500),
  });
  if (error) return { error: error.message };
  done(); return { ok: true, message: "Marked complete. The reason is saved with the record." };
}

// ---------- access and payments
export async function grantAccess(_prev: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const course = str(fd.get("course"));
  const days = Number(fd.get("days") || 365);
  const { error } = await supabase.rpc("grant_access", {
    p_provider: id(fd.get("provider")), p_course: course ? id(course) : null, p_days: Number.isFinite(days) ? days : 365, p_note: str(fd.get("note"), 500),
  });
  if (error) return { error: error.message };
  done(); return { ok: true, message: "Access granted and the provider was notified." };
}

export async function refundOrder(orderId: string): Promise<R> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("refund_order", { p_order: id(orderId) });
  if (error) return { error: error.message };
  done(); return { ok: true };
}

// ---------- requirements matrix
export async function toggleRequirement(providerType: string, courseId: string, on: boolean): Promise<R> {
  if (!["host_home", "family_caregiver", "scc_dsp", "nmt"].includes(providerType)) return { error: "Unknown provider type" };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("requirements").insert({ provider_type: providerType, course_id: id(courseId) })
    : await supabase.from("requirements").delete().eq("provider_type", providerType).eq("course_id", id(courseId));
  if (error) return { error: error.message };
  done(); return { ok: true };
}

// ---------- invites
export async function createInvite(_prev: (R & { link?: string }) | undefined, fd: FormData): Promise<R & { link?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const email = str(fd.get("email"), 200).toLowerCase();
  const name = str(fd.get("full_name"), 200);
  const types = fd.getAll("types").map(String).filter((t) => ["host_home", "family_caregiver", "scc_dsp", "nmt"].includes(t));
  if (!name) return { error: "Enter the provider's name" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email" };
  if (types.length === 0) return { error: "Pick at least one provider type" };
  const { data, error } = await supabase
    .from("invites")
    .insert({ email, full_name: name, provider_types: types, locale: fd.get("locale") === "es" ? "es" : "en", created_by: user?.id })
    .select("token")
    .single();
  if (error) return { error: error.message };
  done("/admin/invites");
  return { ok: true, link: `/join/${data.token}`, message: `Invitation created for ${name}.` };
}

export async function deleteInvite(inviteId: string): Promise<R> {
  const supabase = await createClient();
  const { error } = await supabase.from("invites").delete().eq("id", id(inviteId));
  if (error) return { error: error.message };
  done("/admin/invites"); return { ok: true };
}

// ---------- legacy import
export async function stageImport(courseId: string, filename: string, rows: { name: string; email: string; completed: string }[]): Promise<R & { batch?: string }> {
  if (!Array.isArray(rows) || rows.length === 0) return { error: "No rows found in the file" };
  if (rows.length > 5000) return { error: "Too many rows (5,000 max per file)" };
  const clean = rows.map((r) => ({ name: String(r.name ?? "").slice(0, 200), email: String(r.email ?? "").slice(0, 200), completed: String(r.completed ?? "").slice(0, 20) }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("stage_import", { p_course: id(courseId), p_filename: String(filename).slice(0, 200), p_rows: clean });
  if (error) return { error: error.message };
  return { ok: true, batch: data as string };
}

export async function setImportMatch(rowId: number, providerId: string | null): Promise<R> {
  if (!Number.isInteger(rowId)) return { error: "Invalid row" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_import_match", { p_row: rowId, p_provider: providerId ? id(providerId) : null });
  if (error) return { error: error.message };
  done("/admin/import"); return { ok: true };
}

export async function commitImport(batchId: string): Promise<R> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_import", { p_batch: id(batchId) });
  if (error) return { error: error.message };
  done(); return { ok: true, message: `Imported ${data} completion(s).` };
}

// ---------- course builder
export async function createCourse(fd: FormData) {
  const supabase = await createClient();
  const title = str(fd.get("title_en"), 200) || "New course";
  const slug = (title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "course") + "-" + Math.random().toString(36).slice(2, 6);
  const { data: last } = await supabase.from("courses").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("courses")
    .insert({ slug, title_en: title, title_es: str(fd.get("title_es"), 200) || title, published: false, sort: (last?.sort ?? 0) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/admin/courses/${data.id}`);
}

export async function saveCourse(_prev: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const price = Math.round(Number(fd.get("price") || 0) * 100);
  const days = Number(fd.get("access_days") || 365);
  const { error } = await supabase.from("courses").update({
    title_en: str(fd.get("title_en"), 200), title_es: str(fd.get("title_es"), 200),
    description_en: str(fd.get("description_en"), 1000), description_es: str(fd.get("description_es"), 1000),
    price_cents: Number.isFinite(price) && price >= 0 ? price : 0,
    access_days: Number.isFinite(days) && days > 0 ? days : 365,
    in_all_access: fd.get("in_all_access") === "on", is_specialty: fd.get("is_specialty") === "on", published: fd.get("published") === "on",
  }).eq("id", id(fd.get("id")));
  if (error) return { error: error.message };
  done(); return { ok: true, message: "Saved" };
}

export async function addLesson(courseId: string, kind: "reading" | "video" | "quiz") {
  if (!["reading", "video", "quiz"].includes(kind)) throw new Error("Invalid kind");
  const supabase = await createClient();
  const { data: last } = await supabase.from("lessons").select("sort").eq("course_id", id(courseId)).order("sort", { ascending: false }).limit(1).maybeSingle();
  const label = { reading: ["New reading", "Lectura nueva"], video: ["New video", "Video nuevo"], quiz: ["Quiz", "Prueba"] }[kind];
  const { data, error } = await supabase.from("lessons").insert({ course_id: courseId, kind, sort: (last?.sort ?? -1) + 1, title_en: label[0], title_es: label[1] }).select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/admin/courses/${courseId}/lessons/${data.id}`);
}

export async function moveLesson(courseId: string, lessonId: string, dir: -1 | 1): Promise<R> {
  const supabase = await createClient();
  const { data: lessons } = await supabase.from("lessons").select("id, sort").eq("course_id", id(courseId)).order("sort");
  const list = lessons ?? [];
  const i = list.findIndex((l) => l.id === lessonId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) await supabase.from("lessons").update({ sort: k }).eq("id", list[k].id);
  done(); return { ok: true };
}

export async function deleteLesson(courseId: string, lessonId: string): Promise<R> {
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id(lessonId)).eq("course_id", id(courseId));
  if (error) return { error: error.message };
  done(); return { ok: true };
}

export async function saveLesson(_prev: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    title_en: str(fd.get("title_en"), 200), title_es: str(fd.get("title_es"), 200),
    body_en: str(fd.get("body_en"), 20000), body_es: str(fd.get("body_es"), 20000),
  };
  if (fd.has("pass_percent")) patch.pass_percent = Math.min(100, Math.max(0, Number(fd.get("pass_percent")) || 80));
  const { error } = await supabase.from("lessons").update(patch).eq("id", id(fd.get("id")));
  if (error) return { error: error.message };
  done(); return { ok: true, message: "Saved" };
}

export async function setLessonVideo(lessonId: string, path: string, seconds: number): Promise<R> {
  if (!/^lessons\/[0-9a-f-]{36}\/[\w.\-]{1,120}$/i.test(path)) return { error: "Invalid file path" };
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update({ video_url: path, video_seconds: Math.round(seconds) || null }).eq("id", id(lessonId));
  if (error) return { error: error.message };
  done(); return { ok: true };
}

type Q = { prompt_en: string; prompt_es: string; options_en: string[]; options_es: string[]; correct: number; explanation_en: string; explanation_es: string };
export async function saveQuiz(lessonId: string, questions: Q[]): Promise<R> {
  if (!Array.isArray(questions) || questions.length > 50) return { error: "Invalid quiz" };
  for (const [i, q] of questions.entries()) {
    if (!q.prompt_en?.trim()) return { error: `Question ${i + 1} needs English text` };
    if (q.options_en.length < 2) return { error: `Question ${i + 1} needs at least two answers` };
    if (q.options_en.some((o) => !o.trim())) return { error: `Question ${i + 1} has an empty answer. Fill it in or remove it.` };
    if (q.correct < 1 || q.correct > q.options_en.length) return { error: `Pick the correct answer for question ${i + 1}` };
  }
  const supabase = await createClient();
  const lid = id(lessonId);
  const { error: delErr } = await supabase.from("quiz_questions").delete().eq("lesson_id", lid);
  if (delErr) return { error: delErr.message };
  if (questions.length) {
    const { error } = await supabase.from("quiz_questions").insert(
      questions.map((q, i) => ({
        lesson_id: lid, sort: i,
        prompt_en: q.prompt_en.slice(0, 1000), prompt_es: (q.prompt_es || q.prompt_en).slice(0, 1000),
        options_en: q.options_en.map((o) => o.slice(0, 300)),
        options_es: q.options_en.map((o, k) => (q.options_es[k] || o).slice(0, 300)),
        correct: q.correct,
        explanation_en: (q.explanation_en ?? "").slice(0, 1000), explanation_es: (q.explanation_es || q.explanation_en || "").slice(0, 1000),
      })),
    );
    if (error) return { error: error.message };
  }
  done(); return { ok: true, message: `Saved ${questions.length} question(s)` };
}
