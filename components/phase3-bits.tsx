"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPasswordReset, markThreadRead, requestPasswordHelp, saveAnnouncement, setAccountActive, setThread,
  updateAnnouncement, applyPasswordReset,
} from "@/app/phase3-actions";

type R = { ok?: boolean; error?: string; message?: string; link?: string };
function Msg({ r }: { r?: R }) {
  if (!r) return null;
  if (r.error) return <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{r.error}</p>;
  if (r.message) return <p role="status" className="rounded-lg bg-green-soft px-3 py-2 text-sm text-green">{r.message}</p>;
  return null;
}

// Marks a thread read when it's opened (no visible UI).
export function MarkThreadRead({ providerId }: { providerId: string }) {
  const router = useRouter();
  useEffect(() => { markThreadRead(providerId).then(() => router.refresh()); }, [providerId, router]);
  return null;
}

export function ThreadControls({ providerId, status, assignedTo, staff }: { providerId: string; status: string; assignedTo: string | null; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const update = (s: string | null, a: string | null) => start(async () => { const r = await setThread(providerId, s, a); if (r.error) setErr(r.error); else router.refresh(); });
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label text-sm" htmlFor="th-status">Status</label>
        <select id="th-status" className="input py-1.5" disabled={pending} value={status} onChange={(e) => update(e.target.value, assignedTo)}>
          <option value="open">Open (needs staff)</option><option value="waiting">Waiting on provider</option><option value="closed">Closed</option>
        </select>
      </div>
      <div>
        <label className="label text-sm" htmlFor="th-assign">Assigned to</label>
        <select id="th-assign" className="input py-1.5" disabled={pending} value={assignedTo ?? ""} onChange={(e) => update(status, e.target.value || null)}>
          <option value="">Nobody yet</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {err && <p role="alert" className="text-sm text-coral">{err}</p>}
    </div>
  );
}

const TYPES = [["host_home", "Host Home"], ["family_caregiver", "Family Caregiver"], ["scc_dsp", "SCC/DSP"], ["nmt", "NMT"]] as const;

