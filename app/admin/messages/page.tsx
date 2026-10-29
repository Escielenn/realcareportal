import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/i18n";

const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "Needs staff", cls: "bg-amber-soft text-amber" },
  waiting: { label: "Waiting on provider", cls: "bg-sky-soft text-sky-dark" },
  closed: { label: "Closed", cls: "bg-sand text-muted" },
};

export default async function StaffInbox({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const sp = await searchParams;
  const show = sp.show ?? "open";
  const { supabase, profile } = await requireStaff();
  let q = supabase.from("message_threads").select("provider_id, status, assigned_to, last_message_at, last_sender, staff_last_read").order("last_message_at", { ascending: false, nullsFirst: false });
  if (show === "mine") q = q.eq("assigned_to", profile.id).neq("status", "closed");
  else if (show !== "all") q = q.eq("status", show);
  const [{ data: threads }, { data: people }, { data: lastMsgs }] = await Promise.all([
    q,
    supabase.from("profiles").select("id, full_name, role"),
    supabase.from("messages").select("provider_id, body, created_at").order("created_at", { ascending: false }).limit(400),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const preview = new Map<string, string>();
  for (const m of lastMsgs ?? []) if (!preview.has(m.provider_id)) preview.set(m.provider_id, m.body);
  const tabs = [["open", "Needs staff"], ["mine", "Assigned to me"], ["waiting", "Waiting on provider"], ["closed", "Closed"], ["all", "All"]];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Messages</h1>
        <p className="text-muted">One private conversation per provider. Assign a conversation to yourself, reply, and close it when it&apos;s done. Messages are never deleted.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(([v, l]) => (
          <Link key={v} href={`/admin/messages?show=${v}`} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${show === v ? "border-teal bg-teal text-white" : "border-line bg-white text-muted hover:text-ink"}`}>{l}</Link>
        ))}
      </div>
      {(threads ?? []).length === 0 ? (
        <p className="card p-6 text-muted">{show === "open" ? "No conversations need a reply right now." : "Nothing here."}</p>
      ) : (
        <ul className="card divide-y divide-line">
          {(threads ?? []).map((t) => {
            const unread = t.last_sender === t.provider_id && (!t.staff_last_read || t.staff_last_read < t.last_message_at);
            const st = STATUS[t.status];
            return (
              <li key={t.provider_id}>
                <Link href={`/admin/messages/${t.provider_id}`} className="flex items-start justify-between gap-4 p-4 hover:bg-sand/50">
                  <div className="min-w-0">
                    <p className={unread ? "font-bold" : "font-semibold"}>
                      {unread && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal align-middle" aria-label="Unread" />}
                      {names.get(t.provider_id)}
                    </p>
                    <p className="truncate text-sm text-muted">{t.last_sender === t.provider_id ? "" : "Staff: "}{preview.get(t.provider_id)}</p>
                    <p className="text-xs text-muted">{t.assigned_to ? `Assigned to ${t.assigned_to === profile.id ? "you" : names.get(t.assigned_to)}` : "Not assigned"}</p>
                  </div>
                  <div className="shrink-0 space-y-1 text-right text-sm text-muted">
                    <p>{t.last_message_at ? fmtDateTime(t.last_message_at) : ""}</p>
                    <span className={`pill ${st.cls}`}>{st.label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
