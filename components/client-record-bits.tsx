"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveClient, linkClientProvider, assignClientStaff, endClientStaff, assignClientForm } from "@/app/admin/client-actions";

type R = { ok?: boolean; error?: string; message?: string; id?: string };
function Msg({ r }: { r?: R }) {
  if (!r) return null;
  if (r.error) return <p role="alert" className="text-sm text-coral">{r.error}</p>;
  if (r.message) return <p role="status" className="text-sm font-semibold text-green">✓ {r.message}</p>;
  return null;
}
const today = () => new Date().toISOString().slice(0, 10);

export type ClientRow = {
  id?: string; full_name?: string; preferred_name?: string | null; client_number?: string | null; date_of_birth?: string | null; status?: string;
  program?: string | null; county?: string | null; residence_type?: string | null; primary_language?: string; service_start?: string | null; service_end?: string | null;
  case_management_agency?: string | null; case_manager_name?: string | null; case_manager_phone?: string | null; case_manager_email?: string | null;
  goals?: string[]; notes?: string;
};

function F({ name, label, type = "text", v, list }: { name: string; label: string; type?: string; v?: string | null; list?: string }) {
  return <div><label className="label text-sm" htmlFor={`cl-${name}`}>{label}</label><input id={`cl-${name}`} name={name} type={type} defaultValue={v ?? ""} list={list} autoComplete="off" className="input py-2" /></div>;
}

export function ClientForm({ c = {} }: { c?: ClientRow }) {
  const router = useRouter();
  const [r, action, pending] = useActionState(async (p: R | undefined, fd: FormData) => {
    const res = await saveClient(p, fd);
    if (res.ok && !c.id && res.id) router.push(`/admin/individuals/${res.id}`);
    return res;
  }, undefined);
  return (
    <form action={action} className="space-y-5">
      {c.id && <input type="hidden" name="id" value={c.id} />}
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 font-semibold">Client</legend>
        <div className="sm:col-span-2"><label className="label text-sm" htmlFor="cl-full_name">Full name</label><input id="cl-full_name" name="full_name" required defaultValue={c.full_name} className="input py-2" /></div>
        <F name="preferred_name" label="Goes by" v={c.preferred_name} />
        <F name="client_number" label="Real Care client #" v={c.client_number} />
        <F name="date_of_birth" label="Date of birth" type="date" v={c.date_of_birth} />
        <div>
          <label className="label text-sm" htmlFor="cl-status">Status</label>
          <select id="cl-status" name="status" defaultValue={c.status ?? "active"} className="input py-2">
            <option value="prospective">Prospective</option><option value="active">Active</option><option value="on_hold">On hold</option><option value="discharged">Discharged</option>
          </select>
        </div>
        <div>
          <label className="label text-sm" htmlFor="cl-lang">Language</label>
          <select id="cl-lang" name="primary_language" defaultValue={c.primary_language ?? "en"} className="input py-2">
            <option value="en">English</option><option value="es">Spanish</option><option value="other">Other</option>
          </select>
        </div>
        <F name="residence_type" label="Lives in" v={c.residence_type} list="cl-res" />
      </fieldset>
      <datalist id="cl-res"><option value="Host home" /><option value="Family home" /><option value="Own home" /></datalist>
      <datalist id="cl-prog"><option value="HCBS-DD" /><option value="SLS" /><option value="CES" /><option value="CHRP" /></datalist>
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 font-semibold">Services</legend>
        <F name="program" label="Program / waiver" v={c.program} list="cl-prog" />
        <F name="county" label="County" v={c.county} />
        <F name="service_start" label="Services started" type="date" v={c.service_start} />
        <F name="service_end" label="Services ended" type="date" v={c.service_end} />
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 font-semibold">Case management</legend>
        <F name="case_management_agency" label="Agency" v={c.case_management_agency} />
        <F name="case_manager_name" label="Case manager" v={c.case_manager_name} />
        <F name="case_manager_phone" label="Phone" type="tel" v={c.case_manager_phone} />
        <F name="case_manager_email" label="Email" type="email" v={c.case_manager_email} />
      </fieldset>
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <label className="label text-sm" htmlFor="cl-goals">Goals (one per line)</label>
          <textarea id="cl-goals" name="goals" rows={4} defaultValue={(c.goals ?? []).join("\n")} className="input" />
          <p className="mt-1 text-sm text-muted">Goals pre-fill on log notes and goal tracking forms.</p>
        </div>
        <div><label className="label text-sm" htmlFor="cl-notes">Staff notes</label><textarea id="cl-notes" name="notes" rows={4} defaultValue={c.notes} className="input" /></div>
      </div>
      <Msg r={r} />
      <button className="btn-primary" disabled={pending}>{c.id ? "Save client" : "Add client"}</button>
    </form>
  );
}

