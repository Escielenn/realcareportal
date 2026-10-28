import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/logo";
import { LangToggle } from "@/components/client-bits";
import { ProviderNav } from "@/components/nav";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const [{ count: returned }, { count: unread }] = await Promise.all([
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("provider_id", profile.id).eq("status", "returned"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).is("read_at", null),
  ]);
  const initials = profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-ink">
            <Logo className="h-8 w-8" />
            <span className="hidden sm:inline">Real Care</span>
          </Link>
          <ProviderNav
            items={[
              { href: "/dashboard", label: t(lang, "home"), icon: "home" as const },
              { href: "/training", label: t(lang, "training"), icon: "training" as const },
              { href: "/forms", label: t(lang, "forms"), icon: "forms" as const, badge: returned ?? 0 },
              { href: "/messages", label: t(lang, "messages"), icon: "messages" as const },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <LangToggle lang={lang} />
            <Link href="/notifications" className="relative rounded-full p-2 text-muted hover:bg-sand hover:text-ink" aria-label={lang === "es" ? `Notificaciones, ${unread ?? 0} sin leer` : `Notifications, ${unread ?? 0} unread`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
              {!!unread && <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-coral px-1 text-center text-xs font-bold text-white">{unread}</span>}
            </Link>
            <Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-soft text-sm font-bold text-teal hover:bg-teal hover:text-white" aria-label={lang === "es" ? "Mi perfil" : "My profile"}>{initials}</Link>
            <form action={signOut}>
              <button className="hidden rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:text-ink sm:block">{t(lang, "signOut")}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
