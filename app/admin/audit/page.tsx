import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/i18n";

const ACTION: Record<string, string> = {
  insert: "Created", update: "Changed", delete: "Deleted", sign_in: "Signed in",
  view_submission: "Viewed submission", view_provider: "Viewed provider record", export_transcripts: "Generated transcripts",
};
const TABLE: Record<string, string> = {
  submissions: "Form submission", completions: "Course completion", training_cycles: "Training cycle", messages: "Message",
  assignments: "Form assignment", profiles: "Profile", auth: "Account",
};

export default async function AuditPage() {
  const { supabase } = await requireStaff();
  const [{ data: log }, { data: people }] = await Promise.all([
    supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(200),
    supabase.from("profiles").select("id, full_name, role"),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, `${p.full_name}${p.role !== "provider" ? " (staff)" : ""}`]));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-muted">Written by the database itself, so no screen or script can skip it. Records who did what and which fields changed, never the values.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-sand/60 text-muted">
            <tr><th className="px-4 py-2.5 font-semibold">When</th><th className="px-4 py-2.5 font-semibold">Who</th><th className="px-4 py-2.5 font-semibold">Action</th><th className="px-4 py-2.5 font-semibold">Record</th><th className="px-4 py-2.5 font-semibold">Fields changed</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(log ?? []).map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-2 whitespace-nowrap text-muted">{fmtDateTime(e.at)}</td>
                <td className="px-4 py-2">{e.actor ? names.get(e.actor) ?? "Unknown" : "System"}</td>
                <td className="px-4 py-2 font-medium">{ACTION[e.action] ?? e.action}</td>
                <td className="px-4 py-2">{TABLE[e.table_name] ?? e.table_name} <span className="text-muted">{String(e.record_id ?? "").slice(0, 8)}</span></td>
                <td className="px-4 py-2 text-muted">{((e.details?.changed as string[]) ?? []).filter((c) => !["created_at"].includes(c)).join(", ")}</td>
              </tr>
            ))}
            {(log ?? []).length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No activity yet. Sign in and use the demo to fill this in.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
