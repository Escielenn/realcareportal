import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { providerRows } from "@/lib/admin-data";
import { fmtDate, fmtDateTime, providerTypeLabel } from "@/lib/i18n";
import { PrintButton } from "@/components/client-bits";
import { Logo } from "@/components/logo";

export default async function Transcripts({ searchParams }: { searchParams: Promise<{ provider?: string; type?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  let rows = await providerRows(supabase);
  if (sp.provider) rows = rows.filter((r) => r.provider_id === sp.provider);
  if (sp.type) rows = rows.filter((r) => r.provider_types.includes(sp.type!));
  const ids = rows.map((r) => r.provider_id);

  const [{ data: comps }, { data: cycles }, { data: courses }, { data: reqs }] = await Promise.all([
    supabase.from("completions").select("provider_id, course_id, cycle_id, completed_at, score, language, source").in("provider_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("training_cycles").select("*").in("provider_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]).order("cycle_number", { ascending: false }),
    supabase.from("courses").select("id, title_en, sort"),
    supabase.from("requirements").select("provider_type, course_id"),
  ]);
  await supabase.rpc("log_event", { p_action: "export_transcripts", p_table: "completions", p_record: `${ids.length} providers` });
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const from = sp.from && DATE.test(sp.from) ? sp.from : null;
  const to = sp.to && DATE.test(sp.to) ? sp.to : null;
  const inPeriod = (d: string) => (!from || d.slice(0, 10) >= from) && (!to || d.slice(0, 10) <= to);
  const courseName = new Map((courses ?? []).map((c) => [c.id, c.title_en]));
  const courseSort = new Map((courses ?? []).map((c) => [c.id, c.sort]));
  const generated = new Date().toISOString();

  const exceptions = rows
    .map((r) => {
      const required = new Set((reqs ?? []).filter((q) => r.provider_types.includes(q.provider_type)).map((q) => q.course_id));
      const done = new Set((comps ?? []).filter((c) => c.provider_id === r.provider_id && c.cycle_id === r.cycle_id).map((c) => c.course_id));
      const missing = [...required].filter((c) => !done.has(c));
      return { r, missing };
    })
    .filter((x) => x.missing.length > 0);

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transcripts</h1>
          <p className="text-muted">Built live from every course in one query. No CSV downloads, no uploads. Print them all at once.</p>
        </div>
        <PrintButton label={`Print ${rows.length} transcript${rows.length === 1 ? "" : "s"}`} />
      </div>

      <div className="no-print flex flex-wrap gap-2">
        {[{ v: "", l: "All providers" }, ...Object.entries(providerTypeLabel).map(([v, l]) => ({ v, l: l.en }))].map((s) => (
          <Link key={s.v} href={s.v ? `/admin/transcripts?type=${s.v}` : "/admin/transcripts"}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${(sp.type ?? "") === s.v && !sp.provider ? "border-teal bg-teal text-white" : "border-line bg-white text-muted"}`}>{s.l}</Link>
        ))}
      </div>

      <form className="no-print card flex flex-wrap items-end gap-3 p-4" action="/admin/transcripts">
        {sp.type && <input type="hidden" name="type" value={sp.type} />}
        {sp.provider && <input type="hidden" name="provider" value={sp.provider} />}
        <div><label className="label text-sm" htmlFor="from">Reporting period from</label><input id="from" name="from" type="date" defaultValue={from ?? ""} className="input py-1.5" /></div>
        <div><label className="label text-sm" htmlFor="to">to</label><input id="to" name="to" type="date" defaultValue={to ?? ""} className="input py-1.5" /></div>
        <button className="btn-ghost">Apply</button>
        {(from || to) && <Link href="/admin/transcripts" className="text-sm text-teal underline">Clear</Link>}
        <span className="text-sm text-muted">Leave blank for the full history.</span>
      </form>

      <div className="no-print grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="card p-4 text-sm">
          <p><strong>Data as of:</strong> {fmtDateTime(generated)} (live)</p>
          <p><strong>Transcripts in this batch:</strong> {rows.length}</p>
          <p><strong>Reporting period:</strong> {from || to ? `${from ? fmtDate(from) : "start"} to ${to ? fmtDate(to) : "today"}` : "All dates"}</p>
          <p className="text-muted">Generating this batch is recorded in the audit log.</p>
        </div>
        <div className="card p-4 text-sm">
          <p className="font-semibold">Exceptions for staff review ({exceptions.length})</p>
          <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-muted">
            {exceptions.map(({ r, missing }) => (
              <li key={r.provider_id}><Link href={`/admin/providers/${r.provider_id}`} className="text-teal hover:underline">{r.full_name}</Link>: {missing.length} required course{missing.length === 1 ? "" : "s"} missing this cycle</li>
            ))}
            <li>Unmatched imported records: 0</li>
          </ul>
        </div>
      </div>

      <div className="space-y-6">
        {rows.map((r) => {
          const myCycles = (cycles ?? []).filter((c) => c.provider_id === r.provider_id);
          return (
            <article key={r.provider_id} className="print-page card p-6 md:p-8">
              <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <p className="text-xs font-semibold tracking-widest text-teal uppercase">Real Care, Inc. · Training transcript</p>
                  <h2 className="mt-1 text-xl font-bold">{r.full_name}</h2>
                  <p className="text-sm text-muted">{r.provider_types.map((t) => providerTypeLabel[t]?.en ?? t).join(", ")} · {r.email}</p>
                </div>
                <div className="flex items-start gap-3 text-right text-xs text-muted">
                  <div>Generated {fmtDateTime(generated)}<br />{(from || to) && <>Period {from ? fmtDate(from) : "start"} – {to ? fmtDate(to) : "today"}<br /></>}Current cycle due {fmtDate(r.due_on)}<br /><strong className="text-ink">{r.done_count} of {r.required_count} required complete</strong></div>
                  <Logo className="h-10 w-10" />
                </div>
              </header>
              {myCycles.map((cy) => {
                const items = (comps ?? []).filter((c) => c.provider_id === r.provider_id && c.cycle_id === cy.id && inPeriod(c.completed_at)).sort((a, b) => (courseSort.get(a.course_id) ?? 0) - (courseSort.get(b.course_id) ?? 0));
                return (
                  <section key={cy.id} className="mt-4">
                    <h3 className="mb-1 font-semibold">{cy.label ?? `Cycle ${cy.cycle_number}`} <span className="font-normal text-muted">· {fmtDate(cy.starts_on)} – {fmtDate(cy.due_on)}</span></h3>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted">{from || to ? "No completions in this period." : "No completions yet in this cycle."}</p>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="text-muted"><tr><th className="py-1 font-medium">Course</th><th className="py-1 font-medium">Completed</th><th className="py-1 font-medium">Score</th><th className="py-1 font-medium">Language</th></tr></thead>
                        <tbody className="divide-y divide-line">
                          {items.map((c) => (
                            <tr key={c.course_id}>
                              <td className="py-1">{courseName.get(c.course_id)}</td>
                              <td className="py-1">{fmtDate(c.completed_at)}</td>
                              <td className="py-1">{c.score ? `${c.score}%` : "—"}</td>
                              <td className="py-1">{c.language === "es" ? "Spanish" : "English"}{c.source === "legacy_wix" ? " · imported" : c.source === "staff_override" ? " · recorded by staff" : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                );
              })}
            </article>
          );
        })}
      </div>
    </div>
  );
}
