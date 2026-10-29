import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { getLang, t, fmtDate } from "@/lib/i18n";
import { title } from "@/lib/data";
import { FormEngine, Instructions, type FormSchema } from "@/components/form-engine";
import { FormView, History } from "@/components/form-view";
import { PrintButton } from "@/components/client-bits";
import { SubmissionPill } from "@/components/status";

export default async function FormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const { data: a } = await supabase.from("assignments").select("id, due_on, individual_id, form_templates(title_en, title_es, schema), individuals(full_name, goals)").eq("id", id).maybeSingle();
  if (!a) notFound();
  const tpl = a.form_templates as unknown as { title_en: string; title_es: string; schema: FormSchema };
  const individual = a.individuals as unknown as { full_name: string; goals: string[] } | null;
  if (a.individual_id && !individual) notFound(); // link to this person has ended

  const { data: sub } = await supabase.from("submissions").select("id, data, status, flags, submitted_at").eq("assignment_id", id).maybeSingle();
  const { data: draft } = sub ? { data: null } : await supabase.from("form_drafts").select("data, updated_at").eq("assignment_id", id).maybeSingle();
  const { data: events } = sub
    ? await supabase.from("submission_events").select("id, action, note, created_at, actor").eq("submission_id", sub.id).order("created_at")
    : { data: [] };
  const names: Record<string, string> = {};
  for (const e of events ?? []) if (e.actor) names[e.actor] = e.actor === profile.id ? t(lang, "you") : t(lang, "realCareStaff");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/forms" className="text-sm font-semibold text-teal hover:underline">← {t(lang, "forms")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-navy md:text-3xl">{title(tpl, lang)}</h1>
          <p className="text-muted">{individual ? `${individual.full_name} · ` : ""}{t(lang, "due")} {fmtDate(a.due_on, lang)}</p>
        </div>
        <SubmissionPill status={sub?.status ?? "todo"} lang={lang} />
      </div>

      {!sub && (
        <>
          <Instructions schema={tpl.schema} lang={lang} />
          <FormEngine assignmentId={a.id} schema={tpl.schema} lang={lang} individual={individual} mode="new" doneHref="/forms?done=1"
            initial={(draft?.data as Record<string, unknown>) ?? {}} draftSavedAt={draft?.updated_at ?? null} autosave />
        </>
      )}

      {sub?.status === "returned" && (
        <FormEngine assignmentId={a.id} schema={tpl.schema} lang={lang} individual={individual} mode="returned"
          initial={sub.data as Record<string, unknown>} flags={sub.flags as Record<string, string>} doneHref="/forms?done=1" />
      )}

      {sub && sub.status !== "returned" && <div className="no-print flex justify-end"><PrintButton label={lang === "es" ? "Imprimir o guardar PDF" : "Print or save as PDF"} /></div>}
      {sub && sub.status !== "returned" && <FormView schema={tpl.schema} data={sub.data as Record<string, unknown>} lang={lang} individual={individual} />}

      {sub && (events ?? []).length > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 font-bold">{t(lang, "formHistory")}</h2>
          <History events={events ?? []} names={names} lang={lang} />
        </section>
      )}
    </div>
  );
}
