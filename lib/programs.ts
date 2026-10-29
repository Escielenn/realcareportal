import type { SupabaseClient } from "@supabase/supabase-js";
import { todayDenver } from "@/lib/i18n";

export type Program = {
  id: string; slug: string; name_en: string; name_es: string; description_en: string; description_es: string;
  price_cents: number; duration_days: number; audience: string[]; active: boolean; is_example: boolean; sort: number;
};
export type Term = { id: string; program_id: string | null; course_id: string | null; starts_on: string; ends_on: string };

// Real Care runs on Colorado time, so "today" is the Denver date, not UTC.
export const today = () => todayDenver();
export const daysUntil = (d: string) => Math.round((Date.parse(d) - Date.parse(today())) / 86_400_000);
export const programName = (p: Pick<Program, "name_en" | "name_es">, lang: "en" | "es") => (lang === "es" ? p.name_es : p.name_en);
export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

// Everything a provider needs to see what they can open and which programs they hold.
export async function accessFor(supabase: SupabaseClient, providerId: string) {
  const [{ data: programs }, { data: links }, { data: ents }, { data: renew }] = await Promise.all([
    supabase.from("programs").select("*").order("sort"),
    supabase.from("program_courses").select("program_id, course_id"),
    supabase.from("entitlements").select("id, program_id, course_id, starts_on, ends_on").eq("provider_id", providerId).order("ends_on", { ascending: false }),
    supabase.from("program_auto_renew").select("program_id, auto_renew").eq("provider_id", providerId),
  ]);
  const t = today();
  const terms = (ents ?? []) as Term[];
  const active = terms.filter((e) => e.starts_on <= t && e.ends_on >= t);
  const coursesOf = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    if (!coursesOf.has(l.program_id)) coursesOf.set(l.program_id, new Set());
    coursesOf.get(l.program_id)!.add(l.course_id);
  }
  const open = new Set<string>();
  for (const e of active) {
    if (e.course_id) open.add(e.course_id);
    if (e.program_id) coursesOf.get(e.program_id)?.forEach((c) => open.add(c));
  }
  // Latest term per program (may be in the future after an early renewal).
  const latest = new Map<string, Term>();
  for (const e of terms) if (e.program_id && !latest.has(e.program_id)) latest.set(e.program_id, e);
  return {
    programs: (programs ?? []) as Program[],
    coursesOf,
    terms,
    latest,
    autoRenew: new Set((renew ?? []).filter((r) => r.auto_renew).map((r) => r.program_id as string)),
    canOpen: (c: { id: string; price_cents: number }) => c.price_cents === 0 || open.has(c.id),
    programsFor: (courseId: string) => ((programs ?? []) as Program[]).filter((p) => coursesOf.get(p.id)?.has(courseId)),
  };
}
