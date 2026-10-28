"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormEngine } from "@/components/form-engine";
import type { FormSchema } from "@/lib/forms";
import {
  assignForm, createTemplate, declineApplicant, endLink, inviteApplicant, linkProvider, markStaffNotificationsRead,
  publishVersion, saveIndividual, setTemplateFlags, stopRecurring,
} from "@/app/admin/phase2-actions";

type R = { ok?: boolean; error?: string; message?: string; id?: string };
function Msg({ r }: { r?: R }) {
  if (!r) return null;
  if (r.error) return <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{r.error}</p>;
  if (r.message) return <p role="status" className="rounded-lg bg-green-soft px-3 py-2 text-sm text-green">{r.message}</p>;
  return null;
}

// ---------------- people supported
export function IndividualForm({ i }: { i?: { id: string; full_name: string; date_of_birth: string | null; goals: string[]; notes: string; active: boolean } }) {
  const router = useRouter();
  const [r, action, pending] = useActionState(async (p: R | undefined, fd: FormData) => {
    const res = await saveIndividual(p, fd);
    if (res.ok && !i && res.id) router.push(`/admin/individuals/${res.id}`);
    return res;
  }, undefined);
  return (
    <form action={action} className="space-y-4">
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="ind-name">Name</label><input id="ind-name" name="full_name" className="input" defaultValue={i?.full_name} required /></div>
        <div><label className="label" htmlFor="ind-dob">Date of birth</label><input id="ind-dob" name="date_of_birth" type="date" className="input" defaultValue={i?.date_of_birth ?? ""} /></div>
      </div>
      <div>
        <label className="label" htmlFor="ind-goals">Goals (one per line)</label>
        <textarea id="ind-goals" name="goals" rows={4} className="input" defaultValue={(i?.goals ?? []).join("\n")} />
        <p className="mt-1 text-sm text-muted">Goals pre-fill on log notes and goal tracking forms.</p>
      </div>
      <div><label className="label" htmlFor="ind-notes">Staff notes</label><textarea id="ind-notes" name="notes" rows={2} className="input" defaultValue={i?.notes} /></div>
      {i && (
        <label className="flex items-center gap-2"><input type="hidden" name="active_flag" value="1" /><input type="checkbox" name="active" value="on" defaultChecked={i.active} /> Receiving services</label>
      )}
      <Msg r={r} />
      <button className="btn-primary" disabled={pending}>{i ? "Save" : "Add person"}</button>
    </form>
  );
}

