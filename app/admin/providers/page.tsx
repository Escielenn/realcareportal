import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { providerRows } from "@/lib/admin-data";
import { fmtDate, providerTypeLabel } from "@/lib/i18n";
import { TrainingPill, ProgressBar } from "@/components/status";

const STATUSES = [
  { v: "", l: "All" },
  { v: "overdue", l: "Overdue" },
  { v: "due_soon", l: "Due soon" },
  { v: "in_progress", l: "On track" },
  { v: "complete", l: "Complete" },
];

export default async function ProvidersPage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; q?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  let rows = await providerRows(supabase);
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);
  if (sp.type) rows = rows.filter((r) => r.provider_types.includes(sp.type!));
  if (sp.q) rows = rows.filter((r) => r.full_name.toLowerCase().includes(sp.q!.toLowerCase()));
  const order = { overdue: 0, due_soon: 1, in_progress: 2, complete: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || (a.due_on ?? "").localeCompare(b.due_on ?? ""));
  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(sp.status ? { status: sp.status } : {}), ...(sp.type ? { type: sp.type } : {}), ...patch });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/admin/providers${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Providers &amp; training</h1>
        <p className="text-muted">Current-cycle compliance for every provider. Required courses come from each provider type.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link key={s.v} href={link({ status: s.v })} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${(sp.status ?? "") === s.v ? "border-teal bg-teal text-white" : "border-line bg-white text-muted hover:text-ink"}`}>{s.l}</Link>
        ))}
        <span className="mx-1 h-6 w-px bg-line" />
        {[{ v: "", l: "All types" }, ...Object.entries(providerTypeLabel).map(([v, l]) => ({ v, l: l.en }))].map((s) => (
          <Link key={s.v} href={link({ type: s.v })} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${(sp.type ?? "") === s.v ? "border-teal bg-teal-soft text-teal" : "border-line bg-white text-muted hover:text-ink"}`}>{s.l}</Link>
        ))}
        <form className="ml-auto" action="/admin/providers">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <label className="sr-only" htmlFor="q">Search providers</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Search by name" className="input w-56 py-1.5" />
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-line bg-sand/60 text-sm text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Current cycle due</th>
              <th className="w-56 px-4 py-3 font-semibold">Required courses</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.provider_id} className="hover:bg-sand/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/providers/${r.provider_id}`} className="font-semibold text-teal hover:underline">{r.full_name}</Link>
                  <p className="text-sm text-muted">{r.email}{r.locale === "es" ? " · Español" : ""}</p>
                </td>
                <td className="px-4 py-3 text-sm">{r.provider_types.map((t) => providerTypeLabel[t]?.en ?? t).join(", ")}</td>
                <td className="px-4 py-3 text-sm">{fmtDate(r.due_on)}<p className="text-muted">Cycle {r.cycle_number}</p></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2"><ProgressBar value={r.done_count} max={r.required_count} /><span className="shrink-0 text-sm font-semibold">{r.done_count}/{r.required_count}</span></div>
                </td>
                <td className="px-4 py-3"><TrainingPill status={r.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No providers match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
