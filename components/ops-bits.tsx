"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addProvider, importProviders, inviteProvider, updateProvider, setCourseOverrides, setLessonAttachment,
  saveAcknowledgment, acknowledgeLesson, setStaffLevel,
} from "@/app/ops-actions";
import { createClient } from "@/lib/supabase/client";

const TYPES: [string, string][] = [["host_home", "Host Home"], ["family_caregiver", "Family Caregiver"], ["scc_dsp", "SCC/DSP"], ["nmt", "NMT"]];

function Msg({ s }: { s?: { error?: string; message?: string } }) {
  if (!s) return null;
  if (s.error) return <p role="alert" className="text-sm text-coral">{s.error}</p>;
  if (s.message) return <p role="status" className="text-sm font-semibold text-green">✓ {s.message}</p>;
  return null;
}

function TypeChecks({ name = "types", initial = [] as string[] }) {
  return (
    <fieldset>
      <legend className="label">Provider type(s)</legend>
      <div className="flex flex-wrap gap-2">
        {TYPES.map(([v, l]) => (
          <label key={v} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
            <input type="checkbox" name={name} value={v} defaultChecked={initial.includes(v)} /> {l}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------- add one provider
export function AddProviderForm() {
  const [s, action, pending] = useActionState(addProvider, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label" htmlFor="ap-name">Full name</label><input id="ap-name" name="full_name" required maxLength={120} autoComplete="off" className="input" /></div>
        <div><label className="label" htmlFor="ap-email">Email</label><input id="ap-email" name="email" type="email" required spellCheck={false} autoComplete="off" className="input" /></div>
        <div><label className="label" htmlFor="ap-phone">Phone (optional)</label><input id="ap-phone" name="phone" type="tel" autoComplete="off" className="input" /></div>
        <div>
          <label className="label" htmlFor="ap-locale">Preferred language</label>
          <select id="ap-locale" name="locale" className="input"><option value="en">English</option><option value="es">Spanish</option></select>
        </div>
      </div>
      <TypeChecks />
      <div className="grid gap-4 md:grid-cols-2">
        <div><label className="label" htmlFor="ap-hire">Enrollment or hire date</label><input id="ap-hire" name="hire_date" type="date" className="input" /></div>
        <div>
          <label className="label" htmlFor="ap-cycle">Training year starts (optional)</label>
          <input id="ap-cycle" name="cycle_start" type="date" className="input" />
          <p className="mt-1 text-sm text-muted">Their annual renewal date. Leave blank to use the hire date. The first year starts on its most recent anniversary.</p>
        </div>
      </div>
      <p className="rounded-xl bg-sand/70 px-4 py-3 text-sm">The provider is added <strong>without a login</strong>. Staff can manage their training right away. Send them a login from their page whenever you're ready.</p>
      <Msg s={s} />
      <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add provider"}</button>
    </form>
  );
}

// ---------------------------------------------------------------- roster upload
type Parsed = { full_name: string; email: string; phone: string; provider_types: string[]; hire_date: string; cycle_start: string; locale: string; problems: string[] };
const TYPE_WORDS: Record<string, string> = {
  "host home": "host_home", "host_home": "host_home", hhp: "host_home", "family caregiver": "family_caregiver", "family_caregiver": "family_caregiver",
  fc: "family_caregiver", scc: "scc_dsp", dsp: "scc_dsp", "scc/dsp": "scc_dsp", "scc_dsp": "scc_dsp", nmt: "nmt",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
function toDate(v: string) {
  const t = v.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
  return "invalid";
}

export function RosterImport() {
  const router = useRouter();
  const [rows, setRows] = useState<Parsed[]>([]);
  const [result, setResult] = useState<{ error?: string; message?: string; results?: { row: number; ok: boolean; error?: string }[] }>();
  const [pending, start] = useTransition();
  const seen = useMemo(() => new Set<string>(), []);

  function load(text: string) {
    setResult(undefined);
    const grid = parseCsv(text);
    if (grid.length < 2) { setRows([]); setResult({ error: "The file needs a header row and at least one provider." }); return; }
    const head = grid[0].map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const c = { name: col("full name", "name", "full_name"), email: col("email", "email address"), phone: col("phone", "phone number"),
      types: col("provider type", "provider types", "type", "types"), hire: col("hire date", "enrollment date", "hire_date", "start date"),
      cycle: col("training year start", "renewal date", "cycle start", "cycle_start"), lang: col("language", "preferred language", "locale") };
    if (c.name < 0 || c.email < 0 || c.types < 0) { setRows([]); setResult({ error: "Columns needed: Full name, Email, Provider type. Download the template to see the layout." }); return; }
    seen.clear();
    setRows(grid.slice(1).map((r) => {
      const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
      const types = [...new Set(get(c.types).split(/[;,|]/).map((t) => TYPE_WORDS[t.trim().toLowerCase()]).filter(Boolean))];
      const email = get(c.email).toLowerCase();
      const hire = toDate(get(c.hire)); const cycle = toDate(get(c.cycle));
      const problems: string[] = [];
      if (get(c.name).length < 2) problems.push("name missing");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push("email not valid");
      else if (seen.has(email)) problems.push("email listed twice");
      seen.add(email);
      if (types.length === 0) problems.push("provider type not recognized");
      if (hire === "invalid" || cycle === "invalid") problems.push("date not recognized (use YYYY-MM-DD or MM/DD/YYYY)");
      return { full_name: get(c.name), email, phone: get(c.phone), provider_types: types, hire_date: hire === "invalid" ? "" : hire,
        cycle_start: cycle === "invalid" ? "" : cycle, locale: /^(es|spanish|español)$/i.test(get(c.lang)) ? "es" : "en", problems };
    }));
  }
  const good = rows.filter((r) => r.problems.length === 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-ghost cursor-pointer">
          Choose a spreadsheet (CSV)
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await f.text()); }} />
        </label>
        <a href="/provider-roster-template.csv" download className="text-sm font-semibold text-teal hover:underline">Download the template</a>
      </div>
      <p className="text-sm text-muted">From Excel: File → Save As → CSV. Columns: Full name, Email, Phone, Provider type (several allowed, separated by ;), Hire date, Training year start, Language.</p>
      {rows.length > 0 && (
        <>
          <div className="card max-h-96 overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="text-muted"><th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Types</th><th className="px-3 py-2">Hire</th><th className="px-3 py-2">Year starts</th><th className="px-3 py-2">Check</th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => {
                  const res = result?.results?.[good.indexOf(r)];
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2 tabular-nums">{i + 2}</td>
                      <td className="px-3 py-2 font-medium">{r.full_name}</td>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2">{r.provider_types.map((t) => TYPES.find(([v]) => v === t)?.[1]).join(", ")}</td>
                      <td className="px-3 py-2 tabular-nums">{r.hire_date}</td>
                      <td className="px-3 py-2 tabular-nums">{r.cycle_start}</td>
                      <td className="px-3 py-2">
                        {r.problems.length ? <span className="text-coral">✕ {r.problems.join("; ")}</span>
                          : res ? (res.ok ? <span className="font-semibold text-green">✓ Added</span> : <span className="text-coral">✕ {res.error}</span>)
                          : <span className="text-green">Ready</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={pending || good.length === 0 || !!result?.results}
              onClick={() => start(async () => { const r = await importProviders(good); setResult(r); router.refresh(); })}>
              {pending ? "Adding…" : `Add ${good.length} provider${good.length === 1 ? "" : "s"}`}
            </button>
            {rows.length - good.length > 0 && <span className="text-sm text-coral">{rows.length - good.length} row(s) need fixing and will be skipped.</span>}
            <Msg s={result} />
          </div>
        </>
      )}
      {rows.length === 0 && <Msg s={result} />}
    </div>
  );
}

// ---------------------------------------------------------------- send a login later
export function InviteProviderButton({ providerId }: { providerId: string }) {
  const [pending, start] = useTransition();
  const [s, setS] = useState<{ error?: string; link?: string }>();
  const full = s?.link ? (typeof window !== "undefined" ? window.location.origin : "") + s.link : "";
  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => setS(await inviteProvider(providerId)))}>
        {pending ? "Making link…" : "Send login invite"}
      </button>
      {s?.error && <p role="alert" className="text-sm text-coral">{s.error}</p>}
      {full && (
        <div className="rounded-xl bg-teal-soft p-3 text-sm">
          <p className="font-semibold">Invite link (good for 14 days):</p>
          <p className="mt-1 break-all font-mono text-xs">{full}</p>
          <button type="button" className="mt-2 text-sm font-semibold text-teal hover:underline" onClick={() => navigator.clipboard?.writeText(full)}>Copy link</button>
          <p className="mt-1 text-muted">In production this is emailed automatically. Their training history stays as it is.</p>
        </div>
      )}
    </div>
  );
}

export function EditProviderForm({ p }: { p: { id: string; full_name: string; phone: string | null; provider_types: string[]; hire_date: string | null; locale: string } }) {
  const [s, action, pending] = useActionState(updateProvider, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={p.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label text-sm" htmlFor="ep-name">Full name</label><input id="ep-name" name="full_name" defaultValue={p.full_name} required className="input py-2 text-sm" /></div>
        <div><label className="label text-sm" htmlFor="ep-phone">Phone</label><input id="ep-phone" name="phone" type="tel" defaultValue={p.phone ?? ""} className="input py-2 text-sm" /></div>
        <div><label className="label text-sm" htmlFor="ep-hire">Hire date</label><input id="ep-hire" name="hire_date" type="date" defaultValue={p.hire_date ?? ""} className="input py-2 text-sm" /></div>
        <div>
          <label className="label text-sm" htmlFor="ep-locale">Language</label>
          <select id="ep-locale" name="locale" defaultValue={p.locale} className="input py-2 text-sm"><option value="en">English</option><option value="es">Spanish</option></select>
        </div>
      </div>
      <TypeChecks initial={p.provider_types} />
      <p className="text-sm text-muted">Changing provider types changes which courses are required, starting now. Past completions are kept.</p>
      <button className="btn-ghost text-sm" disabled={pending}>Save details</button>
      <Msg s={s} />
    </form>
  );
}

// ---------------------------------------------------------------- 2. assign / exempt a course
export function CourseOverrideForm({ providerIds, courses, compact = false, onDone }: { providerIds: string[]; courses: { id: string; title: string; inviteOnly?: boolean }[]; compact?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [course, setCourse] = useState(courses[0]?.id ?? "");
  const [mode, setMode] = useState<"assigned" | "exempt" | "clear">("assigned");
  const [freq, setFreq] = useState<"once" | "annual">("once");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ error?: string; message?: string }>();
  const [pending, start] = useTransition();
  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "space-y-3"}>
      <label className="sr-only" htmlFor={`co-course-${compact}`}>Course</label>
      <select id={`co-course-${compact}`} value={course} onChange={(e) => setCourse(e.target.value)} className="input w-auto py-1.5 text-sm">
        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}{c.inviteOnly ? " (invite only)" : ""}</option>)}
      </select>
      <label className="sr-only" htmlFor={`co-mode-${compact}`}>Action</label>
      <select id={`co-mode-${compact}`} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="input w-auto py-1.5 text-sm">
        <option value="assigned">Assign</option><option value="exempt">Exempt</option><option value="clear">Clear assignment or exemption</option>
      </select>
      {mode === "assigned" && (
        <>
          <label className="sr-only" htmlFor={`co-freq-${compact}`}>How often</label>
          <select id={`co-freq-${compact}`} value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)} className="input w-auto py-1.5 text-sm">
            <option value="once">One time</option><option value="annual">Every year</option>
          </select>
        </>
      )}
      {mode !== "clear" && (
        <>
          <label className="sr-only" htmlFor={`co-note-${compact}`}>Note</label>
          <input id={`co-note-${compact}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "exempt" ? "Reason (required)…" : "Note (optional)…"} className="input w-56 py-1.5 text-sm" />
        </>
      )}
      <button type="button" className="btn-ghost px-3 py-1.5 text-sm" disabled={pending || !course || providerIds.length === 0 || (mode === "exempt" && !note.trim())}
        onClick={() => start(async () => { const r = await setCourseOverrides(providerIds, course, mode, freq, note); setMsg(r); if (r.ok) { setNote(""); onDone?.(); router.refresh(); } })}>
        {mode === "assigned" ? "Assign course" : mode === "exempt" ? "Exempt" : "Clear"}
      </button>
      <Msg s={msg} />
    </div>
  );
}

// ---------------------------------------------------------------- 3. lesson attachment and acknowledgment (staff)
export function AttachmentUploader({ courseId, lessonId, current }: { courseId: string; lessonId: string; current: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<string>();
  const [pending, start] = useTransition();
  async function upload(f: File) {
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(f.type)) { setStatus("Choose a PDF, PNG, JPG or WebP file."); return; }
    if (f.size > 20 * 1048576) { setStatus("Keep the file under 20 MB."); return; }
    setStatus("Uploading…");
    const safe = f.name.replace(/[^\w.\-]+/g, "-").slice(-100);
    const path = `courses/${courseId}/lessons/${lessonId}/${Date.now()}-${safe}`;
    const { error } = await createClient().storage.from("training-media").upload(path, f, { contentType: f.type, upsert: false });
    if (error) { setStatus(`Upload failed: ${error.message}`); return; }
    start(async () => { const r = await setLessonAttachment(lessonId, path); setStatus(r.error ?? "Uploaded. Providers see this page in the lesson."); router.refresh(); });
  }
  return (
    <div className="space-y-2">
      <label className="label text-sm" htmlFor={`att-${lessonId}`}>{current ? "Replace the page (PDF or image)" : "Upload the page (PDF or image)"}</label>
      <input id={`att-${lessonId}`} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={pending}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="input py-1.5 text-sm" />
      {current && (
        <button type="button" className="text-sm text-coral hover:underline" disabled={pending}
          onClick={() => start(async () => { const r = await setLessonAttachment(lessonId, null); setStatus(r.error ?? "Removed."); router.refresh(); })}>Remove the uploaded page</button>
      )}
      <p className="text-sm text-muted">Stored privately; only people who can open this course can see it.</p>
      {status && <p className="text-sm font-semibold">{status}</p>}
    </div>
  );
}

export function AcknowledgmentEditor({ lessonId, en, es }: { lessonId: string; en: string; es: string }) {
  const [s, action, pending] = useActionState(saveAcknowledgment, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lesson" value={lessonId} />
      <div><label className="label text-sm" htmlFor="ack-en">Statement providers sign (English)</label><textarea id="ack-en" name="ack_en" rows={2} defaultValue={en} className="input text-sm" /></div>
      <div><label className="label text-sm" htmlFor="ack-es">Statement (Spanish)</label><textarea id="ack-es" name="ack_es" rows={2} defaultValue={es} className="input text-sm" /></div>
      <p className="text-sm text-muted">Providers check a box and type their name. The exact words they signed are saved with the date and shown on the certificate.</p>
      <button className="btn-ghost text-sm" disabled={pending}>Save statement</button>
      <Msg s={s} />
    </form>
  );
}

// ---------------------------------------------------------------- 3. acknowledgment (provider)
export function AcknowledgeForm({ lessonId, statement, lang, nextHref, courseHref }: { lessonId: string; statement: string; lang: "en" | "es"; nextHref: string | null; courseHref: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string>();
  const [pending, start] = useTransition();
  const es = lang === "es";
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-xl border-2 border-line p-4 text-lg has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-[#0f5c5f]" />
        <span className="font-semibold">{statement}</span>
      </label>
      <div>
        <label className="label" htmlFor="ack-name">{es ? "Escriba su nombre completo para firmar" : "Type your full name to sign"}</label>
        <input id="ack-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="input text-lg" />
      </div>
      {err && <p role="alert" className="text-coral">{err}</p>}
      <button type="button" className="btn-primary w-full sm:w-auto" disabled={pending || !checked || name.trim().length < 2}
        onClick={() => start(async () => {
          const r = await acknowledgeLesson(lessonId, name, lang);
          if (r.error) { setErr(r.error); return; }
          router.push(nextHref ?? courseHref);
          router.refresh();
        })}>
        {pending ? "…" : es ? "Firmar y terminar" : "Sign and finish"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- 5. staff levels
export function StaffLevelSelect({ profileId, level, self }: { profileId: string; level: string; self: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ error?: string; message?: string }>();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`lvl-${profileId}`}>Permission level</label>
      <select id={`lvl-${profileId}`} defaultValue={level} disabled={pending || self} className="input w-auto py-1.5 text-sm"
        onChange={(e) => start(async () => { const r = await setStaffLevel(profileId, e.target.value); setMsg(r); router.refresh(); })}>
        <option value="reviewer">Reviewer</option><option value="training_admin">Training admin</option><option value="super_admin">Full admin</option>
      </select>
      {self && <span className="text-sm text-muted">(you)</span>}
      <Msg s={msg} />
    </div>
  );
}
