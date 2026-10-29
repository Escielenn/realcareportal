import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { money, today } from "@/lib/programs";

const TYPE: Record<string, string> = { host_home: "Host Home", family_caregiver: "Family Caregiver", scc_dsp: "SCC / DSP", nmt: "NMT" };

export default async function ProgramsAdmin() {
  const { supabase } = await requireStaff();
  const [{ data: programs }, { data: links }, { data: ents }] = await Promise.all([
    supabase.from("programs").select("*").order("sort"),
    supabase.from("program_courses").select("program_id"),
    supabase.from("entitlements").select("program_id, provider_id, starts_on, ends_on").not("program_id", "is", null),
  ]);
  const t = today();
  const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const stats = (id: string) => {
    const mine = (ents ?? []).filter((e) => e.program_id === id);
    const active = new Set(mine.filter((e) => e.starts_on <= t && e.ends_on >= t).map((e) => e.provider_id));
    const renewed = new Set(mine.filter((e) => e.starts_on > t).map((e) => e.provider_id));
    const ending = new Set(mine.filter((e) => e.starts_on <= t && e.ends_on >= t && e.ends_on <= soon && !renewed.has(e.provider_id)).map((e) => e.provider_id));
    return { active: active.size, ending: ending.size };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Programs</h1>
          <p className="text-muted">Yearly packages providers opt into, like the All-Access Package. Each program opens a set of courses for its term.</p>
        </div>
        <Link href="/admin/programs/new" className="btn-primary">New program</Link>
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-sand/60 text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Program</th><th className="px-4 py-3 font-semibold">Price</th><th className="px-4 py-3 font-semibold">Courses</th>
              <th className="px-4 py-3 font-semibold">Who can join</th><th className="px-4 py-3 text-right font-semibold">Active members</th>
              <th className="px-4 py-3 text-right font-semibold">Ending in 30 days</th><th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(programs ?? []).map((p) => {
              const s = stats(p.id);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3"><Link href={`/admin/programs/${p.id}`} className="font-semibold text-teal hover:underline">{p.name_en}</Link>{p.is_example && <span className="ml-2 pill bg-sand text-muted">Example</span>}</td>
                  <td className="px-4 py-3 tabular-nums">{p.price_cents ? money(p.price_cents) : "Free"} / {p.duration_days === 365 ? "12 months" : `${p.duration_days} days`}</td>
                  <td className="px-4 py-3 tabular-nums">{(links ?? []).filter((l) => l.program_id === p.id).length}</td>
                  <td className="px-4 py-3">{p.audience.length ? p.audience.map((a: string) => TYPE[a] ?? a).join(", ") : "Everyone"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.active}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${s.ending ? "font-semibold text-amber" : ""}`}>{s.ending}</td>
                  <td className="px-4 py-3">{p.active ? <span className="pill bg-green-soft text-green">Offered</span> : <span className="pill bg-sand text-muted">Hidden</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="text-sm text-muted">Providers get in-app reminders 30 and 7 days before their term ends, and one the day after it ends. Renewing early adds a full term after the current end date.</p>
    </div>
  );
}
