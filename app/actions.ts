"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(v: unknown): string {
  if (typeof v !== "string" || !UUID.test(v)) throw new Error("Invalid id");
  return v;
}

// ---------- auth
export async function signIn(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await supabase.rpc("log_failed_sign_in", { p_email: email });
    return { error: "That email and password don't match. Please try again." };
  }
  const { data: profile } = await supabase.from("profiles").select("role, locale, active").eq("id", data.user.id).single();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { error: "This account is not active. Contact Real Care staff." };
  }
  await supabase.rpc("log_event", { p_action: "sign_in", p_table: "auth", p_record: data.user.id });
  const c = await cookies();
  c.set("rc_lang", profile.locale === "es" ? "es" : "en", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  // Return to the page that sent them to sign in (e.g. a QR code), but only within the portal.
  const next = String(formData.get("next") ?? "");
  if (profile.role === "provider" && /^\/forms\/start\/[0-9a-f-]{36}$/i.test(next)) redirect(next);
  redirect(profile.role === "provider" ? "/dashboard" : "/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setLang(lang: "en" | "es", path: string) {
  const c = await cookies();
  c.set("rc_lang", lang === "es" ? "es" : "en", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath(path.startsWith("/") ? path : "/");
}

// ---------- training
export async function completeLesson(lessonId: string, lang: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_lesson", { p_lesson: assertUuid(lessonId), p_lang: lang === "es" ? "es" : "en" });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, courseComplete: Boolean((data as { course_complete?: boolean })?.course_complete) };
}

export async function submitQuiz(lessonId: string, answers: number[], lang: string) {
  if (!Array.isArray(answers) || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 20)) return { error: "Invalid answers" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz", {
    p_lesson: assertUuid(lessonId),
    p_answers: answers,
    p_lang: lang === "es" ? "es" : "en",
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, result: data as QuizResult };
}
export type QuizResult = {
  score: number;
  passed: boolean;
  pass_percent: number;
  course_complete: boolean;
  results: { correct: boolean; correct_index: number; explanation: string }[];
};

// ---------- forms
export async function submitForm(assignmentId: string, data: Record<string, unknown>) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "Invalid form data" };
  if (JSON.stringify(data).length > 50000) return { error: "Form is too large" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_form", { p_assignment: assertUuid(assignmentId), p_data: data });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- messages
export async function sendMessage(providerId: string, body: string, path: string) {
  const text = String(body ?? "").trim();
  if (!text) return { error: "Message is empty" };
  if (text.length > 4000) return { error: "Message is too long" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase.from("messages").insert({ provider_id: assertUuid(providerId), sender_id: user.id, body: text });
  if (error) return { error: "Could not send. Please try again." };
  revalidatePath(path);
  return { ok: true };
}

// ---------- staff
export async function reviewSubmission(submissionId: string, action: "return" | "accept", flags: Record<string, string>, note: string) {
  if (action !== "return" && action !== "accept") return { error: "Invalid action" };
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(flags ?? {})) {
    if (/^[a-z0-9_]{1,64}$/.test(k)) clean[k] = String(v ?? "").slice(0, 500) || "Please review this field.";
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_submission", {
    p_submission: assertUuid(submissionId),
    p_action: action,
    p_flags: clean,
    p_note: note ? String(note).slice(0, 1000) : null,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function runRenewals(asOf: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return { error: "Pick a date" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_renewals", { p_as_of: asOf });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, count: data as number };
}

export async function renewProvider(providerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("renew_provider", { p_provider: assertUuid(providerId) });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------- Phase 1: provider
export async function reportVideo(lessonId: string, position: number, duration: number, lang: string) {
  if (!Number.isFinite(position) || !Number.isFinite(duration) || duration <= 0) return { error: "Invalid progress" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_video_progress", {
    p_lesson: assertUuid(lessonId), p_position: Math.max(0, position), p_duration: duration, p_lang: lang === "es" ? "es" : "en",
  });
  if (error) return { error: error.message };
  return { ok: true, result: data as { watched: number; duration: number; lesson_complete: boolean; course_complete: boolean } };
}

export async function demoCheckout(courseId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("demo_checkout", { p_course: courseId ? assertUuid(courseId) : null });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markNotificationsRead(ids: string[] | null) {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: ids ? ids.map(assertUuid) : null });
  revalidatePath("/", "layout");
}

export async function saveMyProfile(_prev: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const locale = formData.get("locale") === "es" ? "es" : "en";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_profile", {
    p_locale: locale,
    p_phone: String(formData.get("phone") ?? ""),
    p_email_notifications: formData.get("email_notifications") === "on",
  });
  if (error) return { error: error.message };
  const c = await cookies();
  c.set("rc_lang", locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function acceptInvite(_prev: { error?: string } | undefined, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!UUID.test(token)) return { error: "This invitation link is not valid." };
  if (password.length < 10) return { error: "Use at least 10 characters for your password." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { data: email, error } = await supabase.rpc("accept_invite", { p_token: token, p_password: password });
  if (error) return { error: error.message };
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: email as string, password });
  if (signInError) return { error: "Your account was created. Please sign in." };
  const { data: profile } = await supabase.from("profiles").select("locale").eq("email", email as string).single();
  const c = await cookies();
  c.set("rc_lang", profile?.locale === "es" ? "es" : "en", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard?welcome=1");
}

// ---------- Phase 2: self-started forms (QR codes) and public applications
export async function startForm(templateId: string, individualId: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_form", { p_template: assertUuid(templateId), p_individual: individualId ? assertUuid(individualId) : null });
  if (error) return { error: error.message };
  redirect(`/forms/${data}`);
}

export async function submitApplication(_prev: { ok?: boolean; error?: string } | undefined, fd: FormData) {
  const s = (k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);
  const full_name = s("full_name", 120);
  const email = s("email", 200).toLowerCase();
  const locale = s("locale") === "es" ? "es" : "en";
  const es = locale === "es";
  if (fd.get("website")) return { ok: true }; // honeypot: bots fill hidden fields
  if (full_name.length < 2) return { error: es ? "Escriba su nombre." : "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: es ? "Escriba un correo válido." : "Please enter a valid email." };
  const types = fd.getAll("types").map(String).filter((t) => ["host_home", "family_caregiver", "scc_dsp", "nmt"].includes(t));
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_application", {
    p_full_name: full_name, p_email: email, p_phone: s("phone", 40) || null, p_locale: locale, p_types: types,
    p_data: { city: s("city", 80), experience: s("experience", 1000) },
  });
  if (error) return { error: es ? "No pudimos enviar su solicitud. Intente más tarde." : "We couldn't send your application. Please try again later." };
  return { ok: true };
}
