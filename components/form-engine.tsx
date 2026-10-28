"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitForm } from "@/app/actions";

import { visibleFields, type Field, type FormSchema, type Values, type Individual } from "@/lib/forms";
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

export function FormEngine({
  assignmentId, schema, lang, individual, initial = {}, mode, flags = {}, doneHref, preview = false,
}: {
  assignmentId: string; schema: FormSchema; lang: "en" | "es"; individual: Individual;
  initial?: Values; mode: "new" | "returned"; flags?: Record<string, string>; doneHref: string; preview?: boolean;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const editable = (f: Field) => f.type !== "prefill" && (mode === "new" || f.id in flags);
  const vis = useMemo(() => new Set(visibleFields(schema, values).map((f) => f.id)), [schema, values]);
  const missing = (f: Field) => {
    if (!f.required || !vis.has(f.id) || !editable(f)) return false;
    const v = values[f.id];
    return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  };
  const allFields = schema.sections.flatMap((s) => s.fields);
  const set = (id: string, v: unknown) => setValues((x) => ({ ...x, [id]: v }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (allFields.some(missing)) { setError(L.missing[lang]); return; }
    if (preview) { setError(lang === "es" ? "Vista previa: todo está completo. No se envió nada." : "Preview: everything required is filled in. Nothing was sent."); return; }
    // Send only visible, editable answers.
    const data: Values = {};
    for (const f of allFields) if (vis.has(f.id) && f.type !== "prefill" && (mode === "new" || f.id in flags)) data[f.id] = values[f.id] ?? null;
    start(async () => {
      const r = await submitForm(assignmentId, data);
      if (r.error) setError(r.error);
      else router.push(doneHref);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {mode === "returned" && <p className="rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{L.onlyFlagged[lang]}</p>}
      {schema.sections.map((s, si) => (
        <fieldset key={si} className="card p-5">
          <legend className="sr-only">{lang === "es" ? s.title_es : s.title_en}</legend>
          <h2 className="mb-4 text-lg font-bold">{lang === "es" ? s.title_es : s.title_en}</h2>
          <div className="space-y-5">
            {s.fields.filter((f) => vis.has(f.id)).map((f) => {
              const label = lang === "es" ? f.label_es : f.label_en;
              const can = editable(f);
              const flag = flags[f.id];
              const bad = touched && missing(f);
              const fid = `f_${f.id}`;
              const wrap = `${flag ? "rounded-xl border-2 border-coral bg-coral-soft/40 p-3" : ""}`;
              return (
                <div key={f.id} className={wrap}>
                  {flag && <p className="mb-2 text-sm font-semibold text-coral">{L.fix[lang]} {flag}</p>}
                  {f.type === "prefill" ? (
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
                      <legend className="label">{label}{f.required && <span className="text-coral"> *</span>}</legend>
                      <div className="flex flex-wrap gap-2">
                        {f.options!.map((o) => {
                          const checked = f.type === "radio" ? values[f.id] === o.value : Array.isArray(values[f.id]) && (values[f.id] as string[]).includes(o.value);
                          return (
                            <label key={o.value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 ${checked ? "border-teal bg-teal-soft font-semibold" : "border-line bg-white"} ${!can ? "opacity-70" : ""}`}>
                              <input
                                type={f.type === "radio" ? "radio" : "checkbox"} name={fid} className="h-5 w-5 accent-[#0f5c5f]" checked={checked}
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
                  ) : (
                    <div>
                      <label htmlFor={fid} className="label">{label}{f.required && <span className="text-coral"> *</span>}</label>
                      {f.type === "textarea" ? (
                        <textarea id={fid} rows={4} className="input" disabled={!can} value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)} />
                      ) : f.type === "select" ? (
                        <select id={fid} className="input" disabled={!can} value={String(values[f.id] ?? "")} onChange={(e) => set(f.id, e.target.value)}>
                          <option value="">{L.select[lang]}</option>
                          {f.options!.map((o) => <option key={o.value} value={o.value}>{o[lang]}</option>)}
                        </select>
                      ) : (
                        <input
                          id={fid} disabled={!can}
                          type={f.type === "signature" ? "text" : f.type}
                          inputMode={f.type === "number" ? "numeric" : undefined}
                          className={`input ${f.type === "signature" ? "font-[family-name:var(--font-sig)] text-2xl" : ""} ${f.type === "date" || f.type === "time" ? "max-w-xs" : ""}`}
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
      ))}
      {error && <p role="alert" className="rounded-xl bg-coral-soft px-4 py-3 text-sm font-medium text-coral">{error}</p>}
      <button disabled={pending} className="btn-primary w-full text-base sm:w-auto">{pending ? "…" : mode === "returned" ? L.resubmit[lang] : L.submit[lang]}</button>
    </form>
  );
}
