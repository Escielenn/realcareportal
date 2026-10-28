"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  bulkAction, markComplete, grantAccess, refundOrder, toggleRequirement, createInvite, deleteInvite,
  stageImport, setImportMatch, commitImport, saveCourse, moveLesson, deleteLesson, saveLesson, setLessonVideo, saveQuiz, addLesson,
} from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";

function Msg({ s }: { s?: { error?: string; message?: string } }) {
  if (!s) return null;
  if (s.error) return <p role="alert" className="text-sm text-coral">{s.error}</p>;
  if (s.message) return <p role="status" className="text-sm font-semibold text-green">✓ {s.message}</p>;
  return null;
}

// ---------------------------------------------------------------- providers table with bulk actions
export type BulkRow = { id: string; name: string; email: string; spanish: boolean; types: string; due: string; cycle: number | null; done: number; required: number; statusEl: React.ReactNode };

export function ProvidersTable({ rows }: { rows: BulkRow[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [due, setDue] = useState("");
  const [msg, setMsg] = useState<{ error?: string; message?: string }>();
  const [pending, start] = useTransition();
  const all = rows.length > 0 && sel.size === rows.length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const run = (a: "open" | "remind" | "extend") => {
    if (a === "open" && !confirm(`Open a new training cycle today for ${sel.size} provider(s)? Past cycles are kept.`)) return;
    start(async () => { const r = await bulkAction(a, [...sel], due); setMsg(r); if (r.ok) setSel(new Set()); });
  };
  return (
    <div className="space-y-3">
      <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border p-3 ${sel.size ? "border-teal bg-teal-soft" : "border-line bg-white"}`}>
        <span className="text-sm font-semibold">{sel.size ? `${sel.size} selected` : "Select providers for bulk actions"}</span>
        <button disabled={!sel.size || pending} onClick={() => run("remind")} className="btn-ghost px-3 py-1.5 text-sm">Send reminder</button>
        <button disabled={!sel.size || pending} onClick={() => run("open")} className="btn-ghost px-3 py-1.5 text-sm">Open new cycle</button>
        <span className="flex items-center gap-1">
          <label className="sr-only" htmlFor="due">New due date</label>
          <input id="due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input w-40 py-1.5 text-sm" />
          <button disabled={!sel.size || !due || pending} onClick={() => run("extend")} className="btn-ghost px-3 py-1.5 text-sm">Set due date</button>
        </span>
        <Msg s={msg} />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="border-b border-line bg-sand/60 text-sm text-muted">
            <tr>
              <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} className="h-4 w-4 accent-[#0f5c5f]" /></th>
              <th className="px-2 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Current cycle due</th>
              <th className="w-48 px-4 py-3 font-semibold">Required courses</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={sel.has(r.id) ? "bg-teal-soft/40" : "hover:bg-sand/40"}>
                <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[#0f5c5f]" /></td>
                <td className="px-2 py-3">
                  <Link href={`/admin/providers/${r.id}`} className="font-semibold text-teal hover:underline">{r.name}</Link>
                  <p className="text-sm text-muted">{r.email}{r.spanish ? " · Español" : ""}</p>
                </td>
                <td className="px-4 py-3 text-sm">{r.types}</td>
                <td className="px-4 py-3 text-sm">{r.due}<p className="text-muted">Cycle {r.cycle}</p></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-teal" style={{ width: `${r.required ? (100 * r.done) / r.required : 0}%` }} /></div>
                    <span className="shrink-0 text-sm font-semibold">{r.done}/{r.required}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{r.statusEl}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No providers match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- provider detail forms
export function MarkCompleteForm({ providerId, courses }: { providerId: string; courses: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(markComplete, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="provider" value={providerId} />
      <div>
        <label className="label text-sm" htmlFor="mc-course">Course</label>
        <select id="mc-course" name="course" required className="input py-2 text-sm">
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label text-sm" htmlFor="mc-date">Completed on</label><input id="mc-date" name="date" type="date" required className="input py-2 text-sm" /></div>
        <div><label className="label text-sm" htmlFor="mc-note">Reason (required)</label><input id="mc-note" name="note" required placeholder="e.g. In-person class" className="input py-2 text-sm" /></div>
      </div>
      <button disabled={pending} className="btn-ghost text-sm">Mark complete</button>
      <Msg s={state} />
    </form>
  );
}

export function GrantAccessForm({ providerId, providers, courses }: { providerId?: string; providers?: { id: string; name: string }[]; courses: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(grantAccess, undefined);
  return (
    <form action={action} className="space-y-3">
      {providerId ? <input type="hidden" name="provider" value={providerId} /> : (
        <div>
          <label className="label text-sm" htmlFor="ga-provider">Provider</label>
          <select id="ga-provider" name="provider" required className="input py-2 text-sm">
            {providers?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label text-sm" htmlFor="ga-course">Access to</label>
        <select id="ga-course" name="course" className="input py-2 text-sm">
          <option value="">All-Access (14 core courses)</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-[100px_1fr] gap-2">
        <div><label className="label text-sm" htmlFor="ga-days">Days</label><input id="ga-days" name="days" type="number" min={1} max={730} defaultValue={365} className="input py-2 text-sm" /></div>
        <div><label className="label text-sm" htmlFor="ga-note">Note (required)</label><input id="ga-note" name="note" required placeholder="e.g. Real Care covers QMAP for new host homes" className="input py-2 text-sm" /></div>
      </div>
      <button disabled={pending} className="btn-ghost text-sm">Grant access, paid by Real Care</button>
      <Msg s={state} />
    </form>
  );
}

export function RefundButton({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  return (
    <span>
      <button disabled={pending} className="text-sm font-semibold text-coral hover:underline"
        onClick={() => { if (confirm("Refund this order? Access from it ends today.")) start(async () => { const r = await refundOrder(orderId); setMsg(r.error); }); }}>
        Refund
      </button>
      {msg && <span className="ml-2 text-xs text-coral">{msg}</span>}
    </span>
  );
}

// ---------------------------------------------------------------- requirements matrix
export function RequirementToggle({ type, courseId, on }: { type: string; courseId: string; on: boolean }) {
  const [checked, setChecked] = useState(on);
  const [pending, start] = useTransition();
  return (
    <input type="checkbox" aria-label="Required" disabled={pending} checked={checked} className="h-5 w-5 cursor-pointer accent-[#0f5c5f]"
      onChange={(e) => { const v = e.target.checked; setChecked(v); start(async () => { const r = await toggleRequirement(type, courseId, v); if (r.error) { setChecked(!v); alert(r.error); } }); }} />
  );
}

// ---------------------------------------------------------------- invites
export function InviteForm() {
  const [state, action, pending] = useActionState(createInvite, undefined);
  const [copied, setCopied] = useState(false);
  const full = state?.link ? `${typeof window !== "undefined" ? window.location.origin : ""}${state.link}` : "";
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label text-sm" htmlFor="inv-name">Full name</label><input id="inv-name" name="full_name" required className="input py-2" /></div>
        <div><label className="label text-sm" htmlFor="inv-email">Email</label><input id="inv-email" name="email" type="email" required className="input py-2" /></div>
      </div>
      <fieldset>
        <legend className="label text-sm">Provider type</legend>
        <div className="flex flex-wrap gap-2">
          {[["host_home", "Host Home"], ["family_caregiver", "Family Caregiver"], ["scc_dsp", "SCC/DSP"], ["nmt", "NMT"]].map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
              <input type="checkbox" name="types" value={v} className="accent-[#0f5c5f]" /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label text-sm">Language</legend>
        <div className="flex gap-2">
          {[["en", "English"], ["es", "Español"]].map(([v, l]) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
              <input type="radio" name="locale" value={v} defaultChecked={v === "en"} className="accent-[#0f5c5f]" /> {l}
            </label>
          ))}
        </div>
      </fieldset>
      <button disabled={pending} className="btn-primary">Create invitation</button>
      <Msg s={state} />
      {state?.link && (
        <div className="rounded-xl bg-teal-soft p-3 text-sm">
          <p className="font-semibold">Invitation link (valid 14 days)</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="break-all">{full}</code>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => { navigator.clipboard.writeText(full); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
            <a href={state.link} target="_blank" rel="noreferrer" className="text-teal underline">Open</a>
          </div>
          <p className="mt-1 text-muted">In production this link is emailed automatically. The email contains no personal details beyond the name.</p>
        </div>
      )}
    </form>
  );
}

export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="text-sm font-semibold text-teal hover:underline"
      onClick={() => { navigator.clipboard.writeText(window.location.origin + path); setCopied(true); }}>
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function DeleteInviteButton({ inviteId }: { inviteId: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(async () => { await deleteInvite(inviteId); })} className="text-sm text-coral hover:underline">Cancel</button>;
}

// ---------------------------------------------------------------- legacy import
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
function normDate(s: string) {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
  const d = new Date(t);
  return isNaN(+d) ? t : d.toISOString().slice(0, 10);
}

export function ImportUploader({ courses }: { courses: { id: string; title: string }[] }) {
  const router = useRouter();
  const [course, setCourse] = useState(courses[0]?.id ?? "");
  const [file, setFile] = useState<{ name: string; rows: { name: string; email: string; completed: string }[]; headers: string[] } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  async function onFile(f: File) {
    setError(undefined);
    const rows = parseCsv(await f.text());
    if (rows.length < 2) { setError("The file has no data rows."); return; }
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const find = (...names: string[]) => headers.findIndex((h) => names.some((n) => h.includes(n)));
    const iName = find("name", "participant"), iEmail = find("email"), iDate = find("completed", "completion", "date");
    if (iEmail < 0 || iDate < 0) { setError("Couldn't find Email and Completed Date columns."); return; }
    setFile({ name: f.name, headers: rows[0], rows: rows.slice(1).map((r) => ({ name: (r[iName] ?? "").trim(), email: (r[iEmail] ?? "").trim(), completed: normDate(r[iDate] ?? "") })) });
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label text-sm" htmlFor="imp-course">Course in this file</label>
          <select id="imp-course" value={course} onChange={(e) => setCourse(e.target.value)} className="input py-2">
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-sm" htmlFor="imp-file">Wix participants CSV</label>
          <input id="imp-file" type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="input py-1.5 text-sm" />
        </div>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      {file && (
        <div className="rounded-xl bg-sand p-3 text-sm">
          <p><strong>{file.name}</strong>: {file.rows.length} rows. Columns found: {file.headers.join(", ")}</p>
          <p className="text-muted">Nothing is saved yet. The next step matches each row to a provider so you can review before importing.</p>
          <button disabled={pending || !course} className="btn-primary mt-3"
            onClick={() => start(async () => {
              const r = await stageImport(course, file.name, file.rows);
              if (r.error) setError(r.error); else router.push(`/admin/import/${r.batch}`);
            })}>
            {pending ? "Matching…" : "Match rows to providers"}
          </button>
        </div>
      )}
    </div>
  );
}

export function MatchSelect({ rowId, current, providers }: { rowId: number; current: string | null; providers: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <select disabled={pending} defaultValue={current ?? ""} aria-label="Match to provider" className="input py-1 text-sm"
      onChange={(e) => start(async () => { await setImportMatch(rowId, e.target.value || null); })}>
      <option value="">No match</option>
      {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

export function CommitImportButton({ batchId, count }: { batchId: string; count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; message?: string }>();
  return (
    <div className="flex items-center gap-3">
      <button disabled={pending || count === 0} className="btn-primary"
        onClick={() => { if (confirm(`Import ${count} completion(s)? Each is added to the training cycle that contains its date.`)) start(async () => setMsg(await commitImport(batchId))); }}>
        Import {count} matched row{count === 1 ? "" : "s"}
      </button>
      <Msg s={msg} />
    </div>
  );
}

// ---------------------------------------------------------------- course builder
export function CourseForm({ c }: { c: Record<string, unknown> }) {
  const [state, action, pending] = useActionState(saveCourse, undefined);
  const v = (k: string) => String(c[k] ?? "");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={v("id")} />
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className="label text-sm">Title (English)</label><input name="title_en" defaultValue={v("title_en")} required className="input py-2" /></div>
        <div><label className="label text-sm">Título (español)</label><input name="title_es" defaultValue={v("title_es")} required className="input py-2" /></div>
        <div><label className="label text-sm">Description (English)</label><textarea name="description_en" rows={3} defaultValue={v("description_en")} className="input py-2" /></div>
        <div><label className="label text-sm">Descripción (español)</label><textarea name="description_es" rows={3} defaultValue={v("description_es")} className="input py-2" /></div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div><label className="label text-sm">Price ($)</label><input name="price" type="number" step="0.01" min={0} defaultValue={Number(c.price_cents ?? 0) / 100} className="input w-28 py-2" /></div>
        <div><label className="label text-sm">Access (days)</label><input name="access_days" type="number" min={1} defaultValue={Number(c.access_days ?? 365)} className="input w-28 py-2" /></div>
        {[["in_all_access", "Included in All-Access"], ["is_specialty", "Specialty course"], ["published", "Published to providers"]].map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 pb-2.5 text-sm font-medium"><input type="checkbox" name={k} defaultChecked={Boolean(c[k])} className="h-4 w-4 accent-[#0f5c5f]" /> {l}</label>
        ))}
      </div>
      <div className="flex items-center gap-3"><button disabled={pending} className="btn-primary">Save course</button><Msg s={state} /></div>
    </form>
  );
}

export function LessonRowActions({ courseId, lessonId, first, last }: { courseId: string; lessonId: string; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-1">
      <button disabled={pending || first} onClick={() => start(async () => { await moveLesson(courseId, lessonId, -1); })} className="rounded px-2 py-1 text-muted hover:bg-sand disabled:opacity-30" aria-label="Move up">↑</button>
      <button disabled={pending || last} onClick={() => start(async () => { await moveLesson(courseId, lessonId, 1); })} className="rounded px-2 py-1 text-muted hover:bg-sand disabled:opacity-30" aria-label="Move down">↓</button>
      <button disabled={pending} onClick={() => { if (confirm("Delete this lesson? Progress on it is removed; completed courses stay complete.")) start(async () => { await deleteLesson(courseId, lessonId); }); }} className="rounded px-2 py-1 text-coral hover:bg-coral-soft" aria-label="Delete lesson">✕</button>
    </span>
  );
}

export function AddLessonButtons({ courseId }: { courseId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {([["reading", "+ Reading"], ["video", "+ Video"], ["quiz", "+ Quiz"]] as const).map(([k, l]) => (
        <button key={k} disabled={pending} onClick={() => start(async () => { await addLesson(courseId, k); })} className="btn-ghost px-3 py-1.5 text-sm">{l}</button>
      ))}
    </div>
  );
}

export function LessonForm({ l }: { l: Record<string, unknown> }) {
  const [state, action, pending] = useActionState(saveLesson, undefined);
  const v = (k: string) => String(l[k] ?? "");
  const kind = v("kind");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={v("id")} />
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className="label text-sm">Title (English)</label><input name="title_en" defaultValue={v("title_en")} required className="input py-2" /></div>
        <div><label className="label text-sm">Título (español)</label><input name="title_es" defaultValue={v("title_es")} required className="input py-2" /></div>
        {kind !== "quiz" && (
          <>
            <div>
              <label className="label text-sm">{kind === "video" ? "Intro text (English)" : "Lesson text (English)"}</label>
              <textarea name="body_en" rows={kind === "video" ? 3 : 14} defaultValue={v("body_en")} className="input py-2 font-mono text-sm" />
            </div>
            <div>
              <label className="label text-sm">{kind === "video" ? "Texto de introducción (español)" : "Texto de la lección (español)"}</label>
              <textarea name="body_es" rows={kind === "video" ? 3 : 14} defaultValue={v("body_es")} className="input py-2 font-mono text-sm" />
            </div>
          </>
        )}
      </div>
      {kind === "reading" && <p className="text-sm text-muted">Formatting: start a line with <code>## </code> for a heading, <code>- </code> for a bullet, or wrap a line in <code>*asterisks*</code> for a note.</p>}
      {kind === "quiz" && (
        <div><label className="label text-sm">Pass mark (%)</label><input name="pass_percent" type="number" min={0} max={100} defaultValue={Number(l.pass_percent ?? 80)} className="input w-28 py-2" /></div>
      )}
      <div className="flex items-center gap-3"><button disabled={pending} className="btn-primary">Save lesson</button><Msg s={state} /></div>
    </form>
  );
}

export function VideoUploader({ lessonId, current }: { lessonId: string; current: string | null }) {
  const [status, setStatus] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  async function upload(f: File) {
    if (!f.type.startsWith("video/")) { setStatus("Choose a video file (MP4 works best)."); return; }
    setStatus("Reading video…");
    const seconds = await new Promise<number>((res) => {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.onloadedmetadata = () => { res(el.duration || 0); URL.revokeObjectURL(el.src); };
      el.onerror = () => res(0);
      el.src = URL.createObjectURL(f);
    });
    setStatus(`Uploading ${(f.size / 1048576).toFixed(1)} MB…`);
    const safe = f.name.replace(/[^\w.\-]+/g, "-").slice(-100);
    const path = `lessons/${lessonId}/${Date.now()}-${safe}`;
    const { error } = await createClient().storage.from("training-media").upload(path, f, { contentType: f.type, upsert: false });
    if (error) { setStatus(`Upload failed: ${error.message}`); return; }
    start(async () => {
      const r = await setLessonVideo(lessonId, path, seconds);
      setStatus(r.error ?? `Uploaded. Length ${Math.round(seconds)} seconds.`);
      router.refresh();
    });
  }
  return (
    <div className="space-y-2">
      <label className="label text-sm" htmlFor="vid">{current ? "Replace video" : "Upload video"}</label>
      <input id="vid" type="file" accept="video/*" disabled={pending} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="input py-1.5 text-sm" />
      <p className="text-sm text-muted">Stored privately and streamed with short-lived links. Production uses Mux for adaptive streaming and captions.</p>
      {status && <p className="text-sm font-semibold">{status}</p>}
    </div>
  );
}

type QE = { prompt_en: string; prompt_es: string; options_en: string[]; options_es: string[]; correct: number; explanation_en: string; explanation_es: string };
export function QuizEditor({ lessonId, initial }: { lessonId: string; initial: QE[] }) {
  const [qs, setQs] = useState<QE[]>(initial);
  const [msg, setMsg] = useState<{ error?: string; message?: string }>();
  const [pending, start] = useTransition();
  const up = (i: number, patch: Partial<QE>) => setQs((x) => x.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const blank = useMemo<QE>(() => ({ prompt_en: "", prompt_es: "", options_en: ["", ""], options_es: ["", ""], correct: 1, explanation_en: "", explanation_es: "" }), []);
  return (
    <div className="space-y-4">
      {qs.map((q, i) => (
        <fieldset key={i} className="rounded-xl border border-line p-4">
          <legend className="px-1 font-semibold">Question {i + 1}</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={q.prompt_en} onChange={(e) => up(i, { prompt_en: e.target.value })} placeholder="Question (English)" className="input py-2" />
            <input value={q.prompt_es} onChange={(e) => up(i, { prompt_es: e.target.value })} placeholder="Pregunta (español)" className="input py-2" />
          </div>
          <p className="mt-3 mb-1 text-sm font-medium">Answers (select the correct one)</p>
          <div className="space-y-2">
            {q.options_en.map((o, k) => (
              <div key={k} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
                <input type="radio" name={`c${i}`} checked={q.correct === k + 1} onChange={() => up(i, { correct: k + 1 })} className="h-4 w-4 accent-[#2f7a4b]" aria-label={`Answer ${k + 1} is correct`} />
                <input value={o} onChange={(e) => up(i, { options_en: q.options_en.map((x, z) => (z === k ? e.target.value : x)) })} placeholder={`Answer ${k + 1}`} className="input py-1.5 text-sm" />
                <input value={q.options_es[k] ?? ""} onChange={(e) => up(i, { options_es: q.options_en.map((_, z) => (z === k ? e.target.value : q.options_es[z] ?? "")) })} placeholder={`Respuesta ${k + 1}`} className="input py-1.5 text-sm" />
                <button type="button" disabled={q.options_en.length <= 2} onClick={() => up(i, { options_en: q.options_en.filter((_, z) => z !== k), options_es: q.options_es.filter((_, z) => z !== k), correct: q.correct > k + 1 ? q.correct - 1 : q.correct === k + 1 ? 1 : q.correct })} className="px-2 text-coral disabled:opacity-30" aria-label="Remove answer">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => up(i, { options_en: [...q.options_en, ""], options_es: [...q.options_es, ""] })} className="mt-2 text-sm font-semibold text-teal">+ Add answer</button>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input value={q.explanation_en} onChange={(e) => up(i, { explanation_en: e.target.value })} placeholder="Why it's right (English)" className="input py-2 text-sm" />
            <input value={q.explanation_es} onChange={(e) => up(i, { explanation_es: e.target.value })} placeholder="Por qué es correcto (español)" className="input py-2 text-sm" />
          </div>
          <button type="button" onClick={() => setQs((x) => x.filter((_, k) => k !== i))} className="mt-3 text-sm text-coral hover:underline">Remove question</button>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setQs((x) => [...x, { ...blank, options_en: ["", ""], options_es: ["", ""] }])} className="btn-ghost">+ Add question</button>
        <button type="button" disabled={pending} onClick={() => start(async () => setMsg(await saveQuiz(lessonId, qs.map((q) => ({ ...q, options_en: q.options_en.map((o) => o.trim()) })))))} className="btn-primary">Save quiz</button>
        <Msg s={msg} />
      </div>
    </div>
  );
}
