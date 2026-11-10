import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/i18n";
import { SubmissionPill } from "@/components/status";

// Every form, cross-indexed by provider and by person supported (client). Search by either, or both.
// Lists form names, people and status only; opening a submission is what shows its answers (and is audited there).

type SP = { q?: string; provider?: string; client?: string; form?: string; status?: string; from?: string; to?: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const STATUS: [string, string][] = [["", "Any status"], ["open", "Not started"], ["overdue", "Overdue"], ["submitted", "Waiting for review"], ["returned", "Returned"], ["accepted", "Accepted"]];

export default async function FormRecords({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const today = new Date().toISOString().slice(0, 10);
  const from = sp.from && DATE.test(sp.from) ? sp.from : null;
  const to = sp.to && DATE.test(sp.to) ? sp.to : null;

  let query = supabase.from("assignments")
    .select("id, due_on, created_at, provider_id, individual_id, template_id, form_templates(title_en), individuals(full_name), profiles!assignments_provider_id_fkey(full_name), submissions(id, status, submitted_at)")
    .order("due_on", { ascending: false }).limit(2000);
  if (sp.provider && UUID.test(sp.provider)) query = query.eq("provider_id", sp.provider);
  if (sp.client && UUID.test(sp.client)) query = query.eq("individual_id", sp.client);
  if (sp.form && UUID.test(sp.form)) query = query.eq("template_id", sp.form);
  if (from) query = query.gte("due_on", from);
  if (to) query = query.lte("due_on", to);

  const [{ data }, { data: providers }, { data: clients }, { data: templates }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").eq("role", "provider").order("full_name"),
    supabase.from("individuals").select("id, full_name").order("full_name"),
    supabase.from("form_templates").select("id, title_en").order("title_en"),
  ]);

  type Row = {
    id: string; due_on: string; provider_id: string; individual_id: string | null;
    form_templates: { title_en: string } | null; individuals: { full_name: string } | null; profiles: { full_name: string } | null;
    submissions: { id: string; status: string; submitted_at: string } | { id: string; status: string; submitted_at: string }[] | null;
  };
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = ((data ?? []) as unknown as Row[]).map((r) => {
    const s = Array.isArray(r.submissions) ? r.submissions[0] : r.submissions;
    const state = s ? s.status : r.due_on < today ? "overdue" : "open";
    return { ...r, s, state };
  }).filter((r) => (!sp.status || r.state === sp.status)
    && (!q || [r.profiles?.full_name, r.individuals?.full_name, r.form_templates?.title_en].some((v) => v?.toLowerCase().includes(q))));

  const count = (st: string) => rows.filter((r) => r.state === st).length;
  const providerName = providers?.find((p) => p.id === sp.provider)?.full_name;
  const clientName = clients?.find((c) => c.id === sp.client)?.full_name;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Form records</h1>
        <p className="text-muted">Every form, searchable by provider, by person supported, or both.{providerName || clientName ? ` Showing ${[providerName && `provider ${providerName}`, clientName && `person supported ${clientName}`].filter(Boolean).join(" and ")}.` : ""}</p>
      </div>

      <form className="card grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-6" action="/admin/form-records">
        <div className="md:col-span-3 lg:col-span-2">
          <label className="label text-sm" htmlFor="fr-q">Search names or forms</label>
          <input id="fr-q" name="q" defaultValue={sp.q} placeholder="Provider, person or form…" className="input py-2" />
        </div>
        <div>
          <label className="label text-sm" htmlFor="fr-client">Person supported</label>
          <select id="fr-client" name="client" defaultValue={sp.client ?? ""} className="input py-2">
            <option value="">Anyone</option>
            {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-sm" htmlFor="fr-provider">Provider</label>
          <select id="fr-provider" name="provider" defaultValue={sp.provider ?? ""} className="input py-2">
            <option value="">Any provider</option>
            {(providers ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-sm" htmlFor="fr-form">Form</label>
          <select id="fr-form" name="form" defaultValue={sp.form ?? ""} className="input py-2">
            <option value="">Any form</option>
            {(templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.title_en}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-sm" htmlFor="fr-status">Status</label>
          <select id="fr-status" name="status" defaultValue={sp.status ?? ""} className="input py-2">
            {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-sm" htmlFor="fr-from">Due from</label>
          <input id="fr-from" name="from" type="date" defaultValue={from ?? ""} className="input py-2" />
        </div>
        <div>
          <label className="label text-sm" htmlFor="fr-to">Due to</label>
          <input id="fr-to" name="to" type="date" defaultValue={to ?? ""} className="input py-2" />
        </div>
        <div className="flex items-end gap-2 md:col-span-3 lg:col-span-4">
          <button className="btn-primary">Search</button>
          <Link href="/admin/form-records" className="btn-ghost">Clear</Link>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        {[["overdue", "Overdue"], ["open", "Not started"], ["submitted", "Waiting for review"], ["returned", "Returned"], ["accepted", "Accepted"]].map(([k, l]) => (
          <span key={k} className="rounded-full border border-line bg-white px-3 py-1"><strong className="tabular-nums">{count(k)}</strong> {l}</span>
        ))}
        <span className="rounded-full px-3 py-1 text-muted">{rows.length} forms{rows.length >= 2000 ? " (first 2,000; narrow the dates)" : ""}</span>
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="px-4 py-3 font-semibold">Form</th><th className="px-4 py-3 font-semibold">Person supported</th><th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Due</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">
                  {r.s ? <Link href={`/admin/review/${r.s.id}`} className="text-teal hover:underline">{r.form_templates?.title_en}</Link> : r.form_templates?.title_en}
                </td>
                <td className="px-4 py-3">
                  {r.individual_id ? <Link href={`/admin/form-records?client=${r.individual_id}`} className="hover:underline">{r.individuals?.full_name}</Link> : <span className="text-muted">Not tied to a person</span>}
                </td>
                <td className="px-4 py-3"><Link href={`/admin/form-records?provider=${r.provider_id}`} className="hover:underline">{r.profiles?.full_name}</Link></td>
                <td className={`px-4 py-3 tabular-nums ${r.state === "overdue" ? "font-semibold text-coral" : ""}`}>{fmtDate(r.due_on)}</td>
                <td className="px-4 py-3 tabular-nums text-muted">{r.s ? fmtDateTime(r.s.submitted_at) : "—"}</td>
                <td className="px-4 py-3">
                  {r.state === "overdue" ? <span className="pill bg-coral-soft text-coral">Overdue</span> : <SubmissionPill status={r.state === "open" ? "todo" : r.state} />}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No forms match.</td></tr>}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-muted">Click a person or provider name to see all of their forms. Opening a submitted form is recorded in the audit log.</p>
    </div>
  );
}
