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
  const [{ count: returned }, { count: unread }, { data: thread }] = await Promise.all([
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("provider_id", profile.id).eq("status", "returned"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).is("read_at", null),
    supabase.from("message_threads").select("last_message_at, last_sender, provider_last_read").eq("provider_id", profile.id).maybeSingle(),
  ]);
  const unreadMessages = !!thread && thread.last_sender !== profile.id && (!thread.provider_last_read || thread.provider_last_read < thread.last_message_at) ? 1 : 0;
  const initials = profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("");

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="no-print brand-bar sticky top-0 z-10 text-white shadow-md">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold" aria-label="Real Care Portal home">
            <Logo tile className="h-10" />
            <span className="font-display text-base leading-tight sm:text-lg">Real Care<span className="hidden sm:block text-sm font-medium text-white/85">Provider Portal</span></span>
          </Link>
          <ProviderNav
            items={[
              { href: "/dashboard", label: t(lang, "home"), icon: "home" as const },
              { href: "/training", label: t(lang, "training"), icon: "training" as const },
              { href: "/forms", label: t(lang, "forms"), icon: "forms" as const, badge: returned ?? 0 },
              { href: "/documents", label: lang === "es" ? "Documentos" : "Documents", icon: "documents" as const },
              { href: "/messages", label: t(lang, "messages"), icon: "messages" as const, badge: unreadMessages },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <LangToggle lang={lang} />
            <Link href="/notifications" className="relative rounded-full p-2 text-white/85 hover:bg-white/15 hover:text-white" aria-label={lang === "es" ? `Notificaciones, ${unread ?? 0} sin leer` : `Notifications, ${unread ?? 0} unread`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
              {!!unread && <span className="absolute -top-0.5 -right-0.5 min-w-5 rounded-full bg-sky px-1 text-center text-xs font-bold text-navy">{unread}</span>}
            </Link>
            <Link href="/help" className="hidden rounded-full p-2 text-white/85 hover:bg-white/15 hover:text-white sm:block" aria-label={lang === "es" ? "Ayuda" : "Help"}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7" /><path d="M12 17h.01" /></svg>
            </Link>
            <Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-teal ring-2 ring-white/40 hover:bg-sky-soft" aria-label={lang === "es" ? "Mi perfil" : "My profile"}>{initials}</Link>
            <form action={signOut}>
              <button className="hidden rounded-lg px-2 py-1.5 text-sm font-medium text-white/80 hover:text-white sm:block">{t(lang, "signOut")}</button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 pt-6 pb-28 outline-none md:pt-8">{children}</main>
    </div>
  );
}
