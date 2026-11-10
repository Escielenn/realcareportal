import type { SupabaseClient } from "@supabase/supabase-js";

export type Course = {
  id: string; slug: string; title_en: string; title_es: string; description_en: string; description_es: string;
  sort: number; is_specialty: boolean; price_cents: number; in_all_access: boolean; access_days: number; published: boolean; invite_only?: boolean;
};
export type Cycle = { id: string; cycle_number: number; starts_on: string; due_on: string; label: string | null };

// Training picture for one provider: required courses (by provider type, plus courses assigned to them, minus exemptions),
// current cycle, completions by cycle. One-time courses count as done once they're completed in any year.
export async function trainingFor(supabase: SupabaseClient, providerId: string, _types?: string[]) {
  const [{ data: courses }, { data: reqs }, { data: cycles }, { data: completions }, { data: overrides }] = await Promise.all([
    supabase.from("courses").select("*").order("sort"),
    supabase.rpc("required_courses", { p_provider: providerId }),
    supabase.from("training_cycles").select("*").eq("provider_id", providerId).order("cycle_number", { ascending: false }),
    supabase.from("completions").select("id, course_id, cycle_id, completed_at, score, language, source").eq("provider_id", providerId),
    supabase.from("provider_course_overrides").select("course_id, mode, frequency, note").eq("provider_id", providerId),
  ]);
  const reqRows = (reqs ?? []) as { course_id: string; frequency: "annual" | "once" }[];
  const requiredIds = new Set(reqRows.map((r) => r.course_id));
  const onceIds = new Set(reqRows.filter((r) => r.frequency === "once").map((r) => r.course_id));
  const allCourses = (courses ?? []) as Course[];
  const required = allCourses.filter((c) => requiredIds.has(c.id));
  const optional = allCourses.filter((c) => !requiredIds.has(c.id) && !c.invite_only);
  const current = ((cycles ?? []) as Cycle[])[0] ?? null;
  const comps = completions ?? [];
  const doneNow = new Map(comps.filter((c) => c.cycle_id === current?.id).map((c) => [c.course_id as string, c]));
  for (const c of [...comps].sort((a, b) => (a.completed_at < b.completed_at ? 1 : -1))) {
    if (onceIds.has(c.course_id) && !doneNow.has(c.course_id)) doneNow.set(c.course_id, c);
  }
  return {
    courses: allCourses,
    required,
    optional,
    onceIds,
    overrides: (overrides ?? []) as { course_id: string; mode: "assigned" | "exempt"; frequency: string; note: string | null }[],
    cycles: (cycles ?? []) as Cycle[],
    current,
    completions: comps,
    doneNow,
    doneCount: required.filter((c) => doneNow.has(c.id)).length,
  };
}

export function title(c: { title_en: string; title_es: string }, lang: string) {
  return lang === "es" ? c.title_es : c.title_en;
}
