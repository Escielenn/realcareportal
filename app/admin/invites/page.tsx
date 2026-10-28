import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDate, providerTypeLabel } from "@/lib/i18n";
import { InviteForm, CopyLink, DeleteInviteButton } from "@/components/admin-bits";

export default async function InvitesPage() {
  const { supabase } = await requireStaff();
  const { data: invites } = await supabase.from("invites").select("*").order("created_at", { ascending: false });
  const now = new Date().toISOString();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invite providers</h1>
        <p className="text-muted">Accounts are invitation-only. The provider opens their link, sets a password, and lands on a getting-started checklist with their first training cycle already open.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <section className="card h-fit p-5"><h2 className="mb-4 font-bold">New invitation</h2><InviteForm /></section>
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-sand/60 text-muted">
              <tr><th className="px-4 py-3 font-semibold">Provider</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Sent</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(invites ?? []).map((i) => {
                const expired = !i.accepted_at && i.expires_at < now;
                return (
                  <tr key={i.id}>
                    <td className="px-4 py-2.5"><span className="font-semibold">{i.full_name}</span><span className="block text-muted">{i.email}{i.locale === "es" ? " · Español" : ""}</span></td>
                    <td className="px-4 py-2.5">{(i.provider_types as string[]).map((t) => providerTypeLabel[t]?.en ?? t).join(", ")}</td>
                    <td className="px-4 py-2.5">{fmtDate(i.created_at)}</td>
                    <td className="px-4 py-2.5">
                      {i.accepted_at ? <Link href={`/admin/providers/${i.profile_id}`} className="pill bg-green-soft text-green hover:underline">Joined {fmtDate(i.accepted_at)}</Link>
                        : expired ? <span className="pill bg-sand text-muted">Expired</span>
                        : <span className="pill bg-amber-soft text-amber">Waiting · until {fmtDate(i.expires_at)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {!i.accepted_at && !expired && <span className="flex justify-end gap-3"><CopyLink path={`/join/${i.token}`} /><a href={`/join/${i.token}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-teal hover:underline">Open</a><DeleteInviteButton inviteId={i.id} /></span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
      <p className="text-sm text-muted">Tip for the demo: open a waiting invitation link in a private window to see the provider&apos;s first-time experience.</p>
    </div>
  );
}
