import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/i18n";

export default async function OutboxPage() {
  const { supabase } = await requireStaff();
  const [{ data: mail }, { data: people }] = await Promise.all([
    supabase.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Email outbox</h1>
        <p className="text-muted">
          Every email the portal would send. Messages use fixed templates that say only what kind of update is waiting, so no form contents, names of people supported, or health details ever leave the portal.
          In this demo nothing is actually sent.
        </p>
      </div>
      <div className="card p-4 text-sm">
        <p><strong>Nightly job (1:15 AM Mountain):</strong> opens each provider&apos;s next training cycle on their due date, then sends reminders 30, 14 and 3 days before the due date and on the first overdue day. Each reminder is sent once.</p>
      </div>
      <ul className="space-y-3">
        {(mail ?? []).map((m) => (
          <li key={m.id} className="card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{m.subject}</p>
              <p className="text-sm text-muted">{fmtDateTime(m.created_at)}</p>
            </div>
            <p className="text-sm text-muted">To {names.get(m.profile_id)} &lt;{m.to_email}&gt; · {m.kind.replace("_", " ")} · <span className="text-amber">{m.status}</span></p>
            <pre className="mt-2 rounded-lg bg-sand p-3 font-sans text-sm whitespace-pre-wrap">{m.body}</pre>
          </li>
        ))}
        {(mail ?? []).length === 0 && <li className="card p-6 text-center text-muted">No emails yet. Return a form, send a message or a reminder, and they&apos;ll appear here.</li>}
      </ul>
    </div>
  );
}
