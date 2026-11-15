"use client";

import { useActionState } from "react";
import { pullFromWix, setImportTypes, commitWixImport, discardWixImport } from "@/app/admin/wix-import-actions";
import { PROVIDER_TYPE_OPTIONS } from "@/lib/provider-types";

type R = { ok?: boolean; error?: string; message?: string } | undefined;

function Msg({ s }: { s: R }) {
  if (s?.error) return <p role="alert" className="text-sm text-coral">{s.error}</p>;
  if (s?.message) return <p role="status" className="text-sm text-green">{s.message}</p>;
  return null;
}

export function PullForm({ demo }: { demo: boolean }) {
  const [s, act, pending] = useActionState(pullFromWix, undefined as R);
  return (
    <form action={act} className="space-y-4">
      <div className="max-w-sm">
        <label className="label" htmlFor="wx-default">Type for people with no type label on Wix</label>
        <select id="wx-default" name="default_type" className="input" defaultValue="family_caregiver">
          <option value="">Leave unassigned (I&apos;ll choose each one)</option>
          {PROVIDER_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <p className="mt-1 text-sm text-muted">Wix labels &quot;FCG&quot; and &quot;Family Caregiver&quot; become Family Caregiver; &quot;RCI Provider&quot; becomes RCI Provider.</p>
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? "Reading Wix… this can take a minute" : demo ? "Load the sample Wix data (fictional)" : "Pull everyone from Wix"}
      </button>
      <p className="text-sm text-muted">This only reads Wix and shows you a preview. Nothing is added until you press Add.</p>
      <Msg s={s} />
    </form>
  );
}

export function TypeEditor({ personId, types }: { personId: string; types: string[] }) {
  const [s, act, pending] = useActionState(setImportTypes, undefined as R);
  return (
    <form action={act} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <input type="hidden" name="person_id" value={personId} />
      {PROVIDER_TYPE_OPTIONS.map(([v, l]) => (
        <label key={v} className="inline-flex items-center gap-1 text-xs">
          <input type="checkbox" name="types" value={v} defaultChecked={types.includes(v)} /> {l}
        </label>
      ))}
      <button className="text-xs font-semibold text-teal hover:underline disabled:opacity-50" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      {s?.error && <span role="alert" className="text-xs text-coral">{s.error}</span>}
      {s?.ok && <span role="status" className="text-xs text-green">Saved</span>}
    </form>
  );
}

export function CommitBar({ runId, ready }: { runId: string; ready: number }) {
  const [c, commit, committing] = useActionState(commitWixImport, undefined as R);
  const [d, discard, discarding] = useActionState(discardWixImport, undefined as R);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <form action={commit}>
          <input type="hidden" name="run_id" value={runId} />
          <button className="btn-primary" disabled={committing || ready === 0}>
            {committing ? "Adding…" : `Add ${ready} provider${ready === 1 ? "" : "s"} (no logins, no emails)`}
          </button>
        </form>
        <form action={discard}>
          <input type="hidden" name="run_id" value={runId} />
          <button className="btn-ghost" disabled={discarding}>{discarding ? "Discarding…" : "Discard this preview"}</button>
        </form>
      </div>
      <Msg s={c ?? d} />
    </div>
  );
}
