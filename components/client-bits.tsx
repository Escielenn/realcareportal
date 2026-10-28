"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setLang, sendMessage, renewProvider, runRenewals, completeLesson } from "@/app/actions";

export function LangToggle({ lang }: { lang: "en" | "es" }) {
  const path = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex rounded-full border border-line bg-white p-0.5 text-sm" role="group" aria-label="Language / Idioma">
      {(["en", "es"] as const).map((l) => (
        <button
          key={l}
          disabled={pending}
          aria-pressed={lang === l}
          onClick={() => start(async () => { await setLang(l, path); router.refresh(); })}
          className={`rounded-full px-3 py-1 font-semibold ${lang === l ? "bg-teal text-white" : "text-muted hover:text-ink"}`}
        >
          {l === "en" ? "EN" : "ES"}
        </button>
      ))}
    </div>
  );
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-primary no-print">
      {label}
    </button>
  );
}

export function MessageComposer({ providerId, placeholder, sendLabel }: { providerId: string; placeholder: string; sendLabel: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const path = usePathname();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await sendMessage(providerId, body, path);
          if (r.error) setError(r.error);
          else { setBody(""); setError(null); }
        });
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <label className="sr-only" htmlFor="msg">{placeholder}</label>
      <textarea id="msg" value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder={placeholder} className="input min-h-[52px] flex-1 resize-y" />
      <button disabled={pending || !body.trim()} className="btn-primary sm:w-28">{pending ? "…" : sendLabel}</button>
      {error && <p className="text-sm text-coral">{error}</p>}
    </form>
  );
}

export function MarkReadButton({ lessonId, lang, label, nextHref }: { lessonId: string; lang: string; label: string; nextHref: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const r = await completeLesson(lessonId, lang);
          if (r.error) setError(r.error);
          else router.push(nextHref);
        })}
        className="btn-primary w-full sm:w-auto"
      >
        {pending ? "…" : label} <span aria-hidden>→</span>
      </button>
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
    </div>
  );
}

export function RenewProviderButton({ providerId }: { providerId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        disabled={pending}
        onClick={() => {
          if (!confirm("Open a new training cycle for this provider starting today? Past cycles are kept.")) return;
          start(async () => {
            const r = await renewProvider(providerId);
            setMsg(r.error ?? "New cycle opened.");
          });
        }}
        className="btn-ghost"
      >
        {pending ? "Opening…" : "Open next cycle now"}
      </button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  );
}

export function RenewalRunner({ defaultDate }: { defaultDate: string }) {
  const [date, setDate] = useState(defaultDate);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="asof" className="label text-sm">Run renewal check as of</label>
          <input id="asof" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input w-44" />
        </div>
        <button
          disabled={pending}
          onClick={() => start(async () => {
            const r = await runRenewals(date);
            setMsg(r.error ?? (r.count === 0 ? "No cycles were due. Nothing changed." : `Opened ${r.count} new training cycle${r.count === 1 ? "" : "s"}. History kept.`));
          })}
          className="btn-primary"
        >
          {pending ? "Running…" : "Run renewals"}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted">
        In production this runs automatically every night. Running it twice changes nothing.
      </p>
      {msg && <p role="status" className="mt-2 rounded-lg bg-teal-soft px-3 py-2 text-sm font-medium text-teal">{msg}</p>}
    </div>
  );
}
