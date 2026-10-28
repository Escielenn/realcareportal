"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: keyof typeof Icons; badge?: number };

export function ProviderNav({ items }: { items: Item[] }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <>
      <nav className="hidden gap-1 md:flex" aria-label="Main">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
            className={`relative rounded-lg px-3 py-2 font-semibold ${active(i.href) ? "bg-teal-soft text-teal" : "text-muted hover:text-ink"}`}>
            {i.label}
            {!!i.badge && <span className="ml-1.5 rounded-full bg-coral px-1.5 text-xs text-white">{i.badge}</span>}
          </Link>
        ))}
      </nav>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${active(i.href) ? "text-teal" : "text-muted"}`}>
            <span className="h-6 w-6">{Icons[i.icon]}</span>
            {i.label}
            {!!i.badge && <span className="absolute top-1 right-[28%] rounded-full bg-coral px-1.5 text-[10px] text-white">{i.badge}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function AdminNav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Staff">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined}
          className={`flex items-center justify-between rounded-lg px-3 py-2 whitespace-nowrap font-medium ${active(i.href) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
          {i.label}
          {!!i.badge && <span className="ml-2 rounded-full bg-coral px-2 text-xs font-bold text-white">{i.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icons = {
  home: <svg viewBox="0 0 24 24" {...s}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  training: <svg viewBox="0 0 24 24" {...s}><path d="M2 8l10-5 10 5-10 5z" /><path d="M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /></svg>,
  forms: <svg viewBox="0 0 24 24" {...s}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></svg>,
  messages: <svg viewBox="0 0 24 24" {...s}><path d="M4 5h16v11H8l-4 4z" /></svg>,
};
