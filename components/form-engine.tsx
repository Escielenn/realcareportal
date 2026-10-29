"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitForm } from "@/app/actions";
import { saveDraft } from "@/app/phase3-actions";
import { recordDocument } from "@/app/documents/actions";
import { createClient } from "@/lib/supabase/client";
import { Markdown } from "@/lib/md";

import {
  visibleFields, holdsValue, rowValue, columnTotal, money, daysMarked,
  type Field, type FormSchema, type Values, type Individual, type Row, type Column, type DayGrid,
} from "@/lib/forms";
export type { FormSchema } from "@/lib/forms";

const L = {
  required: { en: "Required", es: "Obligatorio" },
  select: { en: "Select…", es: "Seleccione…" },
  submit: { en: "Submit", es: "Enviar" },
  resubmit: { en: "Send corrections", es: "Enviar correcciones" },
  fix: { en: "Please fix:", es: "Por favor corrija:" },
  missing: { en: "Please complete the required fields marked below.", es: "Por favor complete los campos obligatorios marcados abajo." },
  sigHint: { en: "Typing your name counts as your signature.", es: "Escribir su nombre cuenta como su firma." },
  onlyFlagged: { en: "Only the highlighted fields can be changed. Everything else is already saved.", es: "Solo puede cambiar los campos marcados. Todo lo demás ya está guardado." },
  thisRequired: { en: "This is required.", es: "Este campo es obligatorio." },
  instructions: { en: "Instructions", es: "Instrucciones" },
  addRow: { en: "+ Add a row", es: "+ Agregar una fila" },
  remove: { en: "Remove", es: "Quitar" },
  row: { en: "Row", es: "Fila" },
  total: { en: "Total", es: "Total" },
  noRows: { en: "No rows yet.", es: "Todavía no hay filas." },
  upload: { en: "Choose a file", es: "Elegir un archivo" },
  uploaded: { en: "Attached", es: "Adjuntado" },
  uploading: { en: "Uploading…", es: "Subiendo…" },
  rowRemoved: { en: "Row removed.", es: "Fila quitada." },
  undo: { en: "Undo", es: "Deshacer" },
  draftSaved: { en: "Draft saved at", es: "Borrador guardado a las" },
  draftHint: { en: "Your answers save as a draft while you work.", es: "Sus respuestas se guardan como borrador mientras trabaja." },
  draftErr: { en: "Not saved: no connection. Keep this page open; it saves when you're back online.", es: "No guardado: sin conexión. Deje esta página abierta; se guardará cuando vuelva la conexión." },
  daysMarked: { en: "days marked", es: "días marcados" },
  clearRow: { en: "Clear", es: "Borrar" },
  previewFile: { en: "File uploads are off in the preview.", es: "La subida de archivos está desactivada en la vista previa." },
};

export function Instructions({ schema, lang }: { schema: FormSchema; lang: "en" | "es" }) {
  const ins = lang === "es" ? schema.instructions_es : schema.instructions_en;
  if (!ins?.length) return null;
  return (
    <div className="mb-6 space-y-2">
      {ins.map((block, i) => (
        <details key={i} open={i === 0} className="rounded-xl border border-teal/25 bg-teal-soft/60 p-4">
          <summary className="cursor-pointer font-semibold text-teal">{L.instructions[lang]}: {block.title}</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-6">
            {block.steps.map((s, j) => <li key={j}>{s}</li>)}
          </ol>
        </details>
      ))}
    </div>
  );
}

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

