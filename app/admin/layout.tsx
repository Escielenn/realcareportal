import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/actions";
import { Logo } from "@/components/logo";
import { AdminNav } from "@/components/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireStaff();
  const [{ count: queue }, { count: pendingImports }, { count: docs }, { count: apps }, { count: unread }, { count: openThreads }] = await Promise.all([
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("import_batches").select("id", { count: "exact", head: true }).eq("status", "staged"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).is("read_at", null),
    supabase.from("message_threads").select("provider_id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  return (
    <div className="min-h-dvh md:flex">
      <aside className="no-print relative isolate overflow-hidden bg-navy text-white md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto">
        <div className="mountain-photo absolute inset-x-0 bottom-0 -z-10 hidden h-72 opacity-25 md:block" style={{ maskImage: "linear-gradient(to top, black 10%, transparent)", WebkitMaskImage: "linear-gradient(to top, black 10%, transparent)" }} aria-hidden />
        <div className="brand-bar h-1.5 w-full" aria-hidden />
        <div className="flex items-center gap-2 px-4 py-4">
          <Logo tile className="h-11" />
          <div>
            <Link href="/admin" className="block font-display leading-tight font-bold">Real Care</Link>
            <span className="text-xs text-white/70">Staff console</span>
          </div>
        </div>
        <div className="px-2 pb-3">
          <AdminNav
            groups={[
              { heading: "Today", items: [
                { href: "/admin", label: "Overview" },
                { href: "/admin/notifications", label: "Alerts", badge: unread ?? 0 },
                { href: "/admin/review", label: "Review queue", badge: queue ?? 0 },
                { href: "/admin/documents", label: "Documents", badge: docs ?? 0 },
                { href: "/admin/messages", label: "Messages", badge: openThreads ?? 0 },
              ] },
              { heading: "People", items: [
                { href: "/admin/providers", label: "Providers & training" },
                { href: "/admin/individuals", label: "People supported" },
                { href: "/admin/applications", label: "Applications", badge: apps ?? 0 },
                { href: "/admin/invites", label: "Invite providers" },
              ] },
              { heading: "Content", items: [
                { href: "/admin/forms", label: "Forms & assignments" },
                { href: "/admin/courses", label: "Courses" },
                { href: "/admin/requirements", label: "Requirements" },
                { href: "/admin/announcements", label: "Announcements" },
              ] },
              { heading: "Records", items: [
                { href: "/admin/reports", label: "Reports" },
                { href: "/admin/transcripts", label: "Transcripts" },
                { href: "/admin/payments", label: "Payments & access" },
                { href: "/admin/import", label: "Import from Wix", badge: pendingImports ?? 0 },
                { href: "/admin/outbox", label: "Email outbox" },
                { href: "/admin/audit", label: "Audit log" },
              ] },
            ]}
          />
        </div>
        <div className="hidden border-t border-white/15 px-4 py-4 text-sm md:mt-auto md:block">
          <p className="font-semibold">{profile.full_name}</p>
          <p className="text-white/70 capitalize">{profile.role}</p>
          <Link href="/staff-security" className="mt-2 block text-white/80 underline-offset-2 hover:underline">Two-step sign-in</Link>
          <form action={signOut} className="mt-1">
            <button className="text-white/80 underline-offset-2 hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none px-4 py-6 pb-24 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
