import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { getLang, t } from "@/lib/i18n";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/logo";
import { LangToggle } from "@/components/client-bits";
import { ProviderNav, Icons } from "@/components/nav";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const { count: returned } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("provider_id", profile.id).eq("status", "returned");

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
              { href: "/dashboard", label: t(lang, "home"), icon: Icons.home },
              { href: "/training", label: t(lang, "training"), icon: Icons.training },
              { href: "/forms", label: t(lang, "forms"), icon: Icons.forms, badge: returned ?? 0 },
              { href: "/messages", label: t(lang, "messages"), icon: Icons.messages },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <LangToggle lang={lang} />
            <form action={signOut}>
              <button className="rounded-lg px-2 py-1.5 text-sm font-medium text-muted hover:text-ink">{t(lang, "signOut")}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
