import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { CourseForm, LessonRowActions, AddLessonButtons } from "@/components/admin-bits";

export default async function CourseEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const [{ data: course }, { data: lessons }, { count }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", id).maybeSingle(),
    supabase.from("lessons").select("id, sort, kind, title_en, title_es, video_url").eq("course_id", id).order("sort"),
    supabase.from("completions").select("id", { count: "exact", head: true }).eq("course_id", id),
  ]);
  if (!course) notFound();
  const list = lessons ?? [];
  const missingQuiz = !list.some((l) => l.kind === "quiz");

  return (
    <div className="space-y-6">
      <Link href="/admin/courses" className="text-sm font-semibold text-teal hover:underline">← Courses</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{course.title_en}</h1>
          <p className="text-muted">{count ?? 0} completions recorded · <Link href={`/training/${course.slug}`} className="text-teal hover:underline">provider view</Link> (sign in as a provider)</p>
        </div>
      </div>

      <section className="card p-5"><h2 className="mb-4 font-bold">Course details</h2><CourseForm c={course} /></section>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Lessons</h2>
          <AddLessonButtons courseId={course.id} />
        </div>
        <p className="mb-3 text-sm text-muted">Providers complete lessons in this order. A course is complete when every lesson is done: readings are marked read, videos watched to 90%, and quizzes passed.</p>
        <ol className="divide-y divide-line rounded-xl border border-line">
          {list.map((l, i) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-6 text-center text-sm font-bold text-muted">{i + 1}</span>
              <span className={`pill ${l.kind === "quiz" ? "bg-amber-soft text-amber" : l.kind === "video" ? "bg-teal-soft text-teal" : "bg-sand text-muted"}`}>{l.kind}</span>
              <Link href={`/admin/courses/${course.id}/lessons/${l.id}`} className="flex-1 font-medium text-teal hover:underline">{l.title_en}<span className="font-normal text-muted"> · {l.title_es}</span></Link>
              {l.kind === "video" && !l.video_url && <span className="text-xs font-semibold text-coral">No video yet</span>}
              <LessonRowActions courseId={course.id} lessonId={l.id} first={i === 0} last={i === list.length - 1} />
            </li>
          ))}
          {list.length === 0 && <li className="p-4 text-center text-muted">No lessons yet. Add a reading, video or quiz.</li>}
        </ol>
        {missingQuiz && list.length > 0 && <p className="mt-3 text-sm text-amber">Tip: add a quiz so completion shows a score on the certificate and transcript.</p>}
      </section>
    </div>
  );
}
