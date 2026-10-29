"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Enter the 6-digit code from the authenticator app to finish signing in (aal2).
export function MfaChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const supabase = createClient();
    const { data: f } = await supabase.auth.mfa.listFactors();
    const factor = f?.totp?.find((x) => x.status === "verified");
    if (!factor) { setBusy(false); return setErr("No authenticator is set up for this account."); }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    setBusy(false);
    if (error) return setErr("That code didn't work. Check the time on your phone and try the newest code.");
    router.replace("/admin");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div>
        <label className="label" htmlFor="mfa-code">6-digit code from your authenticator app</label>
        <input id="mfa-code" className="input text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
      </div>
      {err && <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</button>
    </form>
  );
}

type Factor = { id: string; friendly_name?: string; status: string; created_at: string };

// Set up (or remove) an authenticator app for a staff account.
export function MfaSetup({ blocked }: { blocked: string | null }) {
  const router = useRouter();
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const load = async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactors((data?.all ?? []) as Factor[]);
  };
  useEffect(() => { load(); }, []);
  const verified = factors.filter((f) => f.status === "verified");

  async function start() {
    setMsg({});
    const supabase = createClient();
    for (const f of factors.filter((x) => x.status !== "verified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
    if (error || !data) return setMsg({ err: error?.message ?? "Couldn't start setup." });
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    if (error) return setMsg({ err: "That code didn't work. Try the newest code from the app." });
    setEnroll(null); setCode(""); setMsg({ ok: "Two-step sign-in is on. You'll enter a code each time you sign in." });
    await load();
    router.refresh();
  }
  async function remove(id: string) {
    if (!window.confirm("Remove this authenticator? You'll need to set one up again before using the staff console.")) return;
    const { error } = await createClient().auth.mfa.unenroll({ factorId: id });
    if (error) return setMsg({ err: "Enter a code first (sign out and back in), then remove it." });
    await load(); router.refresh();
  }

  if (blocked) return <p className="rounded-xl bg-amber-soft p-4 text-amber">{blocked}</p>;
  return (
    <div className="space-y-4">
      {verified.length > 0 ? (
        <div className="rounded-xl bg-green-soft p-4">
          <p className="font-semibold text-green">✓ Two-step sign-in is on</p>
          <ul className="mt-2 text-sm">{verified.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2"><span>{f.friendly_name ?? "Authenticator app"} · added {new Date(f.created_at).toLocaleDateString()}</span>
              <button className="text-sm font-semibold text-coral hover:underline" onClick={() => remove(f.id)}>Remove</button></li>
          ))}</ul>
        </div>
      ) : !enroll ? (
        <button className="btn-primary" onClick={start}>Set up an authenticator app</button>
      ) : (
        <form onSubmit={confirm} className="space-y-4">
          <ol className="list-decimal space-y-1 pl-6">
            <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy).</li>
            <li>Scan this code, or type the key below.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR code to add Real Care Portal to your authenticator app" width={192} height={192} className="h-48 w-48 rounded-xl border border-line bg-white p-2" />
          <p className="text-sm">Key: <code className="rounded bg-sand px-1.5 py-0.5 break-all">{enroll.secret}</code></p>
          <div><label className="label" htmlFor="mfa-new">Code</label><input id="mfa-new" className="input max-w-[12rem] text-center text-xl tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></div>
          <button className="btn-primary" disabled={code.length !== 6}>Turn on</button>
        </form>
      )}
      {msg.err && <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{msg.err}</p>}
      {msg.ok && <p role="status" className="rounded-lg bg-green-soft px-3 py-2 text-sm text-green">{msg.ok}</p>}
    </div>
  );
}
