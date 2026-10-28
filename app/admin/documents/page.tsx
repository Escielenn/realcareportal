import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/i18n";
import { DocumentReview } from "@/components/document-upload";

export default async function StaffDocuments({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const all = sp.show === "all";
  const { supabase } = await requireStaff();
  let q = supabase.from("documents").select("id, type_code, filename, status, note, review_note, created_at, provider_id, profiles!documents_provider_id_fkey(full_name), individuals(full_name), document_types(name_en)").order("created_at", { ascending: !all }).limit(200);
  if (!all) q = q.eq("status", "submitted");
  const { data: docs, error } = await q;
  type D = { id: string; filename: string; status: string; note: string | null; review_note: string | null; created_at: string; provider_id: string; profiles: { full_name: string } | null; individuals: { full_name: string } | null; document_types: { name_en: string } | null };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Documents</h1>
          <p className="text-muted">Uploads from providers. Files are private; each open uses a 60-second link and is logged.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/documents" className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${!all ? "border-teal bg-teal text-white" : "border-line bg-white text-muted"}`}>Waiting</Link>
          <Link href="/admin/documents?show=all" className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${all ? "border-teal bg-teal text-white" : "border-line bg-white text-muted"}`}>All documents</Link>
        </div>
      </div>
      {error && <p className="card p-4 text-coral">{error.message}</p>}
      {(docs ?? []).length === 0 ? (
        <p className="card p-6 text-muted">{all ? "No documents yet." : "Nothing waiting. Nice work."}</p>
      ) : (
        <ul className="card divide-y divide-line">
          {((docs ?? []) as unknown as D[]).map((d) => (
            <li key={d.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener" className="font-semibold text-teal hover:underline">{d.document_types?.name_en ?? "Document"}</a>
                  <span className="text-muted"> · <Link href={`/admin/providers/${d.provider_id}`} className="hover:underline">{d.profiles?.full_name}</Link>{d.individuals ? ` · ${d.individuals.full_name}` : ""}</span>
                  <p className="text-sm text-muted">{d.filename} · {fmtDateTime(d.created_at)}</p>
                  {d.note && <p className="text-sm">Provider note: {d.note}</p>}
                  {d.review_note && <p className="text-sm text-muted">Review note: {d.review_note}</p>}
                </div>
                <span className={`pill ${d.status === "accepted" ? "bg-green-soft text-green" : d.status === "returned" ? "bg-coral-soft text-coral" : "bg-sky-soft text-sky-dark"}`}>{d.status}</span>
              </div>
              {d.status === "submitted" && <DocumentReview documentId={d.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
