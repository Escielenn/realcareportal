import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { trainingFor } from "@/lib/data";
import { fmtDate, fmtDateTime, providerTypeLabel, trainingStatus } from "@/lib/i18n";
import { TrainingPill, SubmissionPill } from "@/components/status";
import { MessageComposer, RenewProviderButton } from "@/components/client-bits";
import { MarkCompleteForm, GrantAccessForm } from "@/components/admin-bits";

export default async function ProviderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile: me } = await requireStaff();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", id).eq("role", "provider").maybeSingle();
  if (!p) notFound();
  await supabase.rpc("log_event", { p_action: "view_provider", p_table: "profiles", p_record: id });

  const [tr, { data: links }, { data: assignments }, { data: msgs }, { data: ents }, { data: notes }] = await Promise.all([
    trainingFor(supabase, id, p.provider_types),
    supabase.from("provider_individuals").select("starts_on, ends_on, individuals(id, full_name)").eq("provider_id", id),
    supabase.from("assignments").select("id, due_on, form_templates(title_en), individuals(full_name), submissions(id, status, submitted_at)").eq("provider_id", id).order("due_on", { ascending: false }),
    supabase.from("messages").select("id, body, created_at, sender_id").eq("provider_id", id).order("created_at"),
    supabase.from("entitlements").select("id, course_id, starts_on, ends_on, courses(title_en)").eq("provider_id", id).order("ends_on", { ascending: false }),
    supabase.from("completions").select("course_id, note, source, completed_at").eq("provider_id", id).neq("source", "portal"),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const status = trainingStatus(tr.required.length, tr.doneCount, tr.current?.due_on ?? null);
  const shown = tr.cycles.slice(0, 3);
  const byCycle = new Map<string, Map<string, { id: string; completed_at: string; source: string }>>();
  for (const c of tr.completions) {
    if (!byCycle.has(c.cycle_id)) byCycle.set(c.cycle_id, new Map());
    byCycle.get(c.cycle_id)!.set(c.course_id, c);
  }
  type A = { id: string; due_on: string; form_templates: { title_en: string }; individuals: { full_name: string } | null; submissions: { id: string; status: string; submitted_at: string } | { id: string; status: string; submitted_at: string }[] | null };

  return (
    <div className="space-y-6">
      <Link href="/admin/providers" className="text-sm font-semibold text-teal hover:underline">← Providers</Link>
      <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <h1 className="text-2xl font-bold">{p.full_name}</h1>
          <p className="text-muted">{p.email} · {p.provider_types.map((t: string) => providerTypeLabel[t]?.en ?? t).join(", ")} · {p.locale === "es" ? "Prefers Spanish" : "Prefers English"}</p>
          <p className="text-sm text-muted">Hired {fmtDate(p.hire_date)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <TrainingPill status={status} />
          <RenewProviderButton providerId={p.id} />
        </div>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Training by cycle</h2>
          <Link href={`/admin/transcripts?provider=${p.id}`} className="text-sm font-semibold text-teal hover:underline">Print transcript →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="py-2 pr-3 font-semibold">Required course</th>
                {shown.map((cy) => (
                  <th key={cy.id} className="px-3 py-2 font-semibold">
                    {cy.label ?? `Cycle ${cy.cycle_number}`}
                    <span className="block font-normal">{fmtDate(cy.starts_on)} – {fmtDate(cy.due_on)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tr.required.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 pr-3 font-medium">{c.title_en}</td>
                  {shown.map((cy, i) => {
                    const done = byCycle.get(cy.id)?.get(c.id);
                    return (
                      <td key={cy.id} className="px-3 py-2">
                        {done ? (
                          <Link href={`/certificate/${done.id}`} className="text-green hover:underline">✓ {fmtDate(done.completed_at)}</Link>
                        ) : (
                          <span className={i === 0 ? "font-semibold text-coral" : "text-muted"}>{i === 0 ? "Not done" : "—"}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line font-semibold">
              <tr>
                <td className="py-2 pr-3">Completed</td>
                {shown.map((cy) => (
                  <td key={cy.id} className="px-3 py-2">{tr.required.filter((c) => byCycle.get(cy.id)?.has(c.id)).length} / {tr.required.length}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">Each cycle keeps its own completions. Opening a new cycle never changes earlier columns.</p>
        {(notes ?? []).filter((n) => n.source === "staff_override").length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {(notes ?? []).filter((n) => n.source === "staff_override").map((n, i) => (
              <li key={i} className="rounded-lg bg-amber-soft px-3 py-1.5">Marked complete by staff: <strong>{tr.courses.find((c) => c.id === n.course_id)?.title_en}</strong> on {fmtDate(n.completed_at)}. Reason: {n.note}</li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 font-bold">Record training done elsewhere</h2>
          <p className="mb-4 text-sm text-muted">For in-person classes or records from another agency. The reason is saved and shown on the record.</p>
          <MarkCompleteForm providerId={p.id} courses={tr.required.filter((c) => !tr.doneNow.has(c.id)).map((c) => ({ id: c.id, title: c.title_en }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Course access</h2>
          <ul className="mb-4 divide-y divide-line text-sm">
            {(ents ?? []).map((e) => {
              const active = e.starts_on <= today && e.ends_on >= today;
              return (
                <li key={e.id} className="flex items-center justify-between py-1.5">
                  <span>{(e.courses as unknown as { title_en: string } | null)?.title_en ?? "All-Access (14 courses)"}</span>
                  <span className={active ? "text-green" : "text-muted"}>{active ? "until" : "ended"} {fmtDate(e.ends_on)}</span>
                </li>
              );
            })}
            {(ents ?? []).length === 0 && <li className="py-1.5 text-muted">No paid access.</li>}
          </ul>
          <GrantAccessForm providerId={p.id} courses={tr.courses.map((c) => ({ id: c.id, title: c.title_en }))} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">People supported</h2>
          <ul className="divide-y divide-line">
            {(links ?? []).map((l, i) => {
              const ind = l.individuals as unknown as { id: string; full_name: string };
              const ended = l.ends_on && l.ends_on < new Date().toISOString().slice(0, 10);
              return (
                <li key={i} className="flex items-center justify-between py-2">
                  <span className={ended ? "text-muted line-through" : "font-medium"}>{ind?.full_name}</span>
                  <span className="text-sm text-muted">{fmtDate(l.starts_on)} – {l.ends_on ? fmtDate(l.ends_on) : "present"}{ended ? " · access removed" : ""}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">Forms</h2>
          <ul className="divide-y divide-line">
            {((assignments ?? []) as unknown as A[]).map((a) => {
              const s = Array.isArray(a.submissions) ? a.submissions[0] : a.submissions;
              return (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {s ? <Link href={`/admin/review/${s.id}`} className="font-medium text-teal hover:underline">{a.form_templates.title_en}</Link> : <span className="font-medium">{a.form_templates.title_en}</span>}
                    <span className="text-sm text-muted">{a.individuals ? ` · ${a.individuals.full_name}` : ""} · due {fmtDate(a.due_on)}</span>
                  </span>
                  <SubmissionPill status={s?.status ?? "todo"} />
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="card p-5" id="messages">
        <h2 className="mb-3 font-bold">Messages</h2>
        <div className="space-y-3">
          {(msgs ?? []).map((m) => {
            const fromProvider = m.sender_id === p.id;
            return (
              <div key={m.id} className={`flex ${fromProvider ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${fromProvider ? "bg-sand" : "bg-teal text-white"}`}>
                  <p className={`text-xs font-semibold ${fromProvider ? "text-muted" : "text-white/75"}`}>{fromProvider ? p.full_name : m.sender_id === me.id ? "You" : "Real Care staff"} · {fmtDateTime(m.created_at)}</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <MessageComposer providerId={p.id} placeholder={`Reply to ${p.full_name.split(" ")[0]}`} sendLabel="Send" />
        </div>
      </section>
    </div>
  );
}
