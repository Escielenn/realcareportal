import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime, fmtDate } from "@/lib/i18n";
import { SubmissionPill } from "@/components/status";

export default async function ReviewQueue({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const { supabase } = await requireStaff();
  const statuses = show === "all" ? ["submitted", "returned", "accepted"] : ["submitted"];
  const { data } = await supabase
    .from("submissions")
    .select("id, status, submitted_at, provider_id, assignments(due_on, form_templates(slug, title_en), individuals(full_name))")
    .in("status", statuses)
    .order("submitted_at", { ascending: show === "all" ? false : true });
  const { data: people } = await supabase.from("profiles").select("id, full_name");
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  type R = { id: string; status: string; submitted_at: string; provider_id: string; assignments: { due_on: string; form_templates: { slug: string; title_en: string }; individuals: { full_name: string } | null } };
  const rows = ((data ?? []) as unknown as R[]).sort((a, b) =>
    show === "all" ? 0 : Number(b.assignments.form_templates.slug === "incident-report") - Number(a.assignments.form_templates.slug === "incident-report"));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Review queue</h1>
          <p className="text-muted">Incident reports first, then oldest first. Return a form with notes on specific fields, or accept it.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/review" className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${show !== "all" ? "border-teal bg-teal text-white" : "border-line bg-white text-muted"}`}>Waiting</Link>
          <Link href="/admin/review?show=all" className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${show === "all" ? "border-teal bg-teal text-white" : "border-line bg-white text-muted"}`}>All submissions</Link>
        </div>
      </div>
      <ul className="card divide-y divide-line">
        {rows.map((r) => {
          const incident = r.assignments.form_templates.slug === "incident-report";
          return (
            <li key={r.id}>
              <Link href={`/admin/review/${r.id}`} className={`flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-sand/50 ${incident && r.status === "submitted" ? "border-l-4 border-coral" : ""}`}>
                <div>
                  <p className="font-semibold">
                    {incident && <span className="pill mr-2 bg-coral-soft text-coral">Incident</span>}
                    {r.assignments.form_templates.title_en}
                  </p>
                  <p className="text-sm text-muted">{names.get(r.provider_id)}{r.assignments.individuals ? ` · for ${r.assignments.individuals.full_name}` : ""} · due {fmtDate(r.assignments.due_on)}</p>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted">
                  Submitted {fmtDateTime(r.submitted_at)}
                  <SubmissionPill status={r.status} />
                </div>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && <li className="p-6 text-center text-muted">Nothing waiting for review. 🎉</li>}
      </ul>
    </div>
  );
}
