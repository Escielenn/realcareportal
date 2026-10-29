import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fmtDate } from "@/lib/i18n";
import { EndLinkButton, IndividualForm, LinkProviderForm } from "@/components/phase2-bits";

export default async function IndividualPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: i } = await supabase.from("individuals").select("*").eq("id", id).maybeSingle();
  if (!i) notFound();
  await supabase.rpc("log_event", { p_action: "view_individual", p_table: "individuals", p_record: id });
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: links }, { data: providers }, { data: forms }, { data: docs }] = await Promise.all([
    supabase.from("provider_individuals").select("provider_id, starts_on, ends_on, profiles(full_name)").eq("individual_id", id).order("starts_on", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("role", "provider").eq("active", true).order("full_name"),
    supabase.from("assignments").select("id, due_on, form_templates(title_en), profiles!assignments_provider_id_fkey(full_name), submissions(id, status)").eq("individual_id", id).order("due_on", { ascending: false }).limit(30),
    supabase.from("documents").select("id, status, created_at, document_types(name_en), profiles!documents_provider_id_fkey(full_name)").eq("individual_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  type F = { id: string; due_on: string; form_templates: { title_en: string } | null; profiles: { full_name: string } | null; submissions: { id: string; status: string }[] | { id: string; status: string } | null };
  type D = { id: string; status: string; created_at: string; document_types: { name_en: string } | null; profiles: { full_name: string } | null };
  return (
    <div className="space-y-6">
      <Link href="/admin/individuals" className="text-sm font-semibold text-teal hover:underline">← People supported</Link>
      <h1 className="text-3xl font-semibold text-navy">{i.full_name}</h1>
      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Providers</h2>
        <ul className="mb-5 divide-y divide-line">
          {(links ?? []).map((l) => {
            const ended = !!l.ends_on && l.ends_on < today;
            return (
              <li key={l.provider_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/providers/${l.provider_id}`} className={`font-medium hover:underline ${ended ? "text-muted line-through" : ""}`}>{(l.profiles as unknown as { full_name: string } | null)?.full_name}</Link>
                <span className="flex items-center gap-3 text-sm text-muted">
                  {fmtDate(l.starts_on)} – {l.ends_on ? fmtDate(l.ends_on) : "present"}
                  {!l.ends_on && <EndLinkButton individualId={id} providerId={l.provider_id} />}
                </span>
              </li>
            );
          })}
          {(links ?? []).length === 0 && <li className="py-2 text-muted">Not linked to a provider yet.</li>}
        </ul>
        <LinkProviderForm individualId={id} providers={(providers ?? []).map((p) => ({ id: p.id, name: p.full_name }))} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">Forms</h2>
          {(forms ?? []).length === 0 ? <p className="text-muted">No forms assigned for this person yet.</p> : (
            <ul className="divide-y divide-line text-sm">
              {((forms ?? []) as unknown as F[]).map((f) => {
                const s = Array.isArray(f.submissions) ? f.submissions[0] : f.submissions;
                return (
                  <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                    <span>{s ? <Link href={`/admin/review/${s.id}`} className="font-medium text-teal hover:underline">{f.form_templates?.title_en}</Link> : <span className="font-medium">{f.form_templates?.title_en}</span>}
                      <span className="block text-muted">{f.profiles?.full_name} · due {fmtDate(f.due_on)}</span></span>
                    <span className="pill bg-sand text-muted">{s?.status ?? "to do"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-semibold">Documents</h2>
          {(docs ?? []).length === 0 ? <p className="text-muted">No documents yet.</p> : (
            <ul className="divide-y divide-line text-sm">
              {((docs ?? []) as unknown as D[]).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <span><a href={`/documents/${d.id}/file`} target="_blank" rel="noopener" className="font-medium text-teal hover:underline">{d.document_types?.name_en}</a>
                    <span className="block text-muted">{d.profiles?.full_name} · {fmtDate(d.created_at)}</span></span>
                  <span className="pill bg-sand text-muted">{d.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Details</h2>
        <IndividualForm i={{ id: i.id, full_name: i.full_name, date_of_birth: i.date_of_birth, goals: (i.goals as string[]) ?? [], notes: i.notes ?? "", active: i.active }} />
      </section>
    </div>
  );
}
