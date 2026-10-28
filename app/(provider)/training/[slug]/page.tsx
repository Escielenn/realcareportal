import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { getLang, t, fmtDate } from "@/lib/i18n";
import { title } from "@/lib/data";
import { MountainBand } from "@/components/mountains";
import { Paywall } from "@/components/provider-bits";

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const { data: course } = await supabase.from("courses").select("*").eq("slug", slug).single();
  if (!course) notFound();
  const [{ data: lessons }, { data: cycleId }, { data: access }] = await Promise.all([
    supabase.from("lessons").select("id, sort, kind, title_en, title_es").eq("course_id", course.id).order("sort"),
    supabase.rpc("current_cycle_id", { p_provider: profile.id }),
    supabase.rpc("has_course_access", { p_provider: profile.id, p_course: course.id }),
  ]);
  const [{ data: progress }, { data: completion }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id").eq("provider_id", profile.id).eq("cycle_id", cycleId),
    supabase.from("completions").select("id, completed_at, score").eq("provider_id", profile.id).eq("course_id", course.id).eq("cycle_id", cycleId).maybeSingle(),
  ]);
  const courseLessons = new Set((lessons ?? []).map((l) => l.id));
  const done = new Set((progress ?? []).map((p) => p.lesson_id).filter((id) => courseLessons.has(id)));
  const next = (lessons ?? []).find((l) => !done.has(l.id)) ?? (lessons ?? [])[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/training" className="text-sm font-semibold text-teal hover:underline">← {t(lang, "training")}</Link>
      <div className="card overflow-hidden">
        <MountainBand photo={course.sort % 2 ? 2 : 1} className="px-5 pt-6 pb-10">
          <h1 className="text-2xl font-semibold md:text-3xl">{title(course, lang)}</h1>
          <p className="mt-2 text-white/85">{lang === "es" ? course.description_es : course.description_en}</p>
        </MountainBand>
        {completion ? (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-green-soft px-5 py-4">
            <p className="font-semibold text-green">✓ {t(lang, "complete")} · {fmtDate(completion.completed_at, lang)}{completion.score ? ` · ${completion.score}%` : ""}</p>
            <Link href={`/certificate/${completion.id}`} className="btn-ghost">{t(lang, "viewCertificate")}</Link>
          </div>
        ) : !access ? (
          <Paywall courseId={course.id} priceCents={course.price_cents} accessDays={course.access_days} inAllAccess={course.in_all_access} lang={lang} />
        ) : null}
        <div className="p-5">
          <h2 className="mb-3 font-bold">{t(lang, "lessons")}</h2>
          <ol className="space-y-2">
            {(lessons ?? []).map((l, i) => (
              <li key={l.id}>
                <Link href={`/training/${slug}/${l.id}`} className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-teal">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done.has(l.id) ? "bg-green text-white" : "bg-sand text-muted"}`}>
                    {done.has(l.id) ? "✓" : i + 1}
                  </span>
                  <span className="flex-1 font-medium">{title(l, lang)}</span>
                  <span className="text-xs font-semibold text-muted uppercase">{l.kind === "quiz" ? (lang === "es" ? "Prueba" : "Quiz") : l.kind === "video" ? "Video" : lang === "es" ? "Lectura" : "Reading"}</span>
                </Link>
              </li>
            ))}
          </ol>
          {!completion && access && next && (
            <Link href={`/training/${slug}/${next.id}`} className="btn-primary mt-5 w-full">
              {done.size ? t(lang, "continueTraining") : t(lang, "start")} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
