"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = ["host_home", "family_caregiver", "scc_dsp", "nmt"];
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const str = (v: FormDataEntryValue | null, max = 2000) => String(v ?? "").trim().slice(0, max);
type R = { ok?: boolean; error?: string; message?: string };

// Provider opts in to (or renews) a program. Paid programs use demo checkout while demo mode is on.
export async function joinProgram(programId: string): Promise<R> {
  const id = uuid(programId);
  if (!id) return { error: "Invalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_program", { p_program: id });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Staff: create or edit a program and its course list.
export async function saveProgram(_p: R | undefined, fd: FormData): Promise<R> {
  const existing = uuid(fd.get("id"));
  const name_en = str(fd.get("name_en"), 120);
  const slug = str(fd.get("slug"), 60).toLowerCase();
  const price = Math.round(Number(fd.get("price") || 0) * 100);
  const days = Math.round(Number(fd.get("duration_days") || 365));
  if (name_en.length < 2) return { error: "Add a program name." };
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug)) return { error: "Short name: lowercase letters, numbers and dashes only." };
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return { error: "Price must be between $0 and $10,000." };
  if (!Number.isFinite(days) || days < 1 || days > 730) return { error: "Length must be between 1 and 730 days." };
  const row = {
    slug, name_en,
    name_es: str(fd.get("name_es"), 120) || name_en,
    description_en: str(fd.get("description_en")),
    description_es: str(fd.get("description_es")) || str(fd.get("description_en")),
    price_cents: price, duration_days: days,
    audience: fd.getAll("audience").map(String).filter((t) => TYPES.includes(t)),
    active: fd.get("active") === "on",
    sort: Math.max(0, Math.min(999, Number(fd.get("sort") || 0) || 0)),
  };
  const courses = fd.getAll("courses").map((c) => uuid(c)).filter((c): c is string => !!c);
  const supabase = await createClient();
  let id = existing;
  if (existing) {
    const { error } = await supabase.from("programs").update(row).eq("id", existing);
    if (error) return { error: error.code === "23505" ? "That short name is taken." : error.message };
  } else {
    const { data, error } = await supabase.from("programs").insert(row).select("id").single();
    if (error) return { error: error.code === "23505" ? "That short name is taken." : error.message };
    id = data.id as string;
  }
  const { error: e2 } = await supabase.rpc("set_program_courses", { p_program: id, p_courses: courses });
  if (e2) return { error: e2.message };
  revalidatePath("/", "layout");
  if (!existing) redirect(`/admin/programs/${id}`);
  return { ok: true, message: "Saved." };
}

// Staff: give a program at no charge.
export async function grantProgram(_p: R | undefined, fd: FormData): Promise<R> {
  const provider = uuid(fd.get("provider"));
  const program = uuid(fd.get("program"));
  if (!provider || !program) return { error: "Choose a provider." };
  const days = Number(fd.get("days") || 365);
  const supabase = await createClient();
  const { error } = await supabase.rpc("grant_program", {
    p_provider: provider, p_program: program, p_days: Number.isFinite(days) ? days : 365, p_note: str(fd.get("note"), 500),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Program given. The provider was notified." };
}
