import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/i18n";
import { MarkStaffRead } from "@/components/phase2-bits";

export default async function StaffAlerts() {
  const { supabase, profile } = await requireStaff();
  const { data: items } = await supabase.from("notifications").select("id, title_en, link, read_at, created_at").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(100);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Alerts</h1>
          <p className="text-muted">Incident reports, provider messages and new applications. Alert emails never include details.</p>
        </div>
        <MarkStaffRead />
      </div>
      {(items ?? []).length === 0 ? <p className="card p-6 text-muted">No alerts.</p> : (
        <ul className="card divide-y divide-line">
          {(items ?? []).map((n) => (
            <li key={n.id}>
              <Link href={n.link ?? "/admin"} className="flex items-center justify-between gap-3 p-4 hover:bg-sand/60">
                <span className={n.read_at ? "text-muted" : "font-semibold"}>{!n.read_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-teal align-middle" aria-label="Unread" />}{n.title_en}</span>
                <span className="shrink-0 text-sm text-muted">{fmtDateTime(n.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
