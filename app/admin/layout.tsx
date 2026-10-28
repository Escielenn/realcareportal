import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStaff();
  const { count: queue } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "submitted");
  return (
    <div className="min-h-dvh md:flex">
      <aside className="no-print bg-teal-dark text-white md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0">
        <div className="flex items-center gap-2 px-4 py-4">
          <Logo className="h-8 w-8" />
          <div>
            <Link href="/admin" className="block leading-tight font-bold">Real Care</Link>
            <span className="text-xs text-white/70">Staff console</span>
          </div>
        </div>
        <div className="px-2 pb-3">
          <AdminNav
            items={[
              { href: "/admin", label: "Overview" },
              { href: "/admin/providers", label: "Providers & training" },
              { href: "/admin/review", label: "Review queue", badge: queue ?? 0 },
              { href: "/admin/transcripts", label: "Transcripts" },
              { href: "/admin/messages", label: "Messages" },
              { href: "/admin/audit", label: "Audit log" },
            ]}
          />
        </div>
        <div className="hidden border-t border-white/15 px-4 py-4 text-sm md:absolute md:inset-x-0 md:bottom-0 md:block">
          <p className="font-semibold">{profile.full_name}</p>
          <p className="text-white/70 capitalize">{profile.role}</p>
          <form action={signOut} className="mt-2">
            <button className="text-white/80 underline-offset-2 hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
