import type { SupabaseClient } from "@supabase/supabase-js";
import { providerRows } from "@/lib/admin-data";

// Staff reports. Counts and provider-level figures only: no form answers, no names of people supported.
export type ReportFilters = { from: string; to: string; type: string };

export async function buildReports(supabase: SupabaseClient, f: ReportFilters) {
  const toEnd = `${f.to}T23:59:59`;
  const [rows, { data: subs }, { data: events }, { data: assigns }, { data: completions }, { data: courses }, { data: reqs }] = await Promise.all([
    providerRows(supabase),
    supabase.from("submissions").select("id, provider_id, status, submitted_at, reviewed_at, assignments(template_id, form_templates(title_en))").gte("submitted_at", f.from).lte("submitted_at", toEnd),
    supabase.from("submission_events").select("submission_id, action, created_at").gte("created_at", f.from).lte("created_at", toEnd),
    supabase.from("assignments").select("id, provider_id, due_on, submissions(id)").lt("due_on", new Date().toISOString().slice(0, 10)),
    supabase.from("completions").select("course_id, provider_id, completed_at").gte("completed_at", f.from).lte("completed_at", toEnd),
    supabase.from("courses").select("id, title_en"),
    supabase.from("requirements").select("course_id, provider_type"),
  ]);
  const providers = rows.filter((r) => r.active && (!f.type || r.provider_types.includes(f.type)));
  const providerIds = new Set(providers.map((p) => p.provider_id));

  // Training compliance by provider type
  const types = ["host_home", "family_caregiver", "scc_dsp", "nmt"];
  const byType = types.map((t) => {
    const ps = providers.filter((p) => p.provider_types.includes(t));
    const count = (s: string) => ps.filter((p) => p.status === s).length;
    return { type: t, providers: ps.length, complete: count("complete"), in_progress: count("in_progress"), due_soon: count("due_soon"), overdue: count("overdue") };
  }).filter((r) => r.providers > 0);

  // Courses with the lowest completion among providers who need them (current cycle figures from the status view)
  const courseName = new Map((courses ?? []).map((c) => [c.id, c.title_en]));
  const completedInPeriod = new Map<string, number>();
  for (const c of completions ?? []) if (providerIds.has(c.provider_id)) completedInPeriod.set(c.course_id, (completedInPeriod.get(c.course_id) ?? 0) + 1);
  const needCount = new Map<string, number>();
  for (const r of reqs ?? []) needCount.set(r.course_id, (needCount.get(r.course_id) ?? 0) + providers.filter((p) => p.provider_types.includes(r.provider_type)).length);
  const courseRows = [...needCount.entries()].filter(([, n]) => n > 0)
    .map(([id, need]) => ({ course: courseName.get(id) ?? id, need, completed: completedInPeriod.get(id) ?? 0 }))
    .sort((a, b) => a.completed / a.need - b.completed / b.need);

  // Paperwork by form
  type S = { id: string; provider_id: string; status: string; submitted_at: string; reviewed_at: string | null; assignments: { form_templates: { title_en: string } | null } | null };
  const ss = ((subs ?? []) as unknown as S[]).filter((s) => providerIds.has(s.provider_id));
  const returnsBySub = new Map<string, number>();
  for (const e of events ?? []) if (e.action === "returned") returnsBySub.set(e.submission_id, (returnsBySub.get(e.submission_id) ?? 0) + 1);
  const forms = new Map<string, { form: string; submitted: number; accepted: number; returned: number; waiting: number; returnedTwice: number; reviewHours: number[] }>();
  for (const s of ss) {
    const name = s.assignments?.form_templates?.title_en ?? "Form";
    const r = forms.get(name) ?? { form: name, submitted: 0, accepted: 0, returned: 0, waiting: 0, returnedTwice: 0, reviewHours: [] };
    r.submitted++;
    if (s.status === "accepted") r.accepted++;
    if (s.status === "submitted" || s.status === "in_review") r.waiting++;
    if ((returnsBySub.get(s.id) ?? 0) > 0) r.returned++;
    if ((returnsBySub.get(s.id) ?? 0) > 1) r.returnedTwice++;
    if (s.reviewed_at) r.reviewHours.push((new Date(s.reviewed_at).getTime() - new Date(s.submitted_at).getTime()) / 36e5);
    forms.set(name, r);
  }
  const formRows = [...forms.values()].map((r) => ({
    form: r.form, submitted: r.submitted, accepted: r.accepted, returned: r.returned, returned_more_than_once: r.returnedTwice, waiting: r.waiting,
    avg_review_hours: r.reviewHours.length ? Math.round((r.reviewHours.reduce((a, b) => a + b, 0) / r.reviewHours.length) * 10) / 10 : null,
  })).sort((a, b) => b.submitted - a.submitted);

  // Overdue paperwork by provider (assigned, past due, never submitted)
  type A = { provider_id: string; submissions: { id: string }[] | { id: string } | null };
  const overdue = new Map<string, number>();
  for (const a of (assigns ?? []) as unknown as A[]) {
    const sub = Array.isArray(a.submissions) ? a.submissions[0] : a.submissions;
    if (!sub && providerIds.has(a.provider_id)) overdue.set(a.provider_id, (overdue.get(a.provider_id) ?? 0) + 1);
  }
  const overdueRows = providers.filter((p) => overdue.has(p.provider_id)).map((p) => ({ provider: p.full_name, overdue_forms: overdue.get(p.provider_id)! })).sort((a, b) => b.overdue_forms - a.overdue_forms);
  const overdueTraining = providers.filter((p) => p.status === "overdue").map((p) => ({ provider: p.full_name, done: p.done_count, required: p.required_count, due: p.due_on }));

  return { byType, courseRows, formRows, overdueRows, overdueTraining, providerCount: providers.length, submissionCount: ss.length };
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  // Quote every cell and neutralize spreadsheet formulas (cells starting with = + - @).
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}
