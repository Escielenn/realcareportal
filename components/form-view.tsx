import { displayValue, isVisible, holdsValue, rowValue, columnTotal, money, type FormSchema, type Field, type Row } from "@/lib/forms";
import { fmtDateTime, type Lang } from "@/lib/i18n";

// Read-only rendering of a submission, used by providers and staff.
export function FormView({ schema, data, lang, individual }: { schema: FormSchema; data: Record<string, unknown>; lang: Lang; individual: { full_name: string; goals: string[] } | null }) {
  return (
    <div className="space-y-4">
      {schema.sections.map((s, i) => {
        const fields = s.fields.filter((f) => holdsValue(f) || f.type === "prefill").filter((f) => isVisible(f, data));
        if (fields.length === 0) return null;
        return (
          <section key={i} className="card p-5">
            <h2 className="mb-3 font-bold">{lang === "es" ? s.title_es : s.title_en}</h2>
            <dl className="divide-y divide-line">
              {fields.map((f) =>
                f.type === "repeater" ? (
                  <div key={f.id} className="py-2.5">
                    <dt className="mb-1 text-sm text-muted">{lang === "es" ? f.label_es : f.label_en}</dt>
                    <dd><RowsTable f={f} rows={(data[f.id] as Row[]) ?? []} lang={lang} /></dd>
                  </div>
                ) : (
                  <div key={f.id} className="grid gap-1 py-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                    <dt className="text-sm text-muted">{lang === "es" ? f.label_es : f.label_en}</dt>
                    <dd className={`whitespace-pre-wrap ${f.type === "signature" ? "font-[family-name:var(--font-sig)] text-2xl" : "font-medium"}`}>{displayValue(f, data[f.id], lang, individual)}</dd>
                  </div>
                ),
              )}
            </dl>
          </section>
        );
      })}
    </div>
  );
}

function RowsTable({ f, rows, lang }: { f: Field; rows: Row[]; lang: Lang }) {
  const cols = f.columns ?? [];
  if (rows.length === 0) return <p className="font-medium">—</p>;
  const show = (c: (typeof cols)[number], v: unknown) => (v === null || v === undefined || v === "" ? "—" : c.type === "currency" ? money(Number(v)) : c.type === "hours" ? Number(v).toFixed(2) : String(v));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-line text-muted"><tr>{cols.map((c) => <th key={c.id} className="py-1 pr-3 font-semibold">{lang === "es" ? c.label_es : c.label_en}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.id} className="py-1 pr-3 tabular-nums">{show(c, rowValue(c, r))}</td>)}</tr>)}
        </tbody>
        {!!f.totals?.length && (
          <tfoot className="border-t border-line font-semibold">
            <tr>{cols.map((c) => <td key={c.id} className="py-1 pr-3 tabular-nums">{f.totals!.includes(c.id) ? show(c, columnTotal(c, rows)) : ""}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function History({ events, names, lang }: { events: { id: string; action: string; note: string | null; created_at: string; actor: string | null }[]; names: Record<string, string>; lang: Lang }) {
  const verb: Record<string, { en: string; es: string }> = {
    submitted: { en: "Submitted", es: "Enviado" },
    resubmitted: { en: "Corrections sent", es: "Correcciones enviadas" },
    returned: { en: "Returned for correction", es: "Devuelto para corregir" },
    accepted: { en: "Accepted", es: "Aceptado" },
  };
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[27px] h-3 w-3 rounded-full border-2 border-white bg-teal" />
          <p className="font-semibold">{verb[e.action]?.[lang] ?? e.action}</p>
          <p className="text-sm text-muted">{fmtDateTime(e.created_at, lang)}{e.actor && names[e.actor] ? ` · ${names[e.actor]}` : ""}</p>
          {e.note && <p className="mt-1 text-sm">{e.action === "resubmitted" ? (lang === "es" ? "Campos: " : "Fields: ") : ""}{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
