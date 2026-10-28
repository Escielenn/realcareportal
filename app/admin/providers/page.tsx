import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { providerRows } from "@/lib/admin-data";
import { fmtDate, providerTypeLabel } from "@/lib/i18n";
import { TrainingPill } from "@/components/status";
import { ProvidersTable } from "@/components/admin-bits";

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
        <p className="text-muted">Current-cycle compliance for every provider. Select providers to send reminders, open a new cycle or move due dates in one step.</p>
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

      <ProvidersTable
        rows={rows.map((r) => ({
          id: r.provider_id, name: r.full_name, email: r.email, spanish: r.locale === "es",
          types: r.provider_types.map((t) => providerTypeLabel[t]?.en ?? t).join(", "),
          due: fmtDate(r.due_on), cycle: r.cycle_number, done: r.done_count, required: r.required_count,
          statusEl: <TrainingPill status={r.status} />,
        }))}
      />
    </div>
  );
}
