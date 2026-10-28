import { requireProvider } from "@/lib/auth";
import { getLang, fmtDateTime } from "@/lib/i18n";
import { MarkAllRead, NotificationLink } from "@/components/provider-bits";

export default async function NotificationsPage() {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const { data } = await supabase.from("notifications").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  const es = lang === "es";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{es ? "Notificaciones" : "Notifications"}</h1>
          <p className="text-muted">{es ? `${unread} sin leer` : `${unread} unread`}</p>
        </div>
        {unread > 0 && <MarkAllRead label={es ? "Marcar todo como leído" : "Mark all as read"} />}
      </div>
      <ul className="card divide-y divide-line overflow-hidden">
        {(data ?? []).map((n) => (
          <li key={n.id}>
            <NotificationLink id={n.id} href={n.link} unread={!n.read_at}>
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? "bg-line" : "bg-coral"}`} aria-hidden />
              <span className="flex-1">
                <span className={`block ${n.read_at ? "" : "font-semibold"}`}>{es ? n.title_es : n.title_en}</span>
                <span className="text-sm text-muted">{fmtDateTime(n.created_at, lang)}</span>
              </span>
              <span className="text-teal" aria-hidden>→</span>
            </NotificationLink>
          </li>
        ))}
        {(data ?? []).length === 0 && <li className="p-6 text-center text-muted">{es ? "No hay notificaciones." : "No notifications yet."}</li>}
      </ul>
      <p className="text-sm text-muted">
        {es ? "Los correos solo dicen qué tipo de aviso tiene. Los detalles se quedan en el portal." : "Emails only say what kind of update you have. The details stay in the portal."}
      </p>
    </div>
  );
}
