import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { getLang, t, fmtDate, fmtDateTime, trainingStatus, daysBetween, todayDenver } from "@/lib/i18n";
import { trainingFor, title } from "@/lib/data";
import { ProgressBar, TrainingPill, SubmissionPill } from "@/components/status";

export default async function Dashboard() {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const today = todayDenver();

  const [tr, { data: assignments }, { data: announcements }, { data: lastMsg }] = await Promise.all([
    trainingFor(supabase, profile.id, profile.provider_types),
    supabase.from("assignments").select("id, due_on, individual_id, form_templates(title_en, title_es), individuals(full_name), submissions(id, status, submitted_at)").eq("provider_id", profile.id).order("due_on"),
    supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(3),
    supabase.from("messages").select("body, created_at, sender_id").eq("provider_id", profile.id).order("created_at", { ascending: false }).limit(1),
  ]);

  type A = { id: string; due_on: string; form_templates: { title_en: string; title_es: string } | null; individuals: { full_name: string } | null; submissions: { id: string; status: string; submitted_at: string } | { id: string; status: string; submitted_at: string }[] | null };
  const list = ((assignments ?? []) as unknown as A[]).map((a) => {
    const s = Array.isArray(a.submissions) ? a.submissions[0] : a.submissions;
    return { ...a, sub: s ?? null };
  });
  const returned = list.filter((a) => a.sub?.status === "returned");
  const todo = list.filter((a) => !a.sub);
  const overdueForms = todo.filter((a) => a.due_on < today);
  const dueForms = todo.filter((a) => a.due_on >= today);
  const recent = list.filter((a) => a.sub && a.sub.status !== "returned").sort((a, b) => (b.sub!.submitted_at > a.sub!.submitted_at ? 1 : -1)).slice(0, 3);

  const status = trainingStatus(tr.required.length, tr.doneCount, tr.current?.due_on ?? null);
  const nextCourse = tr.required.find((c) => !tr.doneNow.has(c.id));
  const daysLeft = tr.current ? daysBetween(today, tr.current.due_on) : null;
  const firstName = profile.full_name.split(" ")[0];
  const myAnnouncements = (announcements ?? []).filter((a) => !a.audience?.length || a.audience.some((x: string) => profile.provider_types.includes(x)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{t(lang, "hello")}, {firstName}</h1>
        <p className="mt-1 text-muted">{t(lang, "dashIntro")}</p>
      </div>

      {(returned.length > 0 || overdueForms.length > 0 || status === "overdue") && (
        <section className="card border-coral/30 bg-coral-soft/40 p-5">
          <h2 className="mb-3 font-bold text-coral">{t(lang, "needsAttention")}</h2>
          <ul className="space-y-2">
            {returned.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                <div>
                  <p className="font-semibold">{a.form_templates && title(a.form_templates, lang)}{a.individuals ? ` · ${a.individuals.full_name}` : ""}</p>
                  <p className="text-sm text-coral">{t(lang, "returnedForm")}</p>
                </div>
                <Link href={`/forms/${a.id}`} className="btn-danger shrink-0">{t(lang, "fixNow")}</Link>
              </li>
            ))}
            {overdueForms.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-3">
                <div>
                  <p className="font-semibold">{a.form_templates && title(a.form_templates, lang)}{a.individuals ? ` · ${a.individuals.full_name}` : ""}</p>
                  <p className="text-sm text-coral">{t(lang, "overdue")} · {fmtDate(a.due_on, lang)}</p>
                </div>
                <Link href={`/forms/${a.id}`} className="btn-ghost shrink-0">{t(lang, "start")}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{t(lang, "myTraining")}</h2>
            <TrainingPill status={status} lang={lang} />
          </div>
          <p className="text-3xl font-bold">{tr.doneCount}<span className="text-lg font-semibold text-muted"> / {tr.required.length} {t(lang, "coursesDone")}</span></p>
          <div className="my-3"><ProgressBar value={tr.doneCount} max={tr.required.length} /></div>
          {tr.current && (
            <p className="text-sm text-muted">
              {t(lang, "dueBy")} <strong className="text-ink">{fmtDate(tr.current.due_on, lang)}</strong>
              {daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && <> · {lang === "es" ? `faltan ${daysLeft} días` : `${daysLeft} days left`}</>}
            </p>
          )}
          {nextCourse ? (
            <Link href={`/training/${nextCourse.slug}`} className="btn-primary mt-4 w-full">
              {t(lang, "continueTraining")}: {title(nextCourse, lang)}
            </Link>
          ) : (
            <Link href="/training" className="btn-ghost mt-4 w-full">{t(lang, "training")}</Link>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">{t(lang, "dueSoon")}</h2>
          {dueForms.length === 0 ? (
            <p className="text-muted">{t(lang, "allCaughtUp")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {dueForms.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.form_templates && title(a.form_templates, lang)}</p>
                    <p className="text-sm text-muted">{a.individuals ? `${a.individuals.full_name} · ` : ""}{t(lang, "due")} {fmtDate(a.due_on, lang)}</p>
                  </div>
                  <Link href={`/forms/${a.id}`} className="btn-ghost shrink-0 px-3 py-1.5 text-sm">{t(lang, "start")}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">{t(lang, "recentlySubmitted")}</h2>
          <ul className="divide-y divide-line">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/forms/${a.id}`} className="min-w-0 hover:underline">
                  <p className="truncate font-semibold">{a.form_templates && title(a.form_templates, lang)}</p>
                  <p className="text-sm text-muted">{a.individuals?.full_name ?? ""}</p>
                </Link>
                <SubmissionPill status={a.sub!.status} lang={lang} />
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">{t(lang, "messages")}</h2>
            <Link href="/messages" className="text-sm font-semibold text-teal hover:underline">{t(lang, "open")} →</Link>
          </div>
          {lastMsg?.[0] ? (
            <div className="rounded-xl bg-sand p-3">
              <p className="text-xs font-semibold text-muted">
                {lastMsg[0].sender_id === profile.id ? t(lang, "you") : t(lang, "realCareStaff")} · {fmtDateTime(lastMsg[0].created_at, lang)}
              </p>
              <p className="mt-1 line-clamp-3">{lastMsg[0].body}</p>
            </div>
          ) : (
            <p className="text-muted">{t(lang, "messagesIntro")}</p>
          )}
        </section>
      </div>

      {myAnnouncements.length > 0 && (
        <section>
          <h2 className="mb-3 font-bold">{t(lang, "announcements")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {myAnnouncements.map((a) => (
              <article key={a.id} className="card p-4">
                <p className="text-xs font-semibold text-muted">{fmtDate(a.created_at, lang)}</p>
                <h3 className="mt-1 font-semibold">{lang === "es" ? a.title_es : a.title_en}</h3>
                <p className="mt-1 text-muted">{lang === "es" ? a.body_es : a.body_en}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