export function LinkProviderForm({ individualId, providers }: { individualId: string; providers: { id: string; name: string }[] }) {
  const [r, action, pending] = useActionState(linkProvider, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="individual_id" value={individualId} />
      <div className="min-w-56 flex-1"><label className="label" htmlFor="lp-p">Provider</label>
        <select id="lp-p" name="provider_id" className="input">{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div><label className="label" htmlFor="lp-d">Starts</label><input id="lp-d" name="starts_on" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
      <button className="btn-primary" disabled={pending}>Link</button>
      <div className="w-full"><Msg r={r} /></div>
    </form>
  );
}

export function EndLinkButton({ individualId, providerId }: { individualId: string; providerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [pending, start] = useTransition();
  if (!open) return <button className="text-sm font-semibold text-coral hover:underline" onClick={() => setOpen(true)}>End</button>;
  return (
    <span className="flex items-center gap-2">
      <input type="date" aria-label="End date" className="input w-40 py-1" value={date} onChange={(e) => setDate(e.target.value)} />
      <button className="btn-danger py-1" disabled={pending} onClick={() => start(async () => { await endLink(individualId, providerId, date); router.refresh(); })}>End link</button>
    </span>
  );
}

// ---------------- forms
type T = { id: string; title: string; per_individual: boolean };
export function AssignForm({ templates, providers, people, links, defaultTemplate }: {
  templates: T[]; providers: { id: string; name: string }[]; people: { id: string; name: string }[];
  links: { provider_id: string; individual_id: string }[]; defaultTemplate?: string;
}) {
  const [r, action, pending] = useActionState(assignForm, undefined);
  const [tpl, setTpl] = useState(defaultTemplate ?? templates[0]?.id);
  const [person, setPerson] = useState(people[0]?.id ?? "");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const t = templates.find((x) => x.id === tpl);
  const eligible = useMemo(() => (t?.per_individual ? providers.filter((p) => links.some((l) => l.provider_id === p.id && l.individual_id === person)) : providers), [t, providers, links, person]);
  const due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label" htmlFor="af-t">Form</label>
          <select id="af-t" name="template" className="input" value={tpl} onChange={(e) => { setTpl(e.target.value); setChosen(new Set()); }}>
            {templates.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
          </select></div>
        {t?.per_individual && (
          <div><label className="label" htmlFor="af-i">About which person</label>
            <select id="af-i" name="individual" className="input" value={person} onChange={(e) => { setPerson(e.target.value); setChosen(new Set()); }}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
        )}
        <div><label className="label" htmlFor="af-d">First due date</label><input id="af-d" name="due" type="date" className="input" defaultValue={due} /></div>
        <div><label className="label" htmlFor="af-f">Repeat</label>
          <select id="af-f" name="frequency" className="input" defaultValue="once">
            <option value="once">Just once</option><option value="daily">Every day</option><option value="weekly">Every week</option>
            <option value="monthly">Every month</option><option value="quarterly">Every quarter</option>
          </select></div>
      </div>
      <fieldset>
        <legend className="label">Providers {t?.per_individual && <span className="font-normal text-muted">(only those currently supporting this person)</span>}</legend>
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
          {eligible.length === 0 && <p className="p-2 text-sm text-muted">No provider currently supports this person.</p>}
          {eligible.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sand">
              <input type="checkbox" name="providers" value={p.id} checked={chosen.has(p.id)} onChange={(e) => { const n = new Set(chosen); if (e.target.checked) n.add(p.id); else n.delete(p.id); setChosen(n); }} />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Msg r={r} />
      <button className="btn-primary" disabled={pending || chosen.size === 0}>Assign to {chosen.size || ""} provider{chosen.size === 1 ? "" : "s"}</button>
    </form>
  );
}

export function NewTemplateForm() {
  const router = useRouter();
  const [r, action, pending] = useActionState(async (p: R | undefined, fd: FormData) => {
    const res = await createTemplate(p, fd);
    if (res.ok && res.id) router.push(`/admin/forms/${res.id}`);
    return res;
  }, undefined);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <div><label className="label" htmlFor="nt-en">Name (English)</label><input id="nt-en" name="title_en" className="input" required /></div>
      <div><label className="label" htmlFor="nt-es">Name (Spanish)</label><input id="nt-es" name="title_es" className="input" /></div>
      <div><label className="label" htmlFor="nt-c">Category</label>
        <select id="nt-c" name="category" className="input"><option value="daily">Daily documentation</option><option value="medical">Medical</option><option value="safety">Safety</option><option value="incident">Incident</option><option value="general">General</option></select></div>
      <div className="flex flex-col justify-end gap-1 pb-1">
        <label className="flex items-center gap-2"><input type="checkbox" name="per_individual" defaultChecked /> About a specific person</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="self_start" /> Providers can start it themselves (QR code)</label>
      </div>
      <div className="md:col-span-2"><Msg r={r} /><button className="btn-primary mt-2" disabled={pending}>Create and open editor</button></div>
    </form>
  );
}

export function TemplateEditor({ templateId, initial, individual }: { templateId: string; initial: FormSchema; individual: { full_name: string; goals: string[] } }) {
  const router = useRouter();
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  const [note, setNote] = useState("");
  const [lang, setLang] = useState<"en" | "es">("en");
  const [r, setR] = useState<R>();
  const [pending, start] = useTransition();
  const parsed = useMemo(() => {
    try { const s = JSON.parse(text) as FormSchema; if (!Array.isArray(s.sections)) throw new Error("Needs a sections list"); return { s }; }
    catch (e) { return { err: (e as Error).message }; }
  }, [text]);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="min-w-0 space-y-3">
        <label className="label" htmlFor="schema">Form definition (JSON)</label>
        <textarea id="schema" spellCheck={false} className="input h-[36rem] font-mono text-[13px] leading-5" value={text} onChange={(e) => setText(e.target.value)} />
        {parsed.err && <p role="alert" className="text-sm text-coral">JSON problem: {parsed.err}</p>}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1"><label className="label" htmlFor="vnote">What changed?</label><input id="vnote" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Added a question about meals" /></div>
          <button className="btn-primary" disabled={pending || !!parsed.err} onClick={() => start(async () => { const res = await publishVersion(templateId, text, note); setR(res); if (res.ok) { setNote(""); router.refresh(); } })}>Publish new version</button>
        </div>
        <Msg r={r} />
        <details className="rounded-xl border border-line p-3 text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-ink">Field types</summary>
          <p className="mt-2">text, textarea, date, time, number, currency, phone, select, radio, checkboxes (with <code>options</code>), signature, file (attachment), info (<code>body_en</code>/<code>body_es</code> text block), prefill (<code>source</code>: individual.full_name or individual.goals), and repeater (rows with <code>columns</code>; a column of type <code>hours</code> with <code>from: [timeIn, timeOut]</code> calculates hours; <code>totals</code> lists columns to sum). <code>show_if</code> takes <code>{"{"}field, equals{"}"}</code> or <code>{"{"}logic: all|any, action: show|hide, rules: [{"{"}field, op, value{"}"}]{"}"}</code>. Every field has <code>label_en</code> and <code>label_es</code>.</p>
        </details>
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <p className="label mb-0">Live preview (fictional person)</p>
          <div className="flex rounded-full border border-line p-0.5 text-sm">
            {(["en", "es"] as const).map((l) => <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} className={`rounded-full px-3 py-1 font-semibold ${lang === l ? "bg-teal text-white" : "text-muted"}`}>{l.toUpperCase()}</button>)}
          </div>
        </div>
        <div className="rounded-2xl bg-paper p-3">
          {parsed.s ? <FormEngine key={lang + text.length} preview assignmentId="preview" schema={parsed.s} lang={lang} individual={individual} mode="new" doneHref="#" /> : <p className="p-4 text-muted">Fix the JSON to see the preview.</p>}
        </div>
      </div>
    </div>
  );
}