export function FormEngine({
  assignmentId, schema, lang, individual, initial = {}, mode, flags = {}, doneHref, preview = false, autosave = false, draftSavedAt = null,
}: {
  assignmentId: string; schema: FormSchema; lang: "en" | "es"; individual: Individual;
  initial?: Values; mode: "new" | "returned"; flags?: Record<string, string>; doneHref: string; preview?: boolean;
  autosave?: boolean; draftSavedAt?: string | null;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const editable = (f: Field) => holdsValue(f) && (mode === "new" || f.id in flags);
  const vis = useMemo(() => new Set(visibleFields(schema, values).map((f) => f.id)), [schema, values]);
  const missing = (f: Field) => f.required === true && vis.has(f.id) && editable(f) && isEmpty(values[f.id]);
  const allFields = schema.sections.flatMap((s) => s.fields);
  const set = (id: string, v: unknown) => { dirty.current = true; setValues((x) => ({ ...x, [id]: v })); };

  // Drafts save to the portal (never the browser) a few seconds after typing stops, and when the page is hidden.
  const dirty = useRef(false);
  const [savedAt, setSavedAt] = useState<string | null>(draftSavedAt);
  const [saveErr, setSaveErr] = useState(false);
  const latest = useRef(values);
  latest.current = values;
  const canDraft = autosave && mode === "new" && !preview;
  const flush = useRef(async () => {});
  flush.current = async () => {
    if (!canDraft || !dirty.current) return;
    dirty.current = false;
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("offline");
      const r = await saveDraft(assignmentId, latest.current as Record<string, unknown>);
      if (r.error) { setSaveErr(true); dirty.current = true; } else { setSaveErr(false); setSavedAt(r.savedAt ?? new Date().toISOString()); }
    } catch {
      // No connection: keep the answers on screen and try again when the phone is back online.
      setSaveErr(true);
      dirty.current = true;
    }
  };
  useEffect(() => {
    if (!canDraft) return;
    const retry = () => flush.current();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [canDraft]);
  useEffect(() => {
    if (!canDraft) return;
    const t = setTimeout(() => flush.current(), 4000);
    return () => clearTimeout(t);
  }, [values, canDraft]);
  useEffect(() => {
    if (mode !== "returned" && !canDraft) return;
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current && !pending) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [canDraft, mode, pending]);
  useEffect(() => {
    if (!canDraft) return;
    const onHide = () => { if (document.visibilityState === "hidden") flush.current(); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [canDraft]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    const firstMissing = allFields.find(missing);
    if (firstMissing) {
      setError(L.missing[lang]);
      requestAnimationFrame(() => {
        const el = document.getElementById(`f_${firstMissing.id}`) ?? document.querySelector<HTMLElement>(`[data-field="${firstMissing.id}"] input, [data-field="${firstMissing.id}"] select, [data-field="${firstMissing.id}"] textarea, [data-field="${firstMissing.id}"] button`);
        el?.focus();
        el?.scrollIntoView({ block: "center" });
      });
      return;
    }
    if (preview) { setError(lang === "es" ? "Vista previa: todo está completo. No se envió nada." : "Preview: everything required is filled in. Nothing was sent."); return; }
    // Send only visible, editable answers.
    const data: Values = {};
    for (const f of allFields) if (vis.has(f.id) && editable(f)) data[f.id] = values[f.id] ?? null;
    start(async () => {
      const r = await submitForm(assignmentId, data);
      if (r.error) setError(r.error);
      else router.push(doneHref);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {mode === "returned" && <p className="rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{L.onlyFlagged[lang]}</p>}
      {schema.sections.map((s, si) => {
        const shown = s.fields.filter((f) => vis.has(f.id));
        if (shown.length === 0) return null;
        const title = lang === "es" ? s.title_es : s.title_en;
        return (
          <fieldset key={si} className="card p-5">
            <legend className="sr-only">{title}</legend>
            {title && <h2 className="mb-4 text-lg font-semibold text-navy">{title}</h2>}
            <div className="space-y-5">
              {shown.map((f) => {
                const label = lang === "es" ? f.label_es : f.label_en;
                const help = lang === "es" ? f.help_es : f.help_en;
                const can = editable(f);
                const flag = flags[f.id];
                const bad = touched && missing(f);
                const fid = `f_${f.id}`;
                const wrap = `${flag ? "rounded-xl border-2 border-coral bg-coral-soft/40 p-3" : ""}`;
                const req = f.required && <span className="text-coral"> *</span>;
                return (
                  <div key={f.id} className={wrap} data-field={f.id}>
                    {flag && <p className="mb-2 text-sm font-semibold text-coral">{L.fix[lang]} {flag}</p>}
                    {f.type === "info" ? (
                      <div className="rounded-xl bg-sand/70 px-4 py-3 text-[15px]">
                        {label && <p className="mb-1 font-semibold">{label}</p>}
                        <Markdown text={(lang === "es" ? f.body_es : f.body_en) ?? ""} />
                      </div>
                    ) : f.type === "prefill" ? (
                      <div>
                        <p className="label">{label}</p>
                        {f.source === "individual.goals" ? (
                          <ul className="list-disc rounded-xl bg-sand py-2 pr-3 pl-8 text-ink">{(individual?.goals ?? []).map((g, i) => <li key={i}>{g}</li>)}</ul>
                        ) : (
                          <p className="rounded-xl bg-sand px-3.5 py-2.5 font-semibold">{individual?.full_name}</p>
                        )}
                      </div>
                    ) : f.type === "radio" || f.type === "checkboxes" ? (
                      <fieldset disabled={!can}>
                        <legend className="label">{label}{req}</legend>
                        {help && <p className="-mt-1 mb-2 text-sm text-muted">{help}</p>}
                        <div className="flex flex-wrap gap-2">
                          {(f.options ?? []).map((o) => {
                            const checked = f.type === "radio" ? values[f.id] === o.value : Array.isArray(values[f.id]) && (values[f.id] as string[]).includes(o.value);
                            return (
                              <label key={o.value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 ${checked ? "border-teal bg-teal-soft font-semibold" : "border-line bg-white"} ${!can ? "opacity-70" : ""}`}>
                                <input
                                  type={f.type === "radio" ? "radio" : "checkbox"} name={fid} className="h-5 w-5 accent-[#8224e3]" checked={checked}
                                  onChange={(e) => {
                                    if (f.type === "radio") set(f.id, o.value);
                                    else {
                                      const cur = new Set((values[f.id] as string[]) ?? []);
                                      if (e.target.checked) cur.add(o.value); else cur.delete(o.value);
                                      set(f.id, [...cur]);
                                    }
                                  }}
                                />
                                {o[lang]}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ) : f.type === "repeater" ? (
                      <Repeater f={f} lang={lang} can={can} rows={(values[f.id] as Row[]) ?? []} onChange={(rows) => set(f.id, rows)} label={label} req={!!f.required} help={help} />
                    ) : f.type === "daygrid" ? (
                      <DayGridField f={f} lang={lang} can={can} value={(values[f.id] as DayGrid) ?? {}} onChange={(g) => set(f.id, g)} label={label} req={!!f.required} help={help} />
                    ) : f.type === "file" ? (
                      <FileField f={f} lang={lang} can={can && !preview} preview={preview} value={values[f.id] as string | undefined} onChange={(id) => set(f.id, id)} label={label} req={!!f.required} />
                    ) : (
                      <div>
                        <label htmlFor={fid} className="label">{label}{req}</label>
                        {help && <p className="-mt-1 mb-2 text-sm text-muted">{help}</p>}
                        {f.type === "textarea" ? (
                          <textarea id={fid} rows={4} className="input" disabled={!can} value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)} />
                        ) : f.type === "select" ? (
                          <select id={fid} className="input" disabled={!can} value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)}>
                            <option value="">{L.select[lang]}</option>
                            {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o[lang]}</option>)}
                          </select>
                        ) : f.type === "currency" ? (
                          <div className="relative max-w-xs">
                            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">$</span>
                            <input id={fid} disabled={!can} type="number" step="0.01" inputMode="decimal" className="input pl-7" value={String(values[f.id] ?? "")}
                              onChange={(e) => set(f.id, e.target.value === "" ? "" : Number(e.target.value))} />
                          </div>
                        ) : (
                          <input
                            id={fid} disabled={!can}
                            type={f.type === "signature" || f.type === "phone" ? (f.type === "phone" ? "tel" : "text") : f.type}
                            inputMode={f.type === "number" ? "decimal" : f.type === "phone" ? "tel" : undefined}
                            className={`input ${f.type === "signature" ? "font-[family-name:var(--font-sig)] text-2xl" : ""} ${f.type === "date" || f.type === "time" || f.type === "number" ? "max-w-xs" : ""}`}
                            value={String(values[f.id] ?? "")}
                            onChange={(e) => set(f.id, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                          />
                        )}
                        {f.type === "signature" && <p className="mt-1 text-sm text-muted">{L.sigHint[lang]}</p>}
                      </div>
                    )}
                    {bad && <p className="mt-1 text-sm font-medium text-coral">{L.thisRequired[lang]}</p>}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {error && <p role="alert" className="rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary w-full text-base sm:w-auto">{pending ? "…" : mode === "returned" ? L.resubmit[lang] : L.submit[lang]}</button>
        {canDraft && (
          <p className="text-sm text-muted" aria-live="polite">
            {saveErr ? L.draftErr[lang] : savedAt ? `${L.draftSaved[lang]} ${new Date(savedAt).toLocaleTimeString(lang === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" })}` : L.draftHint[lang]}
          </p>
        )}
      </div>
    </form>
  );
}

// ---------- repeating rows: cards on a phone, a table on a wide screen
function Repeater({ f, lang, can, rows, onChange, label, req, help }: {
  f: Field; lang: "en" | "es"; can: boolean; rows: Row[]; onChange: (rows: Row[]) => void; label: string; req: boolean; help?: string;
}) {
  const cols = f.columns ?? [];
  const colLabel = (c: Column) => (lang === "es" ? c.label_es : c.label_en);
  const [removed, setRemoved] = useState<{ row: Row; at: number } | null>(null);
  const removeRow = (i: number) => { setRemoved({ row: rows[i], at: i }); onChange(rows.filter((_, j) => j !== i)); };
  const undo = () => { if (!removed) return; const next = [...rows]; next.splice(removed.at, 0, removed.row); onChange(next); setRemoved(null); };
  const setCell = (i: number, id: string, v: string | number | null) => onChange(rows.map((r, j) => (j === i ? { ...r, [id]: v } : r)));
  const fmt = (c: Column, v: unknown) => (v === null || v === undefined || v === "" ? "—" : c.type === "currency" ? money(Number(v)) : c.type === "hours" ? Number(v).toFixed(2) : String(v));

  const cell = (c: Column, r: Row, i: number) => {
    if (c.type === "hours") return <span className="inline-block py-2.5 font-semibold tabular-nums">{fmt(c, rowValue(c, r))}</span>;
    const id = `${f.id}_${i}_${c.id}`;
    const common = { id, disabled: !can, "aria-label": `${colLabel(c)}, ${L.row[lang]} ${i + 1}`, className: "input py-2" };
    if (c.type === "select")
      return (
        <select {...common} value={String(r[c.id] ?? "")} onChange={(e) => setCell(i, c.id, e.target.value)}>
          <option value="">{L.select[lang]}</option>
          {(c.options ?? []).map((o) => <option key={o.value} value={o.value}>{o[lang]}</option>)}
        </select>
      );
    const numeric = c.type === "number" || c.type === "currency";
    return (
      <input {...common} type={numeric ? "number" : c.type} step={c.type === "currency" ? "0.01" : undefined} inputMode={numeric ? "decimal" : undefined}
        value={String(r[c.id] ?? "")} onChange={(e) => setCell(i, c.id, numeric ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)} />
    );
  };

  return (
    <div>
      <p className="label">{label}{req && <span className="text-coral"> *</span>}</p>
      {help && <p className="-mt-1 mb-2 text-sm text-muted">{help}</p>}
      {rows.length === 0 && <p className="mb-2 rounded-xl bg-sand/70 px-4 py-3 text-sm text-muted">{L.noRows[lang]}</p>}
      {/* phone: one card per row */}
      <ol className="space-y-3 md:hidden">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold text-muted">
              <span>{L.row[lang]} {i + 1}</span>
              {can && <button type="button" className="text-coral" onClick={() => removeRow(i)}>{L.remove[lang]}</button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cols.map((c) => (
                <label key={c.id} className="text-sm">
                  <span className="mb-1 block font-medium">{colLabel(c)}</span>
                  {cell(c, r, i)}
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {/* wide screens: a table */}
      {rows.length > 0 && (
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="text-muted"><tr>{cols.map((c) => <th key={c.id} className={`px-1 pb-1 font-semibold ${c.type === "number" || c.type === "hours" ? "w-20" : ""}`}>{colLabel(c)}</th>)}<th className="w-16" /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => <td key={c.id} className="p-1 align-top">{cell(c, r, i)}</td>)}
                  <td className="p-1 text-right">{can && <button type="button" className="text-sm font-semibold text-coral" onClick={() => removeRow(i)}>{L.remove[lang]}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!f.totals?.length && rows.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-end gap-4 rounded-xl bg-teal-soft px-4 py-2 text-sm font-semibold text-navy">
          {f.totals.map((id) => {
            const c = cols.find((x) => x.id === id);
            if (!c) return null;
            const t = columnTotal(c, rows);
            const name = colLabel(c);
            return <span key={id}>{/^(total|sum)/i.test(name) ? name : `${L.total[lang]} ${name.toLowerCase()}`}: <span className="tabular-nums">{c.type === "currency" ? money(t) : t}</span></span>;
          })}
        </div>
      )}
      <div aria-live="polite">
        {removed && (
          <p className="mt-2 flex items-center gap-3 rounded-xl bg-sand px-3 py-2 text-sm">
            {L.rowRemoved[lang]} <button type="button" className="font-semibold text-teal hover:underline" onClick={undo}>{L.undo[lang]}</button>
          </p>
        )}
      </div>
      {can && <button type="button" className="btn-ghost mt-2 py-1.5 text-sm" onClick={() => { setRemoved(null); onChange([...rows, {}]); }}>{L.addRow[lang]}</button>}
    </div>
  );
}

// ---------- file attachment: uploads to the provider's private folder and files it as a document for review
function FileField({ f, lang, can, preview, value, onChange, label, req }: {
  f: Field; lang: "en" | "es"; can: boolean; preview: boolean; value?: string; onChange: (id: string | null) => void; label: string; req: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  async function pick(file: File) {
    setBusy(true); setErr("");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return setErr(lang === "es" ? "Inicie sesión de nuevo." : "Please sign in again."); }
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); return setErr(lang === "es" ? "No se pudo subir el archivo." : "The upload didn't go through."); }
    const r = await recordDocument({ path, filename: file.name, mime: file.type, size: file.size, typeCode: "form_attachment", individualId: null, note: "" });
    setBusy(false);
    if (r.error) return setErr(r.error);
    // The documents row id isn't returned to the browser; the storage path identifies the attachment.
    setName(file.name);
    onChange(path);
  }
  return (
    <div>
      <p className="label">{label}{req && <span className="text-coral"> *</span>}</p>
      {preview ? (
        <p className="rounded-xl bg-sand/70 px-4 py-3 text-sm text-muted">{L.previewFile[lang]}</p>
      ) : value ? (
        <p className="rounded-xl bg-green-soft px-4 py-2.5 text-sm font-semibold text-green">✓ {L.uploaded[lang]}{name ? `: ${name}` : ""}</p>
      ) : (
        <label className={`btn-ghost cursor-pointer ${!can ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? L.uploading[lang] : L.upload[lang]}
          <input type="file" className="sr-only" disabled={!can || busy} accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) pick(file); }} />
        </label>
      )}
      {err && <p role="alert" className="mt-1 text-sm text-coral">{err}</p>}
    </div>
  );
}

// ---------- month grid: a calendar-style block of days 1-31 for each row (attendance, trips, meals)
function DayGridField({ f, lang, can, value, onChange, label, req, help }: {
  f: Field; lang: "en" | "es"; can: boolean; value: DayGrid; onChange: (g: DayGrid) => void; label: string; req: boolean; help?: string;
}) {
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const setDay = (row: string, day: string, v: string) => onChange({ ...value, [row]: { ...(value[row] ?? {}), [day]: v } });
  return (
    <div>
      <p className="label">{label}{req && <span className="text-coral"> *</span>}</p>
      {help && <p className="-mt-1 mb-2 text-sm text-muted">{help}</p>}
      {f.cell === "code" && !!f.codes?.length && (
        <p className="mb-2 text-sm text-muted">{f.codes.map((c) => `${c.value} = ${c[lang]}`).join(" · ")}</p>
      )}
      <div className="space-y-4">
        {(f.rows ?? []).map((r) => (
          <div key={r.id} className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-semibold">{r[lang]}</p>
              <p className="text-sm text-muted"><span className="font-semibold text-navy tabular-nums">{daysMarked(value, r.id)}</span> {L.daysMarked[lang]}</p>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(16,minmax(0,1fr))]">
              {days.map((d) => {
                const v = value[r.id]?.[d] ?? "";
                if (f.cell === "code")
                  return (
                    <label key={d} className={`flex flex-col items-center rounded-lg border text-xs ${v ? "border-teal bg-teal-soft" : "border-line"}`}>
                      <span className="pt-0.5 text-muted">{d}</span>
                      <select disabled={!can} aria-label={`${r[lang]}, ${d}`} value={v} onChange={(e) => setDay(r.id, d, e.target.value)}
                        className="w-full appearance-none bg-transparent pb-1 text-center text-sm font-bold text-navy focus:outline-none">
                        <option value=""> </option>
                        {(f.codes ?? []).map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}
                      </select>
                    </label>
                  );
                return (
                  <button key={d} type="button" disabled={!can} aria-pressed={!!v} aria-label={`${r[lang]}, ${d}`}
                    onClick={() => setDay(r.id, d, v ? "" : "X")}
                    className={`flex min-h-10 flex-col items-center justify-center rounded-lg border text-xs ${v ? "border-teal bg-teal font-bold text-white" : "border-line bg-white text-muted"}`}>
                    <span>{d}</span>{v && <span aria-hidden>✓</span>}
                  </button>
                );
              })}
            </div>
            {can && daysMarked(value, r.id) > 0 && (
              <button type="button" className="mt-2 text-sm font-semibold text-coral" onClick={() => onChange({ ...value, [r.id]: {} })}>{L.clearRow[lang]}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
