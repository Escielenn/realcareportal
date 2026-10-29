"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinProgram, saveProgram, grantProgram, setAutoRenew } from "@/app/programs-actions";

const TYPES: [string, string][] = [["host_home", "Host Home"], ["family_caregiver", "Family Caregiver"], ["scc_dsp", "SCC / DSP"], ["nmt", "NMT"]];

function Msg({ s }: { s?: { error?: string; message?: string } }) {
  if (!s) return null;
  if (s.error) return <p role="alert" className="text-sm text-coral">{s.error}</p>;
  if (s.message) return <p role="status" className="text-sm font-semibold text-green">✓ {s.message}</p>;
  return null;
}

// ---------- provider
export function JoinProgramButton({ programId, label, primary = true }: { programId: string; label: string; primary?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button type="button" disabled={pending} className={primary ? "btn-primary w-full sm:w-auto" : "btn-ghost w-full sm:w-auto"}
        onClick={() => start(async () => { const r = await joinProgram(programId); if (r.error) setError(r.error); else { setError(null); router.refresh(); } })}>
        {pending ? "…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-coral">{error}</p>}
    </div>
  );
}

export function AutoRenewSwitch({ programId, on, lang, price }: { programId: string; on: boolean; lang: "en" | "es"; price: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(on);
  const [error, setError] = useState<string | null>(null);
  const id = `ar-${programId}`;
  const flip = () => {
    const next = !value;
    setValue(next);
    start(async () => {
      const r = await setAutoRenew(programId, next);
      if (r.error) { setValue(!next); setError(r.error); } else { setError(null); router.refresh(); }
    });
  };
  return (
    <div className="flex items-start gap-3">
      <button id={id} type="button" role="switch" aria-checked={value} disabled={pending} onClick={flip}
        className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors ${value ? "border-teal bg-teal" : "border-line bg-sand"}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} aria-hidden />
      </button>
      <label htmlFor={id} className="text-sm">
        <span className="block font-semibold">{lang === "es" ? "Renovación automática" : "Renew automatically"}</span>
        <span className="block text-muted">
          {value
            ? lang === "es" ? `Activada. Se renueva por ${price} unos días antes de que termine. Puede apagarla cuando quiera.` : `On. Renews for ${price} a few days before it ends. You can turn it off any time.`
            : lang === "es" ? "Apagada. Le enviaremos recordatorios para renovar a mano." : "Off. We'll send reminders so you can renew yourself."}
        </span>
        {error && <span role="alert" className="block text-coral">{error}</span>}
      </label>
    </div>
  );
}

// ---------- staff
type ProgramRow = {
  id?: string; slug?: string; name_en?: string; name_es?: string; description_en?: string; description_es?: string;
  price_cents?: number; duration_days?: number; audience?: string[]; active?: boolean; sort?: number;
};

export function ProgramForm({ program, courses, included }: { program?: ProgramRow; courses: { id: string; title: string; note?: string }[]; included: string[] }) {
  const [s, action, pending] = useActionState(saveProgram, undefined);
  const p = program ?? {};
  return (
    <form action={action} className="space-y-5">
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label" htmlFor="pg-ne">Name (English)</label><input id="pg-ne" name="name_en" className="input" required maxLength={120} defaultValue={p.name_en} /></div>
        <div><label className="label" htmlFor="pg-ns">Name (Spanish)</label><input id="pg-ns" name="name_es" className="input" maxLength={120} defaultValue={p.name_es} placeholder="Leave blank to show the English…" /></div>
        <div><label className="label" htmlFor="pg-de">Description (English)</label><textarea id="pg-de" name="description_en" rows={3} className="input" maxLength={2000} defaultValue={p.description_en} /></div>
        <div><label className="label" htmlFor="pg-ds">Description (Spanish)</label><textarea id="pg-ds" name="description_es" rows={3} className="input" maxLength={2000} defaultValue={p.description_es} /></div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div><label className="label" htmlFor="pg-slug">Short name</label><input id="pg-slug" name="slug" className="input w-48" required pattern="[a-z0-9][a-z0-9\-]{1,59}" spellCheck={false} autoComplete="off" defaultValue={p.slug} placeholder="all-access…" /></div>
        <div><label className="label" htmlFor="pg-price">Price ($ per term)</label><input id="pg-price" name="price" type="number" inputMode="decimal" step="0.01" min={0} max={10000} className="input w-32" defaultValue={(p.price_cents ?? 0) / 100} /></div>
        <div><label className="label" htmlFor="pg-days">Term (days)</label><input id="pg-days" name="duration_days" type="number" min={1} max={730} className="input w-28" defaultValue={p.duration_days ?? 365} /></div>
        <div><label className="label" htmlFor="pg-sort">Order</label><input id="pg-sort" name="sort" type="number" min={0} max={999} className="input w-20" defaultValue={p.sort ?? 0} /></div>
        <label className="flex items-center gap-2 pb-2.5 font-medium"><input type="checkbox" name="active" defaultChecked={p.active ?? true} className="h-4 w-4 accent-[#0f5c5f]" /> Offered to providers</label>
      </div>
      <fieldset>
        <legend className="label">Who can join</legend>
        <p className="mb-2 text-sm text-muted">Choose none to offer it to every provider. Staff can still give it to anyone.</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
              <input type="checkbox" name="audience" value={v} defaultChecked={p.audience?.includes(v)} /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label">Courses included</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {courses.map((c) => (
            <label key={c.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-sand/60">
              <input type="checkbox" name="courses" value={c.id} defaultChecked={included.includes(c.id)} className="mt-1 h-4 w-4 accent-[#0f5c5f]" />
              <span>{c.title}{c.note && <span className="block text-xs text-muted">{c.note}</span>}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-muted">Changing the course list or price affects new and current members right away. Past orders keep the price they paid.</p>
      <Msg s={s} />
      <button className="btn-primary" disabled={pending}>{p.id ? "Save program" : "Create program"}</button>
    </form>
  );
}

export function GrantProgramForm({ programId, providers, defaultDays }: { programId: string; providers: { id: string; name: string }[]; defaultDays: number }) {
  const [s, action, pending] = useActionState(grantProgram, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="program" value={programId} />
      <div>
        <label className="label text-sm" htmlFor="gp-provider">Provider</label>
        <select id="gp-provider" name="provider" required className="input py-2 text-sm">
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[100px_1fr] gap-2">
        <div><label className="label text-sm" htmlFor="gp-days">Days</label><input id="gp-days" name="days" type="number" min={1} max={730} defaultValue={defaultDays} className="input py-2 text-sm" /></div>
        <div><label className="label text-sm" htmlFor="gp-note">Note (required)</label><input id="gp-note" name="note" required placeholder="e.g. Real Care covers new host homes…" className="input py-2 text-sm" /></div>
      </div>
      <button disabled={pending} className="btn-ghost text-sm">Give program, paid by Real Care</button>
      <Msg s={s} />
    </form>
  );
}
