import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fmtDate } from "@/lib/i18n";
import { money, today } from "@/lib/programs";
import { ProgramForm, GrantProgramForm } from "@/components/program-bits";

const METHOD: Record<string, string> = { wix: "Wix (imported)", demo_checkout: "Card (demo)", stripe: "Card", paid_by_real_care: "Paid by Real Care" };

export default async function ProgramDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: program } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (!program) notFound();
  const [{ data: courses }, { data: links }, { data: ents }, { data: people }] = await Promise.all([
    supabase.from("courses").select("id, title_en, published").order("sort"),
    supabase.from("program_courses").select("course_id").eq("program_id", id),
    supabase.from("entitlements").select("id, provider_id, starts_on, ends_on, orders(method, amount_cents, status)").eq("program_id", id).order("ends_on", { ascending: false }),
    supabase.from("profiles").select("id, full_name, active").eq("role", "provider").order("full_name"),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const t = today();
  // One row per provider: their latest term.
  const latest = new Map<string, NonNullable<typeof ents>[number]>();
  for (const e of ents ?? []) if (!latest.has(e.provider_id)) latest.set(e.provider_id, e);
  const members = [...latest.values()].sort((a, b) => (a.ends_on > b.ends_on ? 1 : -1));
  const activeCount = members.filter((m) => m.ends_on >= t).length;

  return (
    <div className="space-y-6">
      <Link href="/admin/programs" className="text-sm font-semibold text-teal hover:underline">← Programs</Link>
      <div>
        <h1 className="text-2xl font-bold">{program.name_en}</h1>
        <p className="text-muted">{program.price_cents ? money(program.price_cents) : "Free"} per {program.duration_days === 365 ? "12 months" : `${program.duration_days} days`} · {(links ?? []).length} courses · {activeCount} active members</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Settings</h2>
          <ProgramForm program={program} courses={(courses ?? []).map((c) => ({ id: c.id, title: c.title_en, note: c.published ? undefined : "Draft course" }))} included={(links ?? []).map((l) => l.course_id)} />
        </section>
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-1 font-bold">Give this program</h2>
            <p className="mb-4 text-sm text-muted">Real Care pays. If the provider already has it, the new term starts after the current one ends.</p>
            <GrantProgramForm programId={program.id} providers={(people ?? []).filter((p) => p.active).map((p) => ({ id: p.id, name: p.full_name }))} defaultDays={program.duration_days} />
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Members</h2>
            <ul className="divide-y divide-line text-sm">
              {members.map((m) => {
                const o = m.orders as unknown as { method: string; amount_cents: number; status: string } | null;
                const ended = m.ends_on < t;
                const soon = !ended && Date.parse(m.ends_on) - Date.parse(t) <= 30 * 86_400_000;
                return (
                  <li key={m.id} className="flex items-start justify-between gap-2 py-2">
                    <span>
                      <Link href={`/admin/providers/${m.provider_id}`} className="font-medium text-teal hover:underline">{names.get(m.provider_id) ?? "Provider"}</Link>
                      <span className="block text-xs text-muted">{o ? `${METHOD[o.method] ?? o.method}${o.amount_cents ? ` · ${money(o.amount_cents)}` : ""}${o.status === "refunded" ? " · refunded" : ""}` : ""}</span>
                    </span>
                    <span className={`shrink-0 tabular-nums ${ended ? "text-muted" : soon ? "font-semibold text-amber" : "text-green"}`}>{ended ? "ended" : "until"} {fmtDate(m.ends_on)}</span>
                  </li>
                );
              })}
              {members.length === 0 && <li className="py-2 text-muted">No members yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
