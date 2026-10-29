"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewSubmission } from "@/app/actions";

export function ReviewPanel({ submissionId, fields }: { submissionId: string; fields: { id: string; label: string }[] }) {
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const flagged = Object.keys(flags);

  const act = (action: "return" | "accept") =>
    start(async () => {
      const r = await reviewSubmission(submissionId, action, action === "return" ? flags : {}, note);
      if (r.error) setError(r.error);
      else router.push("/admin/review");
    });

  return (
    <div className="card p-5">
      <h2 className="font-bold">Review</h2>
      <p className="mb-3 text-sm text-muted">Tick any field that needs a fix and say what to change. The provider can edit only those fields.</p>
      <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {fields.map((f) => {
          const on = f.id in flags;
          return (
            <li key={f.id} className={`rounded-xl border p-2.5 ${on ? "border-coral bg-coral-soft/50" : "border-line"}`}>
              <label className="flex cursor-pointer items-start gap-2 text-sm font-medium">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#c4553a]" checked={on}
                  onChange={(e) => setFlags((x) => { const n = { ...x }; if (e.target.checked) n[f.id] = ""; else delete n[f.id]; return n; })} />
                {f.label}
              </label>
              {on && (
                <input autoFocus className="input mt-2 py-1.5 text-sm" placeholder="e.g. Add the time you left…" value={flags[f.id]}
                  onChange={(e) => setFlags((x) => ({ ...x, [f.id]: e.target.value }))} />
              )}
            </li>
          );
        })}
      </ul>
      <label htmlFor="note" className="label mt-4 text-sm">Note to provider (optional)</label>
      <textarea id="note" rows={2} className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button disabled={pending || flagged.length === 0} onClick={() => act("return")} className="btn-danger">
          Return {flagged.length ? `(${flagged.length})` : ""}
        </button>
        <button disabled={pending || flagged.length > 0} onClick={() => act("accept")} className="btn-primary">Accept</button>
      </div>
      <p className="mt-2 text-xs text-muted">Every view and decision is written to the audit log.</p>
    </div>
  );
}
