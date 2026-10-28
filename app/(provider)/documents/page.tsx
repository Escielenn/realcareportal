import { requireProvider } from "@/lib/auth";
import { getLang, fmtDateTime } from "@/lib/i18n";
import { DocumentUpload } from "@/components/document-upload";

const STATUS = {
  submitted: { en: "Waiting for review", es: "En revisión", cls: "bg-sky-soft text-sky-dark" },
  returned: { en: "Returned: please send a new copy", es: "Devuelto: envíe una copia nueva", cls: "bg-coral-soft text-coral" },
  accepted: { en: "Accepted", es: "Aceptado", cls: "bg-green-soft text-green" },
} as const;

export default async function DocumentsPage() {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const es = lang === "es";
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: types }, { data: links }, { data: docs }] = await Promise.all([
    supabase.from("document_types").select("code, name_en, name_es, per_individual").order("sort"),
    supabase.from("provider_individuals").select("starts_on, ends_on, individuals(id, full_name)").eq("provider_id", profile.id),
    supabase.from("documents").select("id, type_code, filename, status, review_note, created_at, individuals(full_name)").eq("provider_id", profile.id).order("created_at", { ascending: false }).limit(100),
  ]);
  const people = (links ?? [])
    .filter((l) => l.starts_on <= today && (!l.ends_on || l.ends_on >= today))
    .map((l) => l.individuals as unknown as { id: string; full_name: string })
    .filter(Boolean)
    .map((i) => ({ id: i.id, name: i.full_name }));
  const typeName = new Map((types ?? []).map((t) => [t.code, es ? t.name_es : t.name_en]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy">{es ? "Documentos" : "Documents"}</h1>
        <p className="mt-1 text-muted">
          {es
            ? "Suba formularios de visitas médicas, listas de medicamentos y otros papeles. Solo usted y el personal de Real Care pueden verlos."
            : "Upload visit forms, medication lists and other paperwork. Only you and Real Care staff can see them."}
        </p>
      </div>
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-semibold">{es ? "Enviar un documento" : "Send a document"}</h2>
        <DocumentUpload userId={profile.id} lang={lang} people={people} types={(types ?? []).map((t) => ({ code: t.code, name: es ? t.name_es : t.name_en, per_individual: t.per_individual }))} />
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">{es ? "Mis documentos" : "My documents"}</h2>
        {(docs ?? []).length === 0 ? (
          <p className="card p-5 text-muted">{es ? "Todavía no ha enviado documentos." : "You haven't sent any documents yet."}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {(docs ?? []).map((d) => {
              const st = STATUS[d.status as keyof typeof STATUS];
              const who = (d.individuals as unknown as { full_name: string } | null)?.full_name;
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <a href={`/documents/${d.id}/file`} target="_blank" rel="noopener" className="font-semibold text-teal hover:underline">{typeName.get(d.type_code) ?? d.type_code}</a>
                    <p className="truncate text-sm text-muted">{who ? `${who} · ` : ""}{d.filename} · {fmtDateTime(d.created_at, lang)}</p>
                    {d.status === "returned" && d.review_note && <p className="mt-1 rounded-lg bg-coral-soft px-3 py-1.5 text-sm text-coral">{d.review_note}</p>}
                  </div>
                  <span className={`pill ${st.cls}`}>{es ? st.es : st.en}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
