"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const str = (v: FormDataEntryValue | null, max = 2000) => String(v ?? "").trim().slice(0, max);
type R = { ok?: boolean; error?: string; message?: string; link?: string; savedAt?: string };

// ---------- messages
export async function markThreadRead(providerId: string): Promise<R> {
  const id = uuid(providerId);
  if (!id) return { error: "Invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_thread_read", { p_provider: id });
  return error ? { error: error.message } : { ok: true };
}

export async function setThread(providerId: string, status: string | null, assignedTo: string | null): Promise<R> {
  const id = uuid(providerId);
  if (!id) return { error: "Invalid" };
  if (status !== null && !["open", "waiting", "closed"].includes(status)) return { error: "Unknown status" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_thread", { p_provider: id, p_status: status, p_assigned: assignedTo ? uuid(assignedTo) : null });
  if (error) return { error: error.message };
  revalidatePath("/admin/messages", "layout");
  return { ok: true };
}

// ---------- announcements
export async function saveAnnouncement(_p: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in again." };
  const title_en = str(fd.get("title_en"), 140);
  const body_en = str(fd.get("body_en"), 4000);
  if (title_en.length < 3 || body_en.length < 3) return { error: "Add an English title and message." };
  const audience = fd.getAll("audience").map(String).filter((t) => ["host_home", "family_caregiver", "scc_dsp", "nmt"].includes(t));
  const expires = str(fd.get("expires_on"), 10);
  const { error } = await supabase.from("announcements").insert({
    title_en, body_en,
    title_es: str(fd.get("title_es"), 140) || title_en,
    body_es: str(fd.get("body_es"), 4000) || body_en,
    audience, pinned: fd.get("pinned") === "on", expires_on: DATE.test(expires) ? expires : null, created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: "Posted. Matching providers got a notification." };
}

export async function updateAnnouncement(id: string, patch: { pinned?: boolean; archived?: boolean }): Promise<R> {
  if (!uuid(id)) return { error: "Invalid" };
  const clean: { pinned?: boolean; archived?: boolean } = {};
  if (typeof patch.pinned === "boolean") clean.pinned = patch.pinned;
  if (typeof patch.archived === "boolean") clean.archived = patch.archived;
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").update(clean).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- form drafts (server-side only; nothing is kept in the browser)
export async function saveDraft(assignmentId: string, data: Record<string, unknown>): Promise<R> {
  const id = uuid(assignmentId);
  if (!id) return { error: "Invalid" };
  if (typeof data !== "object" || data === null || Array.isArray(data)) return { error: "Invalid" };
  const supabase = await createClient();
  const { data: at, error } = await supabase.rpc("save_draft", { p_assignment: id, p_data: data });
  if (error) return { error: error.message };
  return { ok: true, savedAt: at as string };
}

// ---------- password help and account status
export async function requestPasswordHelp(_p: R | undefined, fd: FormData): Promise<R> {
  const supabase = await createClient();
  await supabase.rpc("request_password_help", { p_email: str(fd.get("email"), 200) });
  // Same answer whether or not the email has an account.
  return { ok: true };
}

export async function createPasswordReset(profileId: string): Promise<R> {
  const id = uuid(profileId);
  if (!id) return { error: "Invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_password_reset", { p_profile: id });
  if (error) return { error: error.message };
  return { ok: true, link: `/reset/${data}` };
}

export async function applyPasswordReset(_p: R | undefined, fd: FormData): Promise<R> {
  const token = uuid(fd.get("token"));
  const password = String(fd.get("password") ?? "");
  if (!token) return { error: "This link is not valid." };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const supabase = await createClient();
  const { data: email, error } = await supabase.rpc("use_password_reset", { p_token: token, p_password: password });
  if (error) return { error: error.message };
  const { error: e2 } = await supabase.auth.signInWithPassword({ email: email as string, password });
  if (e2) return { ok: true, message: "Password changed. Please sign in." };
  redirect("/dashboard");
}

export async function setAccountActive(profileId: string, active: boolean): Promise<R> {
  const id = uuid(profileId);
  if (!id) return { error: "Invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_account_active", { p_profile: id, p_active: !!active });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true };
}
