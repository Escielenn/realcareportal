import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime, providerTypeLabel } from "@/lib/i18n";
import { MessageComposer } from "@/components/client-bits";
import { MarkThreadRead, ThreadControls } from "@/components/phase3-bits";

export default async function StaffThread({ params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  const { supabase, profile: me } = await requireStaff();
  const { data: p } = await supabase.from("profiles").select("id, full_name, provider_types, locale").eq("id", providerId).eq("role", "provider").maybeSingle();
  if (!p) notFound();
  const [{ data: msgs }, { data: thread }, { data: staff }] = await Promise.all([
    supabase.from("messages").select("id, body, created_at, sender_id").eq("provider_id", providerId).order("created_at"),
    supabase.from("message_threads").select("status, assigned_to, provider_last_read").eq("provider_id", providerId).maybeSingle(),
    supabase.from("profiles").select("id, full_name").in("role", ["staff", "admin"]).eq("active", true).order("full_name"),
  ]);
  const names = new Map((staff ?? []).map((s) => [s.id, s.full_name]));
  const lastStaff = [...(msgs ?? [])].reverse().find((m) => m.sender_id !== providerId);
  const seen = lastStaff && thread?.provider_last_read && thread.provider_last_read >= lastStaff.created_at;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <MarkThreadRead providerId={providerId} />
      <Link href="/admin/messages" className="text-sm font-semibold text-teal hover:underline">← Messages</Link>
      <div className="card flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <h1 className="text-2xl font-semibold text-navy"><Link href={`/admin/providers/${p.id}`} className="hover:underline">{p.full_name}</Link></h1>
          <p className="text-sm text-muted">{p.provider_types.map((t: string) => providerTypeLabel[t]?.en ?? t).join(", ")} · writes in {p.locale === "es" ? "Spanish" : "English"}</p>
        </div>
        <ThreadControls providerId={p.id} status={thread?.status ?? "open"} assignedTo={thread?.assigned_to ?? null} staff={(staff ?? []).map((s) => ({ id: s.id, name: s.full_name }))} />
      </div>
      <section className="card space-y-3 p-4">
        {(msgs ?? []).length === 0 && <p className="text-muted">No messages yet. Start the conversation below.</p>}
        {(msgs ?? []).map((m) => {
          const fromProvider = m.sender_id === providerId;
          return (
            <div key={m.id} className={`flex ${fromProvider ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${fromProvider ? "rounded-bl-sm bg-sand" : "rounded-br-sm bg-teal text-white"}`}>
                <p className={`text-xs font-semibold ${fromProvider ? "text-muted" : "text-white/75"}`}>{fromProvider ? p.full_name : m.sender_id === me.id ? "You" : names.get(m.sender_id) ?? "Real Care staff"} · {fmtDateTime(m.created_at)}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          );
        })}
        {lastStaff && <p className="text-right text-xs text-muted">{seen ? "Seen by provider" : "Not seen yet"}</p>}
        <div className="border-t border-line pt-3">
          <MessageComposer providerId={p.id} placeholder={`Reply to ${p.full_name.split(" ")[0]}`} sendLabel="Send" />
          <p className="mt-2 text-xs text-muted">The provider gets an email that says only that a message is waiting. Replying marks the conversation as waiting on the provider.</p>
        </div>
      </section>
    </div>
  );
}
