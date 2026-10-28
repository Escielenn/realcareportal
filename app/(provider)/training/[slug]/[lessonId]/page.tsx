import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { title } from "@/lib/data";
import { Markdown } from "@/lib/md";
import { MarkReadButton } from "@/components/client-bits";
import { QuizRunner } from "./quiz-runner";
import { VideoLesson } from "@/components/provider-bits";
import { LinkedVideo } from "@/components/linked-video";

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const { data: course } = await supabase.from("courses").select("id, slug, title_en, title_es").eq("slug", slug).single();
  if (!course) notFound();
  const { data: access } = await supabase.rpc("has_course_access", { p_provider: profile.id, p_course: course.id });
  if (!access) redirect(`/training/${slug}`);
  const { data: lessons } = await supabase.from("lessons").select("id, sort, kind, title_en, title_es, body_en, body_es, video_url, video_seconds, video_source").eq("course_id", course.id).order("sort");
  const idx = (lessons ?? []).findIndex((l) => l.id === lessonId);
  if (idx < 0) notFound();
  const lesson = lessons![idx];
  const next = lessons![idx + 1];
  const nextHref = next ? `/training/${slug}/${next.id}` : `/training/${slug}`;

  const linked = lesson.kind === "video" && lesson.video_source === "embed" && !!lesson.video_url;
  let linkedDone = false;
  if (linked) {
    const { data: cycleId } = await supabase.rpc("current_cycle_id", { p_provider: profile.id });
    const { data: lp } = await supabase.from("lesson_progress").select("lesson_id").eq("provider_id", profile.id).eq("lesson_id", lesson.id).eq("cycle_id", cycleId).maybeSingle();
    linkedDone = !!lp;
  }
  const body = (lang === "es" ? lesson.body_es : lesson.body_en) as string | null;

  let video: { src: string; watched: number; complete: boolean } | null = null;
  if (lesson.kind === "video" && lesson.video_url && !linked) {
    let src = lesson.video_url as string;
    if (!src.startsWith("/") && !src.startsWith("http")) {
      const { data: signed } = await supabase.storage.from("training-media").createSignedUrl(src, 60 * 60 * 3);
      src = signed?.signedUrl ?? "";
    }
    const { data: cycleId } = await supabase.rpc("current_cycle_id", { p_provider: profile.id });
    const [{ data: vp }, { data: lp }] = await Promise.all([
      supabase.from("video_progress").select("watched_seconds").eq("provider_id", profile.id).eq("lesson_id", lesson.id).eq("cycle_id", cycleId).maybeSingle(),
      supabase.from("lesson_progress").select("lesson_id").eq("provider_id", profile.id).eq("lesson_id", lesson.id).eq("cycle_id", cycleId).maybeSingle(),
    ]);
    video = { src, watched: Number(vp?.watched_seconds ?? 0), complete: !!lp };
  }

  let questions: { id: string; prompt: string; options: string[] }[] = [];
  if (lesson.kind === "quiz") {
    const { data } = await supabase.from("quiz_questions").select("id, sort, prompt_en, prompt_es, options_en, options_es").eq("lesson_id", lesson.id).order("sort");
    questions = (data ?? []).map((q) => ({ id: q.id, prompt: lang === "es" ? q.prompt_es : q.prompt_en, options: (lang === "es" ? q.options_es : q.options_en) as string[] }));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href={`/training/${slug}`} className="text-sm font-semibold text-teal hover:underline">← {title(course, lang)}</Link>
      <div className="flex items-center gap-2 text-sm text-muted">
        {(lessons ?? []).map((l, i) => (
          <span key={l.id} className={`h-1.5 flex-1 rounded-full ${i <= idx ? "bg-teal" : "bg-line"}`} />
        ))}
      </div>
      <article className="card p-5 md:p-7">
        <p className="text-sm font-semibold text-muted">{lang === "es" ? "Lección" : "Lesson"} {idx + 1} {t(lang, "of")} {lessons!.length}</p>
        <h1 className="mt-1 mb-4 text-2xl font-bold">{title(lesson, lang)}</h1>
        {linked ? (
          <>
            <LinkedVideo href={lesson.video_url as string} lang={lang} minutes={lesson.video_seconds ? Math.round(lesson.video_seconds / 60) : null} />
            {body && (
              <details className="mt-5 rounded-xl border border-line">
                <summary className="cursor-pointer px-4 py-3 font-semibold text-navy">{lang === "es" ? "Leer la transcripción" : "Read the transcript"}</summary>
                <div className="max-h-[28rem] overflow-y-auto border-t border-line px-4 py-3"><Markdown text={body} /></div>
              </details>
            )}
            <div className="mt-6 border-t border-line pt-5">
              {linkedDone ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-green">✓ {lang === "es" ? "Video completado" : "Video complete"}</p>
                  <Link href={nextHref} className="btn-primary">{lang === "es" ? "Siguiente" : "Next"} →</Link>
                </div>
              ) : (
                <MarkReadButton lessonId={lesson.id} lang={lang} label={lang === "es" ? "Ya vi el video completo" : "I watched the whole video"} nextHref={nextHref} />
              )}
            </div>
          </>
        ) : lesson.kind === "video" ? (
          <>
            {body && <p className="mb-4 text-muted">{body}</p>}
            {video ? (
              <VideoLesson lessonId={lesson.id} src={video.src} lang={lang} initialWatched={video.watched} duration={lesson.video_seconds} initiallyComplete={video.complete} nextHref={nextHref} />
            ) : (
              <p className="rounded-xl bg-sand p-4 text-muted">{lang === "es" ? "El video todavía no está disponible." : "The video isn't available yet."}</p>
            )}
          </>
        ) : lesson.kind === "quiz" ? (
          <QuizRunner lessonId={lesson.id} lang={lang} questions={questions} courseHref={`/training/${slug}`} nextHref={nextHref} />
        ) : (
          <>
            <Markdown text={lang === "es" ? lesson.body_es : lesson.body_en} />
            <div className="mt-8 border-t border-line pt-5">
              <MarkReadButton lessonId={lesson.id} lang={lang} label={t(lang, "markRead")} nextHref={nextHref} />
            </div>
          </>
        )}
      </article>
    </div>
  );
}
