// Shared form-engine types and helpers (safe on server and client).

export type Option = { value: string; en: string; es: string };

// Show or hide a field from other answers. The short form {field, equals} is kept for older definitions.
export type Rule = { field: string; op: "is" | "isnot" | ">" | "<" | "contains"; value: string };
export type Condition = { field: string; equals: string } | { logic: "all" | "any"; action: "show" | "hide"; rules: Rule[] };

// Repeating rows (timesheets, trips, account entries). "hours" columns are calculated from two time columns.
export type Column = {
  id: string;
  type: "text" | "date" | "time" | "number" | "currency" | "select" | "hours";
  label_en: string;
  label_es: string;
  options?: Option[];
  from?: [string, string];
};

export type Field = {
  id: string;
  type:
    | "text" | "textarea" | "date" | "time" | "number" | "currency" | "phone"
    | "select" | "radio" | "checkboxes" | "signature" | "prefill"
    | "info" | "repeater" | "file" | "daygrid";
  label_en: string;
  label_es: string;
  required?: boolean;
  options?: Option[];
  show_if?: Condition;
  source?: "individual.full_name" | "individual.goals";
  // info
  body_en?: string;
  body_es?: string;
  // repeater
  columns?: Column[];
  totals?: string[]; // column ids summed under the table
  min_rows?: number;
  // daygrid: days 1-31 across, one line per row; cells are a check mark or a code from a short list
  rows?: { id: string; en: string; es: string }[];
  cell?: "check" | "code";
  codes?: Option[];
  // help text under the label
  help_en?: string;
  help_es?: string;
};
export type Section = { title_en: string; title_es: string; fields: Field[] };
export type FormSchema = {
  instructions_en?: { title: string; steps: string[] }[];
  instructions_es?: { title: string; steps: string[] }[];
  sections: Section[];
};
export type Values = Record<string, unknown>;
export type Individual = { full_name: string; goals: string[] } | null;
export type Row = Record<string, string | number | null>;

const asText = (v: unknown) => (Array.isArray(v) ? v.map(String) : v === null || v === undefined ? "" : String(v));

function ruleMatches(r: Rule, values: Values) {
  const v = values[r.field];
  const list = Array.isArray(v) ? v.map(String) : null;
  switch (r.op) {
    case "is": return list ? list.includes(r.value) : asText(v) === r.value;
    case "isnot": return list ? !list.includes(r.value) : asText(v) !== r.value;
    case ">": return Number(v) > Number(r.value);
    case "<": return Number(v) < Number(r.value);
    case "contains": return String(asText(v)).toLowerCase().includes(r.value.toLowerCase());
  }
}

export function isVisible(f: Field, values: Values) {
  const c = f.show_if;
  if (!c) return true;
  if ("equals" in c) return values[c.field] === c.equals || (Array.isArray(values[c.field]) && (values[c.field] as string[]).includes(c.equals));
  const hits = c.rules.map((r) => ruleMatches(r, values));
  const met = c.logic === "all" ? hits.every(Boolean) : hits.some(Boolean);
  return c.action === "show" ? met : !met;
}

export function visibleFields(schema: FormSchema, values: Values) {
  const vis: Field[] = [];
  for (const s of schema.sections) for (const f of s.fields) if (isVisible(f, values)) vis.push(f);
  return vis;
}

// Fields that hold an answer (info blocks and pre-fills don't).
export const holdsValue = (f: Field) => f.type !== "info" && f.type !== "prefill";

// "9:00", "09:00", "2:30 PM" -> minutes after midnight
export function toMinutes(t: unknown): number | null {
  const m = String(t ?? "").trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3]) { const pm = /p/i.test(m[3]); if (h === 12) h = 0; if (pm) h += 12; }
  return h * 60 + min;
}

// Hours between two times; crossing midnight counts forward (an overnight shift).
export function hoursBetween(a: unknown, b: unknown): number | null {
  const x = toMinutes(a), y = toMinutes(b);
  if (x === null || y === null) return null;
  const d = y >= x ? y - x : y + 1440 - x;
  return Math.round((d / 60) * 100) / 100;
}

export function rowValue(c: Column, row: Row): string | number | null {
  if (c.type === "hours" && c.from) return hoursBetween(row[c.from[0]], row[c.from[1]]);
  return row[c.id] ?? null;
}

export function columnTotal(c: Column, rows: Row[]) {
  return Math.round(rows.reduce((s, r) => s + (Number(rowValue(c, r)) || 0), 0) * 100) / 100;
}

export type DayGrid = Record<string, Record<string, string>>;
export const daysMarked = (g: DayGrid | undefined, rowId: string) => Object.values(g?.[rowId] ?? {}).filter(Boolean).length;

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function displayValue(f: Field, v: unknown, lang: "en" | "es", individual: Individual): string {
  if (f.type === "prefill") {
    if (f.source === "individual.goals") return (individual?.goals ?? []).join(" · ");
    return individual?.full_name ?? "";
  }
  if (f.type === "info") return "";
  if (v === null || v === undefined || v === "") return "—";
  if (f.type === "currency" && v !== "") return money(Number(v));
  if (f.type === "file") return lang === "es" ? "Archivo adjunto" : "File attached";
  if (f.type === "daygrid") {
    const g = v as DayGrid;
    return (f.rows ?? []).map((r) => `${r[lang]}: ${Object.entries(g?.[r.id] ?? {}).filter(([, x]) => x).map(([d, x]) => (x === "X" ? d : `${d} ${x}`)).join(", ") || "—"}`).join("\n");
  }
  const optLabel = (val: string) => {
    const o = f.options?.find((x) => x.value === val);
    return o ? o[lang] : val;
  };
  if (Array.isArray(v)) return v.map((x) => optLabel(String(x))).join(", ") || "—";
  if (f.options) return optLabel(String(v));
  return String(v);
}
