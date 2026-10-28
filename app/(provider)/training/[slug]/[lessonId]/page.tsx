import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { title } from "@/lib/data";
import { Markdown } from "@/lib/md";
import { MarkReadButton } from "@/components/client-bits";
import { QuizRunner } from "./quiz-runner";

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const { supabase } = await requireProvider();
  const lang = await getLang();
  const { data: course } = await supabase.from("courses").select("id, slug, title_en, title_es").eq("slug", slug).single();
  if (!course) notFound();
  const { data: lessons } = await supabase.from("lessons").select("id, sort, kind, title_en, title_es, body_en, body_es").eq("course_id", course.id).order("sort");
  const idx = (lessons ?? []).findIndex((l) => l.id === lessonId);
  if (idx < 0) notFound();
  const lesson = lessons![idx];
  const next = lessons![idx + 1];
  const nextHref = next ? `/training/${slug}/${next.id}` : `/training/${slug}`;

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
        {lesson.kind === "quiz" ? (
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
