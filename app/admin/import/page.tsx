import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/i18n";
import { ImportUploader } from "@/components/admin-bits";

export default async function ImportPage() {
  const { supabase } = await requireStaff();
  const [{ data: courses }, { data: batches }, { data: rows }] = await Promise.all([
    supabase.from("courses").select("id, title_en").order("sort"),
    supabase.from("import_batches").select("*").order("created_at", { ascending: false }),
    supabase.from("import_rows").select("batch_id, status"),
  ]);
  const cname = new Map((courses ?? []).map((c) => [c.id, c.title_en]));
  const stat = (b: string, s: string) => (rows ?? []).filter((r) => r.batch_id === b && r.status === s).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import training history from Wix</h1>
        <p className="text-muted">Upload each course&apos;s participant export once. Rows are matched to providers by email, then by name, and you review every match before anything is saved.</p>
      </div>
      <section className="card p-5">
        <ImportUploader courses={(courses ?? []).map((c) => ({ id: c.id, title: c.title_en }))} />
        <p className="mt-4 text-sm text-muted">
          Try it with the <a href="/samples/wix-communication-participants.csv" download className="font-semibold text-teal underline">sample Communication export</a> (fictional people, including a typo&apos;d email, a duplicate, a date outside any cycle and an unknown person).
        </p>
      </section>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-sand/60 text-muted">
            <tr><th className="px-4 py-3 font-semibold">Uploaded</th><th className="px-4 py-3 font-semibold">File</th><th className="px-4 py-3 font-semibold">Course</th><th className="px-4 py-3 font-semibold">Ready</th><th className="px-4 py-3 font-semibold">Needs review</th><th className="px-4 py-3 font-semibold">Imported</th><th className="px-4 py-3 font-semibold">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(batches ?? []).map((b) => (
              <tr key={b.id} className="hover:bg-sand/40">
                <td className="px-4 py-2">{fmtDateTime(b.created_at)}</td>
                <td className="px-4 py-2"><Link href={`/admin/import/${b.id}`} className="font-semibold text-teal hover:underline">{b.filename}</Link></td>
                <td className="px-4 py-2">{cname.get(b.course_id)}</td>
                <td className="px-4 py-2">{stat(b.id, "matched")}</td>
                <td className="px-4 py-2">{stat(b.id, "unmatched") + stat(b.id, "no_cycle") + stat(b.id, "bad_date")}</td>
                <td className="px-4 py-2">{stat(b.id, "imported")}</td>
                <td className="px-4 py-2">{b.status === "committed" ? <span className="pill bg-green-soft text-green">Imported</span> : <span className="pill bg-amber-soft text-amber">Review</span>}</td>
              </tr>
            ))}
            {(batches ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">No imports yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
