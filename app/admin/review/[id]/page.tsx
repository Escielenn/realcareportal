import { holdsValue, isVisible } from "@/lib/forms";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/i18n";
import type { FormSchema } from "@/lib/forms";
import { FormView, History } from "@/components/form-view";
import { SubmissionPill } from "@/components/status";
import { ReviewPanel } from "./review-panel";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: s } = await supabase
    .from("submissions")
    .select("id, data, status, flags, submitted_at, provider_id, assignments(due_on, form_templates(slug, title_en, schema), individuals(full_name, goals))")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();
  await supabase.rpc("log_event", { p_action: "view_submission", p_table: "submissions", p_record: id });
  const a = s.assignments as unknown as { due_on: string; form_templates: { slug: string; title_en: string; schema: FormSchema }; individuals: { full_name: string; goals: string[] } | null };
  const [{ data: events }, { data: people }] = await Promise.all([
    supabase.from("submission_events").select("id, action, note, created_at, actor").eq("submission_id", id).order("created_at"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name]));
  const schema = a.form_templates.schema;
  const data = s.data as Record<string, unknown>;
  const fields = schema.sections.flatMap((sec) => sec.fields).filter((f) => holdsValue(f) && isVisible(f, data)).map((f) => ({ id: f.id, label: f.label_en }));

  return (
    <div className="space-y-5">
      <Link href="/admin/review" className="text-sm font-semibold text-teal hover:underline">← Review queue</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{a.form_templates.title_en}</h1>
          <p className="text-muted">
            <Link href={`/admin/providers/${s.provider_id}`} className="font-semibold text-teal hover:underline">{names[s.provider_id]}</Link>
            {a.individuals ? ` · for ${a.individuals.full_name}` : ""} · due {fmtDate(a.due_on)} · submitted {fmtDateTime(s.submitted_at)}
          </p>
        </div>
        <SubmissionPill status={s.status} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <FormView schema={schema} data={data} lang="en" individual={a.individuals} />
        <div className="space-y-5">
          {s.status === "submitted" ? (
            <ReviewPanel submissionId={s.id} fields={fields} />
          ) : s.status === "returned" ? (
            <div className="card p-5">
              <h2 className="mb-2 font-bold text-coral">Returned to provider</h2>
              <ul className="space-y-2 text-sm">
                {Object.entries(s.flags as Record<string, string>).map(([k, v]) => (
                  <li key={k}><strong>{fields.find((f) => f.id === k)?.label ?? k}:</strong> {v}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">Waiting for the provider to send corrections.</p>
            </div>
          ) : (
            <div className="card bg-green-soft p-5 font-semibold text-green">✓ Accepted</div>
          )}
          <section className="card p-5">
            <h2 className="mb-4 font-bold">History</h2>
            <History events={events ?? []} names={names} lang="en" />
          </section>
        </div>
      </div>
    </div>
  );
}
