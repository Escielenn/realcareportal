import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDate } from "@/lib/i18n";
import { AssignForm, NewTemplateForm, StopRecurringButton } from "@/components/phase2-bits";

const FREQ: Record<string, string> = { daily: "Every day", weekly: "Every week", monthly: "Every month", quarterly: "Every quarter" };

export default async function FormsAdmin({ searchParams }: { searchParams: Promise<{ assign?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireStaff();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: templates }, { data: providers }, { data: people }, { data: links }, { data: recurring }, { data: counts }] = await Promise.all([
    supabase.from("form_templates").select("id, slug, title_en, category, per_individual, self_start, active, version, updated_at").order("title_en"),
    supabase.from("profiles").select("id, full_name").eq("role", "provider").eq("active", true).order("full_name"),
    supabase.from("individuals").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("provider_individuals").select("provider_id, individual_id, starts_on, ends_on"),
    supabase.from("recurring_assignments").select("id, frequency, next_due, form_templates(title_en), profiles!recurring_assignments_provider_id_fkey(full_name), individuals(full_name)").eq("active", true).order("next_due"),
    supabase.from("assignments").select("template_id"),
  ]);
  const used = new Map<string, number>();
  for (const a of counts ?? []) used.set(a.template_id, (used.get(a.template_id) ?? 0) + 1);
  const currentLinks = (links ?? []).filter((l) => l.starts_on <= today && (!l.ends_on || l.ends_on >= today));
  const active = (templates ?? []).filter((t) => t.active);
  type Rec = { id: string; frequency: string; next_due: string; form_templates: { title_en: string } | null; profiles: { full_name: string } | null; individuals: { full_name: string } | null };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Forms &amp; assignments</h1>
        <p className="text-muted">The form library, who has what to fill out, and repeating assignments. Editing a form publishes a new version; old submissions keep theirs.</p>
      </div>

      <section className="card p-5" id="assign" data-tour="assign">
        <h2 className="mb-4 text-lg font-semibold">Assign a form</h2>
        <AssignForm defaultTemplate={sp.assign} templates={active.map((t) => ({ id: t.id, title: t.title_en, per_individual: t.per_individual }))}
          providers={(providers ?? []).map((p) => ({ id: p.id, name: p.full_name }))} people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name }))} links={currentLinks} />
      </section>

      <section className="card overflow-hidden">
        <h2 className="px-5 pt-5 pb-3 text-lg font-semibold">Form library</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-y border-line bg-sand/60 text-muted">
              <tr><th className="px-5 py-2 font-semibold">Form</th><th className="px-3 py-2 font-semibold">Category</th><th className="px-3 py-2 font-semibold">Version</th><th className="px-3 py-2 font-semibold">Assigned</th><th className="px-3 py-2 font-semibold">Status</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(templates ?? []).map((t) => (
                <tr key={t.id} className={t.active ? "" : "text-muted"}>
                  <td className="px-5 py-2.5"><Link href={`/admin/forms/${t.id}`} className="font-semibold text-teal hover:underline">{t.title_en}</Link>
                    <span className="block text-xs text-muted">{t.per_individual ? "About a person" : "General"}{t.self_start ? " · Providers can start it (QR)" : ""}</span></td>
                  <td className="px-3 py-2.5 capitalize">{t.category}</td>
                  <td className="px-3 py-2.5">v{t.version}</td>
                  <td className="px-3 py-2.5">{used.get(t.id) ?? 0}</td>
                  <td className="px-3 py-2.5">{t.active ? <span className="pill bg-green-soft text-green">Active</span> : <span className="pill bg-sand text-muted">Draft</span>}</td>
                  <td className="px-3 py-2.5 text-right"><Link href={`/admin/forms?assign=${t.id}#assign`} className="font-semibold text-teal hover:underline">Assign</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Repeating assignments</h2>
        {(recurring ?? []).length === 0 ? <p className="text-muted">None yet. Choose a repeat when you assign a form.</p> : (
          <ul className="divide-y divide-line">
            {((recurring ?? []) as unknown as Rec[]).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><strong>{r.form_templates?.title_en}</strong> · {r.profiles?.full_name}{r.individuals ? ` · ${r.individuals.full_name}` : ""}</span>
                <span className="flex items-center gap-3 text-muted">{FREQ[r.frequency]} · next {fmtDate(r.next_due)} <StopRecurringButton id={r.id} /></span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">The nightly job creates the next copy of each repeating form on its due date.</p>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">New form</h2>
        <NewTemplateForm />
      </section>
    </div>
  );
}
