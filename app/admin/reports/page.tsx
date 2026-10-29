import { requireStaff } from "@/lib/auth";
import { buildReports } from "@/lib/reports";
import { fmtDate, providerTypeLabel } from "@/lib/i18n";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; type?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const today = new Date();
  const from = sp.from && DATE.test(sp.from) ? sp.from : new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const to = sp.to && DATE.test(sp.to) ? sp.to : today.toISOString().slice(0, 10);
  const type = ["host_home", "family_caregiver", "scc_dsp", "nmt"].includes(sp.type ?? "") ? sp.type! : "";
  const r = await buildReports(supabase, { from, to, type });
  const q = `from=${from}&to=${to}&type=${type}`;
  const csv = (kind: string) => `/admin/reports/export?kind=${kind}&${q}`;
  const th = "px-3 py-2 font-semibold";
  const td = "px-3 py-2 tabular-nums";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Reports</h1>
        <p className="text-muted">Training and paperwork at a glance. Figures are counts; no form answers or names of people supported appear here or in the downloads. Every download is written to the audit log.</p>
      </div>
      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <div><label className="label text-sm" htmlFor="r-from">From</label><input id="r-from" name="from" type="date" defaultValue={from} className="input py-1.5" /></div>
        <div><label className="label text-sm" htmlFor="r-to">To</label><input id="r-to" name="to" type="date" defaultValue={to} className="input py-1.5" /></div>
        <div><label className="label text-sm" htmlFor="r-type">Provider type</label>
          <select id="r-type" name="type" defaultValue={type} className="input py-1.5">
            <option value="">All types</option>
            {["host_home", "family_caregiver", "scc_dsp", "nmt"].map((t) => <option key={t} value={t}>{providerTypeLabel[t]?.en}</option>)}
          </select></div>
        <button className="btn-primary py-2">Update</button>
        <p className="text-sm text-muted">{r.providerCount} active providers · {r.submissionCount} submissions from {fmtDate(from)} to {fmtDate(to)}</p>
      </form>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3"><h2 className="text-lg font-semibold">Training compliance by provider type (current cycle)</h2><a className="text-sm font-semibold text-teal hover:underline" href={csv("training")}>Download CSV</a></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-y border-line bg-sand/60 text-muted"><tr><th className={th}>Provider type</th><th className={th}>Providers</th><th className={th}>Complete</th><th className={th}>In progress</th><th className={th}>Due soon</th><th className={th}>Overdue</th></tr></thead>
          <tbody className="divide-y divide-line">{r.byType.map((x) => (
            <tr key={x.type}><td className="px-3 py-2 font-medium">{providerTypeLabel[x.type]?.en}</td><td className={td}>{x.providers}</td><td className={td}>{x.complete}</td><td className={td}>{x.in_progress}</td><td className={td}>{x.due_soon}</td><td className={`${td} ${x.overdue ? "font-semibold text-coral" : ""}`}>{x.overdue}</td></tr>
          ))}</tbody>
        </table></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3"><h2 className="text-lg font-semibold">Courses completed in this period</h2><a className="text-sm font-semibold text-teal hover:underline" href={csv("courses")}>CSV</a></div>
          <p className="px-5 pb-2 text-sm text-muted">Lowest completion first, against the number of providers who need each course.</p>
          <div className="max-h-96 overflow-y-auto"><table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-y border-line bg-sand text-muted"><tr><th className={th}>Course</th><th className={th}>Completed</th><th className={th}>Need it</th></tr></thead>
            <tbody className="divide-y divide-line">{r.courseRows.map((c) => <tr key={c.course}><td className="px-3 py-2">{c.course}</td><td className={td}>{c.completed}</td><td className={td}>{c.need}</td></tr>)}</tbody>
          </table></div>
        </section>
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3"><h2 className="text-lg font-semibold">Training overdue</h2><a className="text-sm font-semibold text-teal hover:underline" href={csv("overdue_training")}>CSV</a></div>
          {r.overdueTraining.length === 0 ? <p className="px-5 pb-5 text-muted">No one is overdue.</p> : (
            <table className="w-full text-left text-sm"><thead className="border-y border-line bg-sand/60 text-muted"><tr><th className={th}>Provider</th><th className={th}>Done</th><th className={th}>Was due</th></tr></thead>
              <tbody className="divide-y divide-line">{r.overdueTraining.map((o) => <tr key={o.provider}><td className="px-3 py-2">{o.provider}</td><td className={td}>{o.done}/{o.required}</td><td className={td}>{o.due ? fmtDate(o.due) : "—"}</td></tr>)}</tbody></table>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3"><h2 className="text-lg font-semibold">Paperwork by form</h2><a className="text-sm font-semibold text-teal hover:underline" href={csv("forms")}>Download CSV</a></div>
        {r.formRows.length === 0 ? <p className="px-5 pb-5 text-muted">No submissions in this period.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-line bg-sand/60 text-muted"><tr><th className={th}>Form</th><th className={th}>Submitted</th><th className={th}>Accepted</th><th className={th}>Returned</th><th className={th}>Returned 2+ times</th><th className={th}>Waiting</th><th className={th}>Avg. time to review</th></tr></thead>
            <tbody className="divide-y divide-line">{r.formRows.map((f) => (
              <tr key={f.form}><td className="px-3 py-2 font-medium">{f.form}</td><td className={td}>{f.submitted}</td><td className={td}>{f.accepted}</td><td className={td}>{f.returned}</td><td className={td}>{f.returned_more_than_once}</td><td className={td}>{f.waiting}</td><td className={td}>{f.avg_review_hours === null ? "—" : `${f.avg_review_hours} h`}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3"><h2 className="text-lg font-semibold">Overdue paperwork by provider</h2><a className="text-sm font-semibold text-teal hover:underline" href={csv("overdue_forms")}>CSV</a></div>
        {r.overdueRows.length === 0 ? <p className="px-5 pb-5 text-muted">Nothing overdue.</p> : (
          <table className="w-full text-left text-sm"><thead className="border-y border-line bg-sand/60 text-muted"><tr><th className={th}>Provider</th><th className={th}>Forms past due, not submitted</th></tr></thead>
            <tbody className="divide-y divide-line">{r.overdueRows.map((o) => <tr key={o.provider}><td className="px-3 py-2">{o.provider}</td><td className={td}>{o.overdue_forms}</td></tr>)}</tbody></table>
        )}
      </section>
    </div>
  );
}
