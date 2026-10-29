import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createCourse } from "@/app/admin/actions";

export default async function CoursesAdmin() {
  const { supabase } = await requireStaff();
  const [{ data: courses }, { data: lessons }, { data: reqs }] = await Promise.all([
    supabase.from("courses").select("*").order("sort"),
    supabase.from("lessons").select("course_id, kind"),
    supabase.from("requirements").select("course_id, provider_type"),
  ]);
  const count = (id: string, kind?: string) => (lessons ?? []).filter((l) => l.course_id === id && (!kind || l.kind === kind)).length;
  const reqFor = (id: string) => [...new Set((reqs ?? []).filter((r) => r.course_id === id).map((r) => r.provider_type))].length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-muted">Build and edit training in English and Spanish. Changes show to providers as soon as a course is published.</p>
        </div>
        <form action={createCourse} className="flex gap-2">
          <label className="sr-only" htmlFor="new-title">New course title</label>
          <input id="new-title" name="title_en" placeholder="e.g. Fall Prevention…" className="input w-56 py-2" required />
          <button className="btn-primary">+ New course</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-sand/60 text-muted">
            <tr><th className="px-4 py-3 font-semibold">Course</th><th className="px-4 py-3 font-semibold">Lessons</th><th className="px-4 py-3 font-semibold">Required for</th><th className="px-4 py-3 font-semibold">Price</th><th className="px-4 py-3 font-semibold">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(courses ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-sand/40">
                <td className="px-4 py-3"><Link href={`/admin/courses/${c.id}`} className="font-semibold text-teal hover:underline">{c.title_en}</Link><p className="text-muted">{c.title_es}</p></td>
                <td className="px-4 py-3">{count(c.id)} <span className="text-muted">({count(c.id, "reading")} reading, {count(c.id, "video")} video, {count(c.id, "quiz")} quiz)</span></td>
                <td className="px-4 py-3">{reqFor(c.id)} of 4 types</td>
                <td className="px-4 py-3">${(c.price_cents / 100).toFixed(2)}{c.in_all_access ? <span className="text-muted"> · All-Access</span> : <span className="text-amber"> · sold separately</span>}</td>
                <td className="px-4 py-3">{c.published ? <span className="pill bg-green-soft text-green">Published</span> : <span className="pill bg-sand text-muted">Draft</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
