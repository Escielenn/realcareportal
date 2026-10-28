import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getLang, fmtDate } from "@/lib/i18n";
import { PrintButton } from "@/components/client-bits";
import { Logo } from "@/components/logo";

export default async function Certificate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await getProfile();
  if (!profile) redirect("/login");
  const lang = await getLang();
  // RLS: providers only see their own completions; staff see all.
  const { data: c } = await supabase.from("completions").select("id, completed_at, score, language, source, provider_id, courses(title_en, title_es), training_cycles(cycle_number, label, starts_on, due_on)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const { data: who } = await supabase.from("profiles").select("full_name").eq("id", c.provider_id).single();
  const course = c.courses as unknown as { title_en: string; title_es: string };
  const cycle = c.training_cycles as unknown as { cycle_number: number; label: string | null; starts_on: string; due_on: string };
  const es = lang === "es";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={profile.role === "provider" ? "/training" : `/admin/providers/${c.provider_id}`} className="text-sm font-semibold text-teal hover:underline">← {es ? "Volver" : "Back"}</Link>
        <PrintButton label={es ? "Imprimir" : "Print"} />
      </div>
      <div className="print-page rounded-2xl border-[6px] border-double border-teal bg-white px-8 py-12 text-center shadow-sm md:px-14">
        <div className="flex justify-center"><Logo className="h-14 w-14" /></div>
        <p className="mt-4 text-sm font-semibold tracking-[0.2em] text-teal uppercase">Real Care, Inc.</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">{es ? "Certificado de finalización" : "Certificate of Completion"}</h1>
        <p className="mt-8 text-muted">{es ? "Se certifica que" : "This certifies that"}</p>
        <p className="mt-2 font-[family-name:var(--font-sig)] text-4xl text-ink md:text-5xl">{who?.full_name}</p>
        <p className="mt-6 text-muted">{es ? "completó satisfactoriamente el curso" : "has successfully completed"}</p>
        <p className="mt-2 text-2xl font-bold">{es ? course.title_es : course.title_en}</p>
        <div className="mx-auto mt-10 grid max-w-lg grid-cols-3 gap-4 text-sm">
          <div><p className="font-semibold">{fmtDate(c.completed_at, lang)}</p><p className="text-muted">{es ? "Fecha" : "Date"}</p></div>
          <div><p className="font-semibold">{c.score ? `${c.score}%` : "—"}</p><p className="text-muted">{es ? "Calificación" : "Score"}</p></div>
          <div><p className="font-semibold">{cycle?.label ?? cycle?.cycle_number}</p><p className="text-muted">{es ? "Ciclo" : "Training cycle"}</p></div>
        </div>
        <p className="mt-10 text-xs text-muted">
          {es ? "Válido hasta" : "Valid through"} {fmtDate(cycle?.due_on, lang)} · ID {c.id.slice(0, 8).toUpperCase()}
          {c.source === "legacy_wix" ? (es ? " · Importado de Wix" : " · Imported from Wix") : ""}
        </p>
      </div>
    </main>
  );
}
