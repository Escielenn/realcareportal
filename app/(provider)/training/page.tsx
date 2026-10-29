import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { getLang, t, fmtDate, trainingStatus } from "@/lib/i18n";
import { trainingFor, title } from "@/lib/data";
import { ProgressBar, TrainingPill } from "@/components/status";
import { accessFor, daysUntil, programName } from "@/lib/programs";

export default async function TrainingPage() {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const tr = await trainingFor(supabase, profile.id, profile.provider_types);
  const { data: progress } = await supabase.from("lesson_progress").select("lesson_id, cycle_id, lessons(course_id)").eq("provider_id", profile.id).eq("cycle_id", tr.current?.id ?? "00000000-0000-0000-0000-000000000000");
  const started = new Set((progress ?? []).map((p) => (p.lessons as unknown as { course_id: string } | null)?.course_id));
  const acc = await accessFor(supabase, profile.id);
  const hasAccess = acc.canOpen;
  const held = acc.programs.filter((p) => acc.latest.has(p.id));
  const status = trainingStatus(tr.required.length, tr.doneCount, tr.current?.due_on ?? null);
  const courseById = new Map(tr.courses.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">{t(lang, "myTraining")}</h1>
          <TrainingPill status={status} lang={lang} />
        </div>
        {tr.current && (
          <p className="mt-1 text-muted">
            {tr.current.label ?? `${t(lang, "cycle")} ${tr.current.cycle_number}`}: {fmtDate(tr.current.starts_on, lang)} – {fmtDate(tr.current.due_on, lang)}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <ProgressBar value={tr.doneCount} max={tr.required.length} />
          <span className="shrink-0 text-sm font-semibold">{tr.doneCount} {t(lang, "of")} {tr.required.length}</span>
        </div>
      </div>

      <Link href="/programs" className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-teal">
        <div>
          <p className="font-semibold">{lang === "es" ? "Programas y precios" : "Programs & pricing"}</p>
          <p className="text-sm text-muted">
            {held.length === 0
              ? lang === "es" ? "Únase a un programa anual para abrir sus cursos." : "Join a yearly program to open your courses."
              : held.map((p) => {
                  const e = acc.latest.get(p.id)!;
                  const left = daysUntil(e.ends_on);
                  return `${programName(p, lang)}: ${left < 0 ? (lang === "es" ? "terminó " : "ended ") : lang === "es" ? "hasta " : "until "}${fmtDate(e.ends_on, lang)}`;
                }).join(" · ")}
          </p>
        </div>
        <span className="text-sm font-semibold text-teal">{lang === "es" ? "Ver" : "View"} →</span>
      </Link>

      <section>
        <h2 className="mb-3 text-lg font-bold">{t(lang, "required")}</h2>
        {(() => {
          const card = (c: (typeof tr.required)[number]) => {
            const done = tr.doneNow.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/training/${c.slug}`} className={`card flex h-full items-start justify-between gap-3 p-4 hover:border-teal ${done ? "opacity-80" : ""}`}>
                  <div>
                    <p className="font-semibold">{title(c, lang)}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {done ? `${t(lang, "complete")} · ${fmtDate(done.completed_at, lang)}` : started.has(c.id) ? t(lang, "inProgress") : t(lang, "notStarted")}
                    </p>
                  </div>
                  {done ? (
                    <span className="pill bg-green-soft text-green" aria-label={t(lang, "complete")}>✓</span>
                  ) : !hasAccess(c) ? (
                    <span className="pill bg-amber-soft text-amber">🔒 ${(c.price_cents / 100).toFixed(0)}</span>
                  ) : null}
                </Link>
              </li>
            );
          };
          const todo = tr.required.filter((c) => !tr.doneNow.has(c.id)).sort((a, b) => a.sort - b.sort);
          const finished = tr.required.filter((c) => tr.doneNow.has(c.id)).sort((a, b) => a.sort - b.sort);
          return (
            <>
              {todo.length > 0 ? <ul className="grid gap-3 sm:grid-cols-2">{todo.map(card)}</ul>
                : <p className="card p-4 font-semibold text-green">✓ {lang === "es" ? "Terminó todos sus cursos requeridos de este ciclo." : "You finished every required course this cycle."}</p>}
              {finished.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer py-2 font-semibold text-teal">{lang === "es" ? "Terminados" : "Done"} ({finished.length})</summary>
                  <ul className="mt-2 grid gap-3 sm:grid-cols-2">{finished.map(card)}</ul>
                </details>
              )}
            </>
          );
        })()}
      </section>

      {tr.optional.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">{t(lang, "moreTraining")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {tr.optional.map((c) => (
              <li key={c.id}>
                <Link href={`/training/${c.slug}`} className="card block p-4 hover:border-teal">
                  <p className="font-semibold">{title(c, lang)}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{lang === "es" ? c.description_es : c.description_en}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">{t(lang, "history")}</h2>
        <div className="space-y-3">
          {tr.cycles.map((cy) => {
            const items = tr.completions.filter((c) => c.cycle_id === cy.id);
            return (
              <details key={cy.id} className="card p-4" open={cy.id === tr.current?.id ? false : undefined}>
                <summary className="cursor-pointer font-semibold">
                  {cy.label ?? `${t(lang, "cycle")} ${cy.cycle_number}`} · {fmtDate(cy.starts_on, lang)} – {fmtDate(cy.due_on, lang)} · {items.length} {t(lang, "coursesDone")}
                </summary>
                <ul className="mt-3 divide-y divide-line">
                  {items
                    .sort((a, b) => (a.completed_at > b.completed_at ? 1 : -1))
                    .map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span>{courseById.get(c.course_id) && title(courseById.get(c.course_id)!, lang)}</span>
                        <span className="flex items-center gap-3 text-muted">
                          {fmtDate(c.completed_at, lang)}
                          <Link href={`/certificate/${c.id}`} className="font-semibold text-teal hover:underline">{t(lang, "certificate")}</Link>
                        </span>
                      </li>
                    ))}
                </ul>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