export function TemplateFlag({ templateId, flag, on, label }: { templateId: string; flag: "active" | "self_start"; on: boolean; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={on} disabled={pending} onChange={(e) => start(async () => { await setTemplateFlags(templateId, { [flag]: e.target.checked }); router.refresh(); })} /> {label}
    </label>
  );
}

export function StopRecurringButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className="text-sm font-semibold text-coral hover:underline" disabled={pending} onClick={() => start(async () => { await stopRecurring(id); router.refresh(); })}>Stop</button>;
}

// ---------------- applications and alerts
export function ApplicationActions({ id }: { id: string }) {
  const router = useRouter();
  const [link, setLink] = useState<string>();
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  if (link) {
    const url = typeof window !== "undefined" ? window.location.origin + link : link;
    return (
      <span className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-green">Invitation created.</span>
        <button className="btn-ghost py-1" onClick={() => navigator.clipboard.writeText(url)}>Copy link</button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <button className="btn-primary py-1.5" disabled={pending} onClick={() => start(async () => { const r = await inviteApplicant(id); if (r.error) setErr(r.error); else { setLink(r.link); router.refresh(); } })}>Invite</button>
      <button className="btn-ghost py-1.5" disabled={pending} onClick={() => start(async () => { await declineApplicant(id); router.refresh(); })}>Decline</button>
      {err && <span role="alert" className="text-sm text-coral">{err}</span>}
    </span>
  );
}

export function MarkStaffRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await markStaffNotificationsRead(); router.refresh(); })}>Mark all as read</button>;
}
