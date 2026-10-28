// Shared form-engine types and helpers (safe on server and client).

export type Option = { value: string; en: string; es: string };
export type Field = {
  id: string;
  type: "text" | "textarea" | "date" | "time" | "number" | "select" | "radio" | "checkboxes" | "signature" | "prefill";
  label_en: string;
  label_es: string;
  required?: boolean;
  options?: Option[];
  show_if?: { field: string; equals: string };
  source?: "individual.full_name" | "individual.goals";
};
export type Section = { title_en: string; title_es: string; fields: Field[] };
export type FormSchema = {
  instructions_en?: { title: string; steps: string[] }[];
  instructions_es?: { title: string; steps: string[] }[];
  sections: Section[];
};
export type Values = Record<string, unknown>;
export type Individual = { full_name: string; goals: string[] } | null;


export function visibleFields(schema: FormSchema, values: Values) {
  const vis: Field[] = [];
  for (const s of schema.sections)
    for (const f of s.fields) if (!f.show_if || values[f.show_if.field] === f.show_if.equals) vis.push(f);
  return vis;
}

export function displayValue(f: Field, v: unknown, lang: "en" | "es", individual: Individual): string {
  if (f.type === "prefill") {
    if (f.source === "individual.goals") return (individual?.goals ?? []).join(" · ");
    return individual?.full_name ?? "";
  }
  if (v === null || v === undefined || v === "") return "—";
  const optLabel = (val: string) => {
    const o = f.options?.find((x) => x.value === val);
    return o ? o[lang] : val;
  };
  if (Array.isArray(v)) return v.map((x) => optLabel(String(x))).join(", ") || "—";
  if (f.options) return optLabel(String(v));
  return String(v);
}

