import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { LessonForm, VideoUploader, QuizEditor } from "@/components/admin-bits";
import { Markdown } from "@/lib/md";

type QRow = { prompt_en: string; prompt_es: string; options_en: string[]; options_es: string[]; correct: number; explanation_en: string; explanation_es: string };

export default async function LessonEditor({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const { supabase } = await requireStaff();
  const [{ data: course }, { data: lesson }] = await Promise.all([
    supabase.from("courses").select("id, title_en").eq("id", id).maybeSingle(),
    supabase.from("lessons").select("*").eq("id", lessonId).eq("course_id", id).maybeSingle(),
  ]);
  if (!course || !lesson) notFound();

  let quiz: QRow[] = [];
  if (lesson.kind === "quiz") {
    const { data } = await supabase.rpc("quiz_for_edit", { p_lesson: lesson.id });
    quiz = ((data ?? []) as QRow[]).map((q) => ({
      prompt_en: q.prompt_en, prompt_es: q.prompt_es, options_en: q.options_en, options_es: q.options_es,
      correct: q.correct, explanation_en: q.explanation_en, explanation_es: q.explanation_es,
    }));
  }
  let videoSrc: string | null = null;
  if (lesson.kind === "video" && lesson.video_url) {
    videoSrc = lesson.video_url.startsWith("/") || lesson.video_url.startsWith("http")
      ? lesson.video_url
      : (await supabase.storage.from("training-media").createSignedUrl(lesson.video_url, 3600)).data?.signedUrl ?? null;
  }

  return (
    <div className="space-y-6">
      <Link href={`/admin/courses/${course.id}`} className="text-sm font-semibold text-teal hover:underline">← {course.title_en}</Link>
      <div>
        <p className="text-sm font-semibold text-muted uppercase">{lesson.kind} lesson</p>
        <h1 className="text-2xl font-bold">{lesson.title_en}</h1>
      </div>

      <section className="card p-5"><LessonForm l={lesson} /></section>

      {lesson.kind === "video" && (
        <section className="card grid gap-5 p-5 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 font-bold">Video</h2>
            {videoSrc ? <video src={videoSrc} controls className="aspect-video w-full rounded-xl bg-black" /> : <p className="rounded-xl bg-sand p-6 text-center text-muted">No video uploaded yet.</p>}
            {lesson.video_seconds && <p className="mt-2 text-sm text-muted">Length: {lesson.video_seconds} seconds. Providers must watch at least {Math.round(lesson.video_seconds * 0.9)} seconds.</p>}
          </div>
          <VideoUploader lessonId={lesson.id} current={lesson.video_url} />
        </section>
      )}

      {lesson.kind === "quiz" && (
        <section className="card p-5">
          <h2 className="mb-1 font-bold">Questions</h2>
          <p className="mb-4 text-sm text-muted">Answer keys are visible only to staff. Providers see explanations after they answer.</p>
          <QuizEditor lessonId={lesson.id} initial={quiz} />
        </section>
      )}

      {lesson.kind === "reading" && (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5"><p className="mb-3 text-sm font-semibold text-muted">Preview · English</p><Markdown text={lesson.body_en} /></div>
          <div className="card p-5"><p className="mb-3 text-sm font-semibold text-muted">Vista previa · Español</p><Markdown text={lesson.body_es} /></div>
        </section>
      )}
    </div>
  );
}
