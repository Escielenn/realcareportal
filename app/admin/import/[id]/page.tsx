import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/i18n";
import { MatchSelect, CommitImportButton } from "@/components/admin-bits";

const STATUS: Record<string, { label: string; cls: string; help: string }> = {
  matched: { label: "Ready", cls: "bg-green-soft text-green", help: "Will be imported" },
  imported: { label: "Imported", cls: "bg-teal-soft text-teal", help: "Saved to the provider's record" },
  unmatched: { label: "No match", cls: "bg-coral-soft text-coral", help: "Pick the provider, or leave it out" },
  duplicate: { label: "Already on record", cls: "bg-sand text-muted", help: "Skipped: this cycle already has it" },
  no_cycle: { label: "Outside any cycle", cls: "bg-amber-soft text-amber", help: "Date falls outside the provider's training cycles" },
  bad_date: { label: "Bad date", cls: "bg-amber-soft text-amber", help: "Fix the date in the file and upload again" },
};

export default async function ImportBatch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: batch } = await supabase.from("import_batches").select("*, courses(title_en)").eq("id", id).maybeSingle();
  if (!batch) notFound();
  const [{ data: rows }, { data: people }] = await Promise.all([
    supabase.from("import_rows").select("*").eq("batch_id", id).order("row_num"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "provider").order("full_name"),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const ready = (rows ?? []).filter((r) => r.status === "matched").length;
  const counts = Object.keys(STATUS).map((k) => ({ k, n: (rows ?? []).filter((r) => r.status === k).length })).filter((x) => x.n);
  const committed = batch.status === "committed";

  return (
    <div className="space-y-5">
      <Link href="/admin/import" className="text-sm font-semibold text-teal hover:underline">← Imports</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{batch.filename}</h1>
          <p className="text-muted">{(batch.courses as unknown as { title_en: string }).title_en} · uploaded {fmtDateTime(batch.created_at)}{committed && ` · imported ${fmtDateTime(batch.committed_at)}`}</p>
        </div>
        {!committed && <CommitImportButton batchId={batch.id} count={ready} />}
      </div>
      <div className="flex flex-wrap gap-2">
        {counts.map(({ k, n }) => <span key={k} className={`pill ${STATUS[k].cls}`}>{STATUS[k].label}: {n}</span>)}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-line bg-sand/60 text-muted">
            <tr><th className="px-3 py-3 font-semibold">#</th><th className="px-3 py-3 font-semibold">Name in file</th><th className="px-3 py-3 font-semibold">Email in file</th><th className="px-3 py-3 font-semibold">Completed</th><th className="w-56 px-3 py-3 font-semibold">Matched provider</th><th className="px-3 py-3 font-semibold">Result</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(rows ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-muted">{r.row_num}</td>
                <td className="px-3 py-2 font-medium">{r.raw_name}</td>
                <td className="px-3 py-2">{r.raw_email}</td>
                <td className="px-3 py-2">{fmtDate(r.completed_on)}</td>
                <td className="px-3 py-2">
                  {committed || r.status === "imported" ? (names.get(r.provider_id) ?? "—") : (
                    <MatchSelect rowId={r.id} current={r.provider_id} providers={(people ?? []).map((p) => ({ id: p.id, name: p.full_name }))} />
                  )}
                  {r.match_method && <span className="mt-0.5 block text-xs text-muted">matched by {r.match_method}</span>}
                </td>
                <td className="px-3 py-2"><span className={`pill ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span><span className="mt-0.5 block text-xs text-muted">{STATUS[r.status].help}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">Imported completions are marked &ldquo;Imported from Wix&rdquo; on transcripts and certificates, and they land in the training cycle that contains their date.</p>
    </div>
  );
}