export function LinkClientProviderForm({ individualId, providers }: { individualId: string; providers: { id: string; name: string }[] }) {
  const [r, action, pending] = useActionState(linkClientProvider, undefined);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <input type="hidden" name="individual_id" value={individualId} />
      <div className="lg:col-span-2"><label className="label text-sm" htmlFor="lcp-p">Provider</label>
        <select id="lcp-p" name="provider_id" className="input py-2">{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div><label className="label text-sm" htmlFor="lcp-r">Relationship</label>
        <select id="lcp-r" name="relationship" className="input py-2"><option value="primary">Primary</option><option value="respite">Respite</option><option value="temporary">Temporary</option><option value="prospective">Prospective (meet and greet)</option></select></div>
      <div><label className="label text-sm" htmlFor="lcp-s">Starts</label><input id="lcp-s" name="starts_on" type="date" defaultValue={today()} className="input py-2" /></div>
      <div><label className="label text-sm" htmlFor="lcp-e">Ends (optional)</label><input id="lcp-e" name="ends_on" type="date" className="input py-2" /></div>
      <div className="lg:col-span-4"><label className="label text-sm" htmlFor="lcp-n">Note (optional)</label><input id="lcp-n" name="note" maxLength={500} className="input py-2" /></div>
      <button className="btn-primary" disabled={pending}>Link provider</button>
      <div className="sm:col-span-2 lg:col-span-5"><Msg r={r} /><p className="text-sm text-muted">Prospective providers don&apos;t see the client&apos;s forms or documents until the relationship changes.</p></div>
    </form>
  );
}

export function AssignStaffForm({ individualId, staff }: { individualId: string; staff: { id: string; name: string }[] }) {
  const [r, action, pending] = useActionState(assignClientStaff, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="individual_id" value={individualId} />
      <div><label className="label text-sm" htmlFor="as-s">Staff member</label>
        <select id="as-s" name="staff_id" className="input py-2">{staff.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div><label className="label text-sm" htmlFor="as-r">Role</label>
        <select id="as-r" name="role" className="input py-2"><option value="coordinator">Coordinator</option><option value="nurse">Nurse</option><option value="supervisor">Supervisor</option><option value="other">Other</option></select></div>
      <button className="btn-ghost" disabled={pending}>Assign</button>
      <Msg r={r} />
    </form>
  );
}

export function EndStaffButton({ individualId, staffId, role }: { individualId: string; staffId: string; role: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="text-sm text-coral hover:underline"
      onClick={() => start(async () => { await endClientStaff(individualId, staffId, role); router.refresh(); })}>End</button>
  );
}

export function ClientAssignForm({ individualId, templates, providers }: { individualId: string; templates: { id: string; title: string }[]; providers: { id: string; name: string; rel: string }[] }) {
  const [r, action, pending] = useActionState(assignClientForm, undefined);
  if (providers.length === 0) return <p className="text-sm text-muted">Link a current provider first. Forms for a client are filled in by their providers.</p>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="individual" value={individualId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3"><label className="label text-sm" htmlFor="caf-t">Form</label>
          <select id="caf-t" name="template" className="input py-2">{templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
        <div><label className="label text-sm" htmlFor="caf-d">First due</label><input id="caf-d" name="due" type="date" required defaultValue={today()} className="input py-2" /></div>
        <div><label className="label text-sm" htmlFor="caf-f">Repeat</label>
          <select id="caf-f" name="frequency" className="input py-2"><option value="once">One time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></div>
      </div>
      <fieldset>
        <legend className="label text-sm">Providers who fill it in</legend>
        <div className="flex flex-wrap gap-2">
          {providers.map((p, i) => (
            <label key={p.id} className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
              <input type="checkbox" name="providers" value={p.id} defaultChecked={i === 0} /> {p.name} <span className="text-muted">({p.rel})</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Msg r={r} />
      <button className="btn-primary" disabled={pending}>Assign form</button>
    </form>
  );
}
