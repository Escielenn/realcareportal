import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fmtDate } from "@/lib/i18n";
import { SubmissionPill } from "@/components/status";
import { EndLinkButton } from "@/components/phase2-bits";
import { ClientForm, LinkClientProviderForm, AssignStaffForm, EndStaffButton, ClientAssignForm } from "@/components/client-record-bits";

const STATUS_LABEL: Record<string, string> = { prospective: "Prospective", active: "Active", on_hold: "On hold", discharged: "Discharged" };
const STATUS_CLS: Record<string, string> = { prospective: "bg-sky-soft text-navy", active: "bg-green-soft text-green", on_hold: "bg-amber-soft text-amber", discharged: "bg-sand text-muted" };
const REL_CLS: Record<string, string> = { primary: "bg-teal-soft text-teal", respite: "bg-sky-soft text-navy", temporary: "bg-amber-soft text-amber", prospective: "bg-sand text-ink" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: c } = await supabase.from("individuals").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  await supabase.rpc("log_event", { p_action: "view_individual", p_table: "individuals", p_record: id });
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: links }, { data: providers }, { data: staffLinks }, { data: staff }, { data: forms }, { data: docs }, { data: templates }] = await Promise.all([
    supabase.from("provider_individuals").select("provider_id, starts_on, ends_on, relationship, note, profiles(full_name)").eq("individual_id", id).order("starts_on", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("role", "provider").eq("active", true).order("full_name"),
    supabase.from("individual_staff").select("staff_id, role, starts_on, ends_on, profiles(full_name)").eq("individual_id", id).order("starts_on", { ascending: false }),
    supabase.from("profiles").select("id, full_name").in("role", ["staff", "admin"]).eq("active", true).order("full_name"),
    supabase.from("assignments").select("id, due_on, form_templates(title_en), profiles!assignments_provider_id_fkey(full_name), submissions(id, status, submitted_at)").eq("individual_id", id).order("due_on", { ascending: false }).limit(50),
    supabase.from("documents").select("id, status, created_at, document_types(name_en), profiles!documents_provider_id_fkey(full_name)").eq("individual_id", id).order("created_at", { ascending: false }).limit(50),
    supabase.from("form_templates").select("id, title_en").eq("active", true).eq("per_individual", true).order("title_en"),
  ]);
  type L = { provider_id: string; starts_on: string; ends_on: string | null; relationship: string; note: string | null; profiles: { full_name: string } | null };
  const ls = (links ?? []) as unknown as L[];
  const current = ls.filter((l) => l.starts_on <= today && (!l.ends_on || l.ends_on >= today));
  type F = { id: string; due_on: string; form_templates: { title_en: string } | null; profiles: { full_name: string } | null; submissions: { id: string; status: string; submitted_at: string }[] | { id: string; status: string; submitted_at: string } | null };
  type D = { id: string; status: string; created_at: string; document_types: { name_en: string } | null; profiles: { full_name: string } | null };
  const fs = ((forms ?? []) as unknown as F[]).map((f) => ({ ...f, s: Array.isArray(f.submissions) ? f.submissions[0] : f.submissions }));
  const overdue = fs.filter((f) => !f.s && f.due_on < today).length;
  const age = c.date_of_birth ? Math.floor((Date.parse(today) - Date.parse(c.date_of_birth)) / 31_557_600_000) : null;

  return (
    <div className="space-y-6">
      <Link href="/admin/individuals" className="text-sm font-semibold text-teal hover:underline">← Clients</Link>
      <div className="card flex flex-wrap items-start justify-between gap-4 p-5">
        <div>
          <h1 className="text-2xl font-bold">{c.full_name}{c.preferred_name && <span className="font-normal text-muted"> · goes by {c.preferred_name}</span>}</h1>
          <p className="text-muted">{[c.client_number, c.program, c.county && `${c.county} County`, c.residence_type, age !== null && `age ${age}`, c.primary_language === "es" ? "Spanish" : null].filter(Boolean).join(" · ")}</p>
          <p className="text-sm text-muted">Services {c.service_start ? `since ${fmtDate(c.service_start)}` : "start date not set"}{c.service_end ? `, ended ${fmtDate(c.service_end)}` : ""}</p>
          {c.case_manager_name && <p className="mt-1 text-sm">Case manager: <strong>{c.case_manager_name}</strong>{c.case_management_agency ? `, ${c.case_management_agency}` : ""}{c.case_manager_phone ? ` · ${c.case_manager_phone}` : ""}{c.case_manager_email ? ` · ${c.case_manager_email}` : ""}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`pill ${STATUS_CLS[c.status] ?? ""}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
          <Link href={`/admin/form-records?client=${c.id}`} className="text-sm font-semibold text-teal hover:underline">All forms for this client →</Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Providers</h2>
          <ul className="mb-5 divide-y divide-line">
            {ls.map((l) => {
              const ended = !!l.ends_on && l.ends_on < today;
              return (
                <li key={l.provider_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <Link href={`/admin/providers/${l.provider_id}`} className={`font-medium hover:underline ${ended ? "text-muted line-through" : ""}`}>{l.profiles?.full_name}</Link>
                    <span className={`ml-2 pill ${REL_CLS[l.relationship] ?? ""}`}>{l.relationship}</span>
                    {l.note && <span className="block text-sm text-muted">{l.note}</span>}
                  </span>
                  <span className="flex items-center gap-3 text-sm text-muted">
                    {fmtDate(l.starts_on)} – {l.ends_on ? fmtDate(l.ends_on) : "present"}
                    {!l.ends_on && <EndLinkButton individualId={id} providerId={l.provider_id} />}
                  </span>
                </li>
              );
            })}
            {ls.length === 0 && <li className="py-2 text-muted">Not linked to a provider yet.</li>}
          </ul>
          <LinkClientProviderForm individualId={id} providers={(providers ?? []).map((p) => ({ id: p.id, name: p.full_name }))} />
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Real Care staff</h2>
          <ul className="mb-5 divide-y divide-line">
            {((staffLinks ?? []) as unknown as { staff_id: string; role: string; starts_on: string; ends_on: string | null; profiles: { full_name: string } | null }[]).map((s) => (
              <li key={s.staff_id + s.role + s.starts_on} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className={s.ends_on ? "text-muted line-through" : "font-medium"}>{s.profiles?.full_name} <span className="font-normal text-muted">({s.role})</span></span>
                <span className="flex items-center gap-3 text-sm text-muted">{fmtDate(s.starts_on)} – {s.ends_on ? fmtDate(s.ends_on) : "present"}{!s.ends_on && <EndStaffButton individualId={id} staffId={s.staff_id} role={s.role} />}</span>
              </li>
            ))}
            {(staffLinks ?? []).length === 0 && <li className="py-2 text-muted">No staff assigned.</li>}
          </ul>
          <AssignStaffForm individualId={id} staff={(staff ?? []).map((p) => ({ id: p.id, name: p.full_name }))} />
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Forms</h2>
            <span className="text-sm">{overdue > 0 && <span className="pill bg-coral-soft text-coral">{overdue} overdue</span>}</span>
          </div>
          <ul className="mb-5 divide-y divide-line text-sm">
            {fs.slice(0, 12).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                <span>{f.s ? <Link href={`/admin/review/${f.s.id}`} className="font-medium text-teal hover:underline">{f.form_templates?.title_en}</Link> : <span className="font-medium">{f.form_templates?.title_en}</span>}
                  <span className="block text-muted">{f.profiles?.full_name} · due {fmtDate(f.due_on)}</span></span>
                {!f.s && f.due_on < today ? <span className="pill bg-coral-soft text-coral">Overdue</span> : <SubmissionPill status={f.s?.status ?? "todo"} />}
              </li>
            ))}
            {fs.length === 0 && <li className="py-2 text-muted">No forms for this client yet.</li>}
          </ul>
          {fs.length > 12 && <Link href={`/admin/form-records?client=${c.id}`} className="mb-4 block text-sm font-semibold text-teal hover:underline">See all {fs.length} forms →</Link>}
          <h3 className="mb-2 font-semibold">Assign a form for {c.preferred_name ?? c.full_name.split(" ")[0]}</h3>
          <ClientAssignForm individualId={id} templates={(templates ?? []).map((t) => ({ id: t.id, title: t.title_en }))}
            providers={current.filter((l) => l.relationship !== "prospective").map((l) => ({ id: l.provider_id, name: l.profiles?.full_name ?? "", rel: l.relationship }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Documents</h2>
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
        <h2 className="mb-4 text-lg font-bold">Details</h2>
        <ClientForm c={{ ...c, goals: (c.goals as string[]) ?? [], notes: c.notes ?? "" }} />
      </section>
    </div>
  );
}
