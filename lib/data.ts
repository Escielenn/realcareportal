import type { SupabaseClient } from "@supabase/supabase-js";

export type Course = {
  id: string; slug: string; title_en: string; title_es: string; description_en: string; description_es: string;
  sort: number; is_specialty: boolean; price_cents: number; in_all_access: boolean; access_days: number; published: boolean;
};
export type Cycle = { id: string; cycle_number: number; starts_on: string; due_on: string; label: string | null };

// Training picture for one provider: required courses, current cycle, completions by cycle.
export async function trainingFor(supabase: SupabaseClient, providerId: string, types: string[]) {
  const [{ data: courses }, { data: reqs }, { data: cycles }, { data: completions }] = await Promise.all([
    supabase.from("courses").select("*").order("sort"),
    supabase.from("requirements").select("course_id, provider_type").in("provider_type", types.length ? types : ["none"]),
    supabase.from("training_cycles").select("*").eq("provider_id", providerId).order("cycle_number", { ascending: false }),
    supabase.from("completions").select("id, course_id, cycle_id, completed_at, score, language, source").eq("provider_id", providerId),
  ]);
  const requiredIds = new Set((reqs ?? []).map((r) => r.course_id as string));
  const allCourses = (courses ?? []) as Course[];
  const required = allCourses.filter((c) => requiredIds.has(c.id));
  const optional = allCourses.filter((c) => !requiredIds.has(c.id));
  const current = ((cycles ?? []) as Cycle[])[0] ?? null;
  const comps = completions ?? [];
  const doneNow = new Map(comps.filter((c) => c.cycle_id === current?.id).map((c) => [c.course_id as string, c]));
  return {
    courses: allCourses,
    required,
    optional,
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
