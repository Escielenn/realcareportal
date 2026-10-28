import { requireProvider } from "@/lib/auth";
import { getLang, fmtDate, providerTypeLabel } from "@/lib/i18n";
import { ProfileForm } from "./profile-form";
import { signOut } from "@/app/actions";

export default async function ProfilePage() {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const es = lang === "es";
  const [{ data: ents }, { data: orders }] = await Promise.all([
    supabase.from("entitlements").select("id, starts_on, ends_on, course_id, courses(title_en, title_es)").eq("provider_id", profile.id).order("ends_on", { ascending: false }),
    supabase.from("orders").select("id, description, amount_cents, method, status, created_at").eq("provider_id", profile.id).order("created_at", { ascending: false }),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const method: Record<string, { en: string; es: string }> = {
    wix: { en: "Paid on the old training site", es: "Pagado en el sitio anterior" },
    demo_checkout: { en: "Card (demo)", es: "Tarjeta (demostración)" },
    stripe: { en: "Card", es: "Tarjeta" },
    paid_by_real_care: { en: "Paid by Real Care", es: "Pagado por Real Care" },
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{es ? "Mi perfil" : "My profile"}</h1>
        <p className="text-muted">{profile.full_name} · {profile.email} · {profile.provider_types.map((t) => providerTypeLabel[t]?.[lang] ?? t).join(", ")}</p>
      </div>
      <ProfileForm lang={lang} locale={profile.locale} phone={(profile as unknown as { phone: string | null }).phone ?? ""} emailNotifications={(profile as unknown as { email_notifications: boolean }).email_notifications} />

      <section className="card p-5">
        <h2 className="mb-3 font-bold">{es ? "Mi acceso a cursos" : "My course access"}</h2>
        <ul className="divide-y divide-line">
          {(ents ?? []).map((e) => {
            const c = e.courses as unknown as { title_en: string; title_es: string } | null;
            const active = e.ends_on >= today && e.starts_on <= today;
            return (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span className="font-medium">{c ? (es ? c.title_es : c.title_en) : es ? "Acceso completo (14 cursos)" : "All-Access (14 courses)"}</span>
                <span className={`text-sm ${active ? "text-green" : "text-muted"}`}>{active ? (es ? "Activo hasta " : "Active until ") : es ? "Terminó " : "Ended "}{fmtDate(e.ends_on, lang)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">{es ? "Pagos" : "Payments"}</h2>
        <ul className="divide-y divide-line text-sm">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2 py-2">
              <span>{o.description}<span className="block text-muted">{fmtDate(o.created_at, lang)} · {method[o.method]?.[lang] ?? o.method}</span></span>
              <span className={o.status === "refunded" ? "text-muted line-through" : "font-semibold"}>${(o.amount_cents / 100).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </section>

      <form action={signOut}>
        <button className="btn-ghost w-full">{es ? "Cerrar sesión" : "Sign out"}</button>
      </form>
    </div>
  );
}
