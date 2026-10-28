import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/i18n";

export default async function StaffMessages() {
  const { supabase } = await requireStaff();
  const [{ data: msgs }, { data: people }] = await Promise.all([
    supabase.from("messages").select("id, provider_id, sender_id, body, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("id, full_name").eq("role", "provider"),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const latest = new Map<string, { body: string; created_at: string; sender_id: string; count: number }>();
  for (const m of msgs ?? []) {
    const cur = latest.get(m.provider_id);
    if (!cur) latest.set(m.provider_id, { ...m, count: 1 });
    else cur.count++;
  }
  const threads = [...latest.entries()];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-muted">One private thread per provider. Threads where the provider wrote last are waiting on staff.</p>
      </div>
      <ul className="card divide-y divide-line">
        {threads.map(([pid, m]) => {
          const waiting = m.sender_id === pid;
          return (
            <li key={pid}>
              <Link href={`/admin/providers/${pid}#messages`} className="flex items-start justify-between gap-4 p-4 hover:bg-sand/50">
                <div className="min-w-0">
                  <p className="font-semibold">{names.get(pid)} <span className="font-normal text-muted">· {m.count} message{m.count === 1 ? "" : "s"}</span></p>
                  <p className="truncate text-muted">{waiting ? "" : "You: "}{m.body}</p>
                </div>
                <div className="shrink-0 text-right text-sm text-muted">
                  {fmtDateTime(m.created_at)}
                  {waiting && <span className="pill mt-1 block bg-amber-soft text-amber">Needs reply</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
