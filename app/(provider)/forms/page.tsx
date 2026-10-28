import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { getLang, t, fmtDate, todayDenver } from "@/lib/i18n";
import { title } from "@/lib/data";
import { SubmissionPill } from "@/components/status";

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const today = todayDenver();
  // Assignments for people this provider no longer supports are filtered by the individual's RLS (join returns null).
  const { data } = await supabase
    .from("assignments")
    .select("id, due_on, individual_id, form_templates(title_en, title_es), individuals(full_name), submissions(status, submitted_at)")
    .eq("provider_id", profile.id)
    .order("due_on");
  type Row = { id: string; due_on: string; individual_id: string | null; form_templates: { title_en: string; title_es: string }; individuals: { full_name: string } | null; submissions: { status: string; submitted_at: string } | { status: string; submitted_at: string }[] | null };
  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => !r.individual_id || r.individuals)
    .map((r) => ({ ...r, sub: Array.isArray(r.submissions) ? r.submissions[0] : r.submissions }));

  const { data: selfStart } = await supabase.from("form_templates").select("id, title_en, title_es").eq("active", true).eq("self_start", true).order("title_en");

  const groups = [
    { key: "returned", label: t(lang, "returnedForm"), rows: rows.filter((r) => r.sub?.status === "returned") },
    { key: "todo", label: t(lang, "toDo"), rows: rows.filter((r) => !r.sub) },
    { key: "submitted", label: t(lang, "submittedWaiting"), rows: rows.filter((r) => r.sub?.status === "submitted") },
    { key: "accepted", label: t(lang, "accepted"), rows: rows.filter((r) => r.sub?.status === "accepted") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold text-navy">{t(lang, "forms")}</h1>
      {(selfStart ?? []).length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-semibold">{lang === "es" ? "Empezar un formulario" : "Start a form"}</h2>
          <div className="flex flex-wrap gap-2">
            {(selfStart ?? []).map((f) => (
              <Link key={f.id} href={`/forms/start/${f.id}`} className="btn-ghost py-1.5 text-sm">+ {lang === "es" ? f.title_es : f.title_en}</Link>
            ))}
          </div>
        </section>
      )}
      {done && <p role="status" className="rounded-xl bg-green-soft px-4 py-3 font-semibold text-green">✓ {t(lang, "thanksSubmitted")}</p>}
      {groups.map((g) =>
        g.rows.length === 0 && g.key !== "todo" ? null : (
          <section key={g.key}>
            <h2 className={`mb-2 font-bold ${g.key === "returned" ? "text-coral" : ""}`}>{g.label} <span className="text-muted">({g.rows.length})</span></h2>
            {g.rows.length === 0 ? (
              <p className="card p-4 text-muted">{t(lang, "noForms")}</p>
            ) : (
              <ul className="card divide-y divide-line">
                {g.rows.map((r) => (
                  <li key={r.id}>
                    <Link href={`/forms/${r.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-sand/60">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{title(r.form_templates, lang)}</p>
                        <p className="text-sm text-muted">
                          {r.individuals ? `${r.individuals.full_name} · ` : ""}
                          {r.sub ? `${t(lang, "submittedOn")} ${fmtDate(r.sub.submitted_at, lang)}` : `${r.due_on < today ? t(lang, "overdue") : t(lang, "due")} ${fmtDate(r.due_on, lang)}`}
                        </p>
                      </div>
                      <SubmissionPill status={r.sub?.status ?? "todo"} lang={lang} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ),
      )}
      <p className="text-sm text-muted">{t(lang, "noLongerLinked")}</p>
    </div>
  );
}