export function AnnouncementForm() {
  const [r, action, pending] = useActionState(saveAnnouncement, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label" htmlFor="an-te">Title (English)</label><input id="an-te" name="title_en" className="input" required maxLength={140} /></div>
        <div><label className="label" htmlFor="an-ts">Title (Spanish)</label><input id="an-ts" name="title_es" className="input" maxLength={140} placeholder="Leave blank to show the English…" /></div>
        <div><label className="label" htmlFor="an-be">Message (English)</label><textarea id="an-be" name="body_en" rows={4} className="input" required maxLength={4000} /></div>
        <div><label className="label" htmlFor="an-bs">Message (Spanish)</label><textarea id="an-bs" name="body_es" rows={4} className="input" maxLength={4000} /></div>
      </div>
      <fieldset>
        <legend className="label">Who sees it</legend>
        <p className="mb-2 text-sm text-muted">Choose none to send to every provider.</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(([v, l]) => (
            <label key={v} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
              <input type="checkbox" name="audience" value={v} /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" name="pinned" /> Pin to the top</label>
        <div><label className="label" htmlFor="an-ex">Hide after (optional)</label><input id="an-ex" name="expires_on" type="date" className="input" /></div>
      </div>
      <p className="text-sm text-muted">Announcements go to everyone in the chosen groups. Don&apos;t include anything about a specific person supported.</p>
      <Msg r={r} />
      <button className="btn-primary" disabled={pending}>Post announcement</button>
    </form>
  );
}

export function AnnouncementActions({ id, pinned, archived }: { id: string; pinned: boolean; archived: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (patch: { pinned?: boolean; archived?: boolean }) => start(async () => { await updateAnnouncement(id, patch); router.refresh(); });
  return (
    <span className="flex gap-3 text-sm font-semibold">
      <button className="text-teal hover:underline" disabled={pending} onClick={() => run({ pinned: !pinned })}>{pinned ? "Unpin" : "Pin"}</button>
      <button className={archived ? "text-teal hover:underline" : "text-coral hover:underline"} disabled={pending} onClick={() => run({ archived: !archived })}>{archived ? "Restore" : "Archive"}</button>
    </span>
  );
}

export function ForgotForm() {
  const [lang, setLang] = useState<"en" | "es">("en");
  const es = lang === "es";
  const [r, action, pending] = useActionState(requestPasswordHelp, undefined);
  if (r?.ok) {
    return (
      <div className="card p-6" role="status">
        <p className="font-semibold">{es ? "Gracias. Le avisamos al personal de Real Care." : "Thanks. We let Real Care staff know."}</p>
        <p className="mt-2 text-muted">{es ? "Si el correo tiene una cuenta, el personal le enviará un enlace para elegir una contraseña nueva." : "If that email has an account, staff will send you a link to choose a new password."}</p>
      </div>
    );
  }
  return (
    <form action={action} className="card space-y-4 p-6">
      <div className="flex justify-end">
        <div className="flex rounded-full border border-line p-0.5 text-sm" role="group" aria-label="Language">
          {(["en", "es"] as const).map((l) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 font-semibold ${lang === l ? "bg-teal text-white" : "text-muted"}`}>{l.toUpperCase()}</button>)}
        </div>
      </div>
      <p className="text-muted">{es ? "Escriba el correo de su cuenta. El personal de Real Care le enviará un enlace para elegir una contraseña nueva." : "Enter the email for your account. Real Care staff will send you a link to choose a new password."}</p>
      <div><label className="label" htmlFor="fp-email">{es ? "Correo electrónico" : "Email"}</label><input id="fp-email" name="email" type="email" spellCheck={false} className="input" required autoComplete="email" /></div>
      <button className="btn-primary w-full" disabled={pending}>{es ? "Pedir ayuda" : "Ask for help"}</button>
    </form>
  );
}

export function ResetForm({ token, es }: { token: string; es: boolean }) {
  const [r, action, pending] = useActionState(applyPasswordReset, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div><label className="label" htmlFor="rp-1">{es ? "Contraseña nueva (10 caracteres o más)" : "New password (10 characters or more)"}</label><input id="rp-1" name="password" type="password" minLength={10} required autoComplete="new-password" className="input" /></div>
      <div><label className="label" htmlFor="rp-2">{es ? "Escríbala otra vez" : "Type it again"}</label><input id="rp-2" name="confirm" type="password" minLength={10} required autoComplete="new-password" className="input" /></div>
      <Msg r={r} />
      <button className="btn-primary w-full" disabled={pending}>{es ? "Guardar contraseña" : "Save password"}</button>
    </form>
  );
}

export function ResetLinkButton({ profileId }: { profileId: string }) {
  const [link, setLink] = useState<string>();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  if (link) {
    const url = typeof window !== "undefined" ? window.location.origin + link : link;
    return (
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-green">Reset link ready. It works once and expires in 48 hours.</p>
        <div className="flex gap-2"><input readOnly aria-label="Reset link" className="input py-1.5 text-sm" value={url} /><button className="btn-ghost py-1.5" onClick={() => navigator.clipboard.writeText(url)}>Copy</button></div>
        <p className="text-muted">Send it to the provider by text or email. Using it signs them out everywhere else.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { const r = await createPasswordReset(profileId); if (r.error) setErr(r.error); else setLink(r.link); })}>Create password reset link</button>
      {err && <p role="alert" className="text-sm text-coral">{err}</p>}
    </div>
  );
}

export function ActiveToggle({ profileId, active, name }: { profileId: string; active: boolean; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const go = () => start(async () => { const r = await setAccountActive(profileId, !active); if (r.error) setErr(r.error); else { setConfirming(false); router.refresh(); } });
  if (active && !confirming) return <button className="btn-ghost text-coral" onClick={() => setConfirming(true)}>Deactivate account</button>;
  return (
    <div className="space-y-2">
      {active && <p className="text-sm">Deactivate {name}? They&apos;re signed out right away and can&apos;t sign in. Their history stays.</p>}
      <div className="flex gap-2">
        <button className={active ? "btn-danger" : "btn-primary"} disabled={pending} onClick={go}>{active ? "Yes, deactivate" : "Reactivate account"}</button>
        {active && <button className="btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>}
      </div>
      {err && <p role="alert" className="text-sm text-coral">{err}</p>}
    </div>
  );
}
