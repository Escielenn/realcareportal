import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProvider } from "@/lib/auth";
import { getLang } from "@/lib/i18n";
import { startForm } from "@/app/actions";

// Landing page for a form's QR code: pick the person (if needed) and start a new copy of the form.
export default async function StartForm({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const { id } = await params;
  const { e } = await searchParams;
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const es = lang === "es";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: t } = await supabase.from("form_templates").select("id, title_en, title_es, per_individual, self_start, active").eq("id", id).maybeSingle();
  if (!t) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const { data: links } = await supabase.from("provider_individuals").select("starts_on, ends_on, individuals(id, full_name)").eq("provider_id", profile.id);
  const people = (links ?? []).filter((l) => l.starts_on <= today && (!l.ends_on || l.ends_on >= today)).map((l) => l.individuals as unknown as { id: string; full_name: string }).filter(Boolean);
  const title = es ? t.title_es : t.title_en;

  async function go(fd: FormData) {
    "use server";
    const r = await startForm(id, (fd.get("individual") as string) || null);
    if (r?.error) {
      const { redirect } = await import("next/navigation");
      redirect(`/forms/start/${id}?e=1`);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <Link href="/forms" className="text-sm font-semibold text-teal hover:underline">← {es ? "Formularios" : "Forms"}</Link>
      <div className="card p-6">
        <p className="text-xs font-semibold tracking-[0.16em] text-sky-dark uppercase">{es ? "Nuevo formulario" : "New form"}</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy">{title}</h1>
        {!t.active || !t.self_start ? (
          <p className="mt-4 rounded-xl bg-sand p-4 text-muted">{es ? "El personal de Real Care asigna este formulario. Revise su lista de formularios." : "Real Care staff assign this form. Check your forms list."}</p>
        ) : (
          <form action={go} className="mt-5 space-y-4">
            {t.per_individual && (
              people.length === 0 ? (
                <p className="rounded-xl bg-sand p-4 text-muted">{es ? "No apoya a ninguna persona en este momento." : "You aren't supporting anyone right now."}</p>
              ) : (
                <fieldset>
                  <legend className="label">{es ? "¿Sobre quién es?" : "Who is this about?"}</legend>
                  <div className="space-y-2">
                    {people.map((p, i) => (
                      <label key={p.id} className="flex items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
                        <input type="radio" name="individual" value={p.id} defaultChecked={i === 0} /> <span className="font-medium">{p.full_name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )
            )}
            {e && <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{es ? "No se pudo empezar el formulario. Intente de nuevo." : "We couldn't start the form. Please try again."}</p>}
            <button className="btn-primary w-full" disabled={t.per_individual && people.length === 0}>{es ? "Empezar" : "Start"} →</button>
          </form>
        )}
      </div>
    </div>
  );
}
