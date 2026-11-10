import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ClientForm } from "@/components/client-record-bits";

// Clients: the central record that providers, Real Care staff and forms attach to. Clients never sign in.
type SP = { q?: string; status?: string; program?: string; county?: string; provider?: string; staff?: string; sort?: string };
const STATUS_LABEL: Record<string, string> = { prospective: "Prospective", active: "Active", on_hold: "On hold", discharged: "Discharged" };
const STATUS_CLS: Record<string, string> = { prospective: "bg-sky-soft text-navy", active: "bg-green-soft text-green", on_hold: "bg-amber-soft text-amber", discharged: "bg-sand text-muted" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: people }, { data: links }, { data: staffLinks }, { data: forms }, { data: providers }, { data: staff }] = await Promise.all([
    supabase.from("individuals").select("id, full_name, preferred_name, client_number, status, program, county, service_start").order("full_name"),
    supabase.from("provider_individuals").select("individual_id, provider_id, relationship, starts_on, ends_on, profiles(full_name)"),
    supabase.from("individual_staff").select("individual_id, staff_id, role, ends_on, profiles(full_name)").is("ends_on", null),
    supabase.from("assignments").select("individual_id, due_on, submissions(status)").not("individual_id", "is", null),
    supabase.from("profiles").select("id, full_name").eq("role", "provider").order("full_name"),
    supabase.from("profiles").select("id, full_name").in("role", ["staff", "admin"]).order("full_name"),
  ]);
  const cur = (l: { starts_on: string; ends_on: string | null }) => l.starts_on <= today && (!l.ends_on || l.ends_on >= today);
  type Sub = { status: string } | { status: string }[] | null;
  const stats = new Map<string, { overdue: number; waiting: number }>();
  for (const f of forms ?? []) {
    const s0 = (f.submissions as Sub);
    const s = Array.isArray(s0) ? s0[0] : s0;
    const st = stats.get(f.individual_id) ?? { overdue: 0, waiting: 0 };
    if (!s && f.due_on < today) st.overdue++;
    if (s?.status === "submitted") st.waiting++;
    stats.set(f.individual_id, st);
  }
  const q = (sp.q ?? "").trim().toLowerCase();
  let rows = (people ?? []).map((p) => {
    const mine = (links ?? []).filter((l) => l.individual_id === p.id && cur(l));
    const coord = (staffLinks ?? []).filter((l) => l.individual_id === p.id);
    return {
      ...p,
      providers: mine.map((l) => ({ id: l.provider_id, name: (l.profiles as unknown as { full_name: string } | null)?.full_name ?? "", rel: l.relationship as string })),
      staff: coord.map((l) => ({ id: l.staff_id, name: (l.profiles as unknown as { full_name: string } | null)?.full_name ?? "", role: l.role as string })),
      ...(stats.get(p.id) ?? { overdue: 0, waiting: 0 }),
    };
  });
  rows = rows.filter((r) =>
    (!sp.status ? r.status !== "discharged" : sp.status === "all" || r.status === sp.status)
    && (!sp.program || r.program === sp.program) && (!sp.county || r.county === sp.county)
    && (!sp.provider || r.providers.some((p) => p.id === sp.provider)) && (!sp.staff || r.staff.some((s) => s.id === sp.staff))
    && (!q || [r.full_name, r.preferred_name, r.client_number, ...r.providers.map((p) => p.name)].some((v) => v?.toLowerCase().includes(q))));
  const sort = sp.sort ?? "name";
  rows.sort((a, b) => sort === "overdue" ? b.overdue - a.overdue || a.full_name.localeCompare(b.full_name)
    : sort === "county" ? (a.county ?? "").localeCompare(b.county ?? "") || a.full_name.localeCompare(b.full_name)
    : sort === "program" ? (a.program ?? "").localeCompare(b.program ?? "") || a.full_name.localeCompare(b.full_name)
    : a.full_name.localeCompare(b.full_name));
  const uniq = (k: "program" | "county") => [...new Set((people ?? []).map((p) => p[k]).filter(Boolean))].sort() as string[];
  const keep = { ...(sp.q ? { q: sp.q } : {}), ...(sp.status ? { status: sp.status } : {}), ...(sp.program ? { program: sp.program } : {}), ...(sp.county ? { county: sp.county } : {}), ...(sp.provider ? { provider: sp.provider } : {}), ...(sp.staff ? { staff: sp.staff } : {}) };
  const sortHref = (k: string) => `/admin/individuals?${new URLSearchParams({ ...keep, sort: k })}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-muted">Each client is the hub for their providers, Real Care staff, forms and documents. Clients don&apos;t sign in. A provider sees a client&apos;s forms only while their link is current.</p>
      </div>

      <form className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-7" action="/admin/individuals">
        <div className="sm:col-span-3 lg:col-span-2"><label className="label text-sm" htmlFor="c-q">Search</label><input id="c-q" name="q" defaultValue={sp.q} placeholder="Name, client # or provider…" className="input py-2" /></div>
        <div><label className="label text-sm" htmlFor="c-s">Status</label>
          <select id="c-s" name="status" defaultValue={sp.status ?? ""} className="input py-2"><option value="">Current (not discharged)</option><option value="all">All</option>{Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label text-sm" htmlFor="c-p">Program</label>
          <select id="c-p" name="program" defaultValue={sp.program ?? ""} className="input py-2"><option value="">Any</option>{uniq("program").map((v) => <option key={v}>{v}</option>)}</select></div>
        <div><label className="label text-sm" htmlFor="c-c">County</label>
          <select id="c-c" name="county" defaultValue={sp.county ?? ""} className="input py-2"><option value="">Any</option>{uniq("county").map((v) => <option key={v}>{v}</option>)}</select></div>
        <div><label className="label text-sm" htmlFor="c-pr">Provider</label>
          <select id="c-pr" name="provider" defaultValue={sp.provider ?? ""} className="input py-2"><option value="">Any</option>{(providers ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
        <div><label className="label text-sm" htmlFor="c-st">Real Care staff</label>
          <select id="c-st" name="staff" defaultValue={sp.staff ?? ""} className="input py-2"><option value="">Anyone</option>{(staff ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></div>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-7"><button className="btn-primary">Search</button><Link href="/admin/individuals" className="btn-ghost">Clear</Link></div>
      </form>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="text-muted">
              <th className="px-4 py-3 font-semibold"><Link href={sortHref("name")} className="hover:text-ink">Client {sort === "name" && "↓"}</Link></th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold"><Link href={sortHref("program")} className="hover:text-ink">Program {sort === "program" && "↓"}</Link></th>
              <th className="px-4 py-3 font-semibold"><Link href={sortHref("county")} className="hover:text-ink">County {sort === "county" && "↓"}</Link></th>
              <th className="px-4 py-3 font-semibold">Providers</th>
              <th className="px-4 py-3 font-semibold">Real Care staff</th>
              <th className="px-4 py-3 font-semibold"><Link href={sortHref("overdue")} className="hover:text-ink">Forms {sort === "overdue" && "↓"}</Link></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/individuals/${r.id}`} className="font-semibold text-teal hover:underline">{r.full_name}</Link>
                  <span className="block text-muted">{[r.client_number, r.preferred_name && `goes by ${r.preferred_name}`].filter(Boolean).join(" · ")}</span>
                </td>
                <td className="px-4 py-3"><span className={`pill ${STATUS_CLS[r.status] ?? ""}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                <td className="px-4 py-3">{r.program ?? "—"}</td>
                <td className="px-4 py-3">{r.county ?? "—"}</td>
                <td className="px-4 py-3">{r.providers.length ? r.providers.map((p) => <span key={p.id} className="block">{p.name}{p.rel !== "primary" && <span className="text-muted"> ({p.rel})</span>}</span>) : <span className="text-muted">None</span>}</td>
                <td className="px-4 py-3">{r.staff.length ? r.staff.map((s) => <span key={s.id + s.role} className="block">{s.name}<span className="text-muted"> ({s.role})</span></span>) : <span className="text-muted">None</span>}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/form-records?client=${r.id}`} className="hover:underline">
                    {r.overdue > 0 && <span className="mr-1 pill bg-coral-soft text-coral">{r.overdue} overdue</span>}
                    {r.waiting > 0 && <span className="pill bg-teal-soft text-teal">{r.waiting} to review</span>}
                    {r.overdue === 0 && r.waiting === 0 && <span className="text-muted">Up to date</span>}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No clients match.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-lg font-bold">Add a client</h2>
        <p className="mb-4 text-sm text-muted">Demo: made-up names only. Real client records come in after the HIPAA review.</p>
        <ClientForm />
      </section>
    </div>
  );
}
