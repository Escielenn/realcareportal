import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { providerRows } from "@/lib/admin-data";
import { fmtDate, fmtDateTime, todayDenver, daysBetween } from "@/lib/i18n";
import { RenewalRunner } from "@/components/client-bits";
import { TrainingPill } from "@/components/status";

export default async function AdminHome() {
  const { supabase, profile } = await requireStaff();
  const today = todayDenver();
  const [rows, { data: queue }, { data: recentMsgs }] = await Promise.all([
    providerRows(supabase),
    supabase.from("submissions").select("id, submitted_at, provider_id, assignments(form_templates(slug, title_en))").eq("status", "submitted").order("submitted_at"),
    supabase.from("messages").select("id, provider_id, sender_id, body, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const names = new Map(rows.map((r) => [r.provider_id, r.full_name]));
  type Q = { id: string; submitted_at: string; provider_id: string; assignments: { form_templates: { slug: string; title_en: string } } };
  const q = (queue ?? []) as unknown as Q[];
  const incidents = q.filter((x) => x.assignments?.form_templates?.slug === "incident-report");
  const overdue = rows.filter((r) => r.status === "overdue");
  const dueSoon = rows.filter((r) => r.status === "due_soon");
  const complete = rows.filter((r) => r.status === "complete");
  const renewingThisWeek = rows.filter((r) => r.due_on && daysBetween(today, r.due_on) >= 0 && daysBetween(today, r.due_on) <= 7);
  // Latest message per provider where the provider spoke last = waiting on staff.
  const lastByProvider = new Map<string, { sender_id: string; created_at: string }>();
  for (const m of recentMsgs ?? []) if (!lastByProvider.has(m.provider_id)) lastByProvider.set(m.provider_id, m);
  const unanswered = [...lastByProvider.entries()].filter(([pid, m]) => m.sender_id === pid);

  const stat = (label: string, value: number, href: string, tone = "text-ink") => (
    <Link href={href} className="card block p-4 hover:border-teal">
      <p className={`text-3xl font-bold ${tone}`}>{value}</p>
      <p className="text-sm font-medium text-muted">{label}</p>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Good {Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Denver" })) < 12 ? "morning" : "afternoon"}, {profile.full_name.split(" ")[0]}</h1>
        <p className="text-muted">{fmtDate(today)} · {rows.length} providers</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stat("Forms waiting for review", q.length, "/admin/review")}
        {stat("Incident reports waiting", incidents.length, "/admin/review", incidents.length ? "text-coral" : "text-ink")}
        {stat("Training overdue", overdue.length, "/admin/providers?status=overdue", overdue.length ? "text-coral" : "text-ink")}
        {stat("Due in 30 days", dueSoon.length, "/admin/providers?status=due_soon", "text-amber")}
        {stat("Unanswered messages", unanswered.length, "/admin/messages")}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 font-bold">Annual training renewal</h2>
          <p className="mb-4 text-sm text-muted">
            Opens each provider&apos;s next cycle on their own due date. Completions are never reset or deleted, so last year stays on the transcript.
            {renewingThisWeek.length > 0 && <> This week: <strong className="text-ink">{renewingThisWeek.map((r) => `${r.full_name} (${fmtDate(r.due_on)})`).join(", ")}</strong>.</>}
          </p>
          <RenewalRunner defaultDate={renewingThisWeek[0]?.due_on ?? today} />
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Oldest in the review queue</h2>
            <Link href="/admin/review" className="text-sm font-semibold text-teal hover:underline">Open queue →</Link>
          </div>
          <ul className="divide-y divide-line">
            {q.slice(0, 5).map((x) => (
              <li key={x.id}>
                <Link href={`/admin/review/${x.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:underline">
                  <span>
                    <span className="font-semibold">{x.assignments.form_templates.title_en}</span>
                    <span className="text-muted"> · {names.get(x.provider_id)}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    {x.assignments.form_templates.slug === "incident-report" && <span className="pill bg-coral-soft text-coral">Incident</span>}
                    {fmtDateTime(x.submitted_at)}
                  </span>
                </Link>
              </li>
            ))}
            {q.length === 0 && <li className="py-2 text-muted">Nothing waiting.</li>}
          </ul>
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Training compliance at a glance</h2>
          <span className="text-sm text-muted">{complete.length} of {rows.length} complete for their current cycle</span>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...overdue, ...dueSoon].map((r) => (
            <li key={r.provider_id}>
              <Link href={`/admin/providers/${r.provider_id}`} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 hover:border-teal">
                <span>
                  <span className="block font-semibold">{r.full_name}</span>
                  <span className="text-sm text-muted">{r.done_count}/{r.required_count} · due {fmtDate(r.due_on)}</span>
                </span>
                <TrainingPill status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
