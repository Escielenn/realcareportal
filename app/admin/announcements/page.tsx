import { requireStaff } from "@/lib/auth";
import { fmtDate, providerTypeLabel } from "@/lib/i18n";
import { AnnouncementActions, AnnouncementForm } from "@/components/phase3-bits";

export default async function AnnouncementsAdmin() {
  const { supabase } = await requireStaff();
  const { data: items } = await supabase.from("announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Announcements</h1>
        <p className="text-muted">News for providers, in English and Spanish. They show on each provider&apos;s home screen, and the notification email says only that something new was posted.</p>
      </div>
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">New announcement</h2>
        <AnnouncementForm />
      </section>
      <section className="card divide-y divide-line">
        {(items ?? []).map((a) => {
          const expired = a.expires_on && a.expires_on < today;
          const live = !a.archived && !expired;
          return (
            <article key={a.id} className={`space-y-1 p-5 ${live ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold">{a.pinned && <span className="pill mr-2 bg-teal-soft text-teal">Pinned</span>}{a.title_en}</h3>
                <AnnouncementActions id={a.id} pinned={a.pinned} archived={a.archived} />
              </div>
              <p className="text-sm text-muted">
                {fmtDate(a.created_at)} · {(a.audience as string[] | null)?.length ? (a.audience as string[]).map((t) => providerTypeLabel[t]?.en ?? t).join(", ") : "All providers"}
                {a.expires_on ? ` · ${expired ? "ended" : "until"} ${fmtDate(a.expires_on)}` : ""}{a.archived ? " · archived" : ""}
              </p>
              <p className="whitespace-pre-wrap">{a.body_en}</p>
              {a.body_es && a.body_es !== a.body_en && <p className="whitespace-pre-wrap text-sm text-muted"><span className="font-semibold">ES:</span> {a.body_es}</p>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
