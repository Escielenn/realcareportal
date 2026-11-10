import { requireStaff, staffLevel, STAFF_LEVEL_LABEL } from "@/lib/auth";
import { StaffLevelSelect } from "@/components/ops-bits";

const WHAT: [string, string][] = [
  ["Reviewer", "Sees every provider and record. Reviews forms and documents, answers messages, sends reminders, prints transcripts and reports."],
  ["Training admin", "Everything a reviewer does, plus: adds providers and uploads rosters, assigns or exempts courses, opens training years and moves due dates, records outside training, edits courses, requirements and programs, sends logins."],
  ["Full admin", "Everything, plus: changes staff permissions and turns accounts on or off."],
];

export default async function StaffPage() {
  const { supabase, profile } = await requireStaff("super_admin");
  const { data: staff } = await supabase.from("profiles").select("id, full_name, email, role, staff_level, active").in("role", ["staff", "admin"]).order("full_name");
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff &amp; permissions</h1>
        <p className="text-muted">Each staff member has one level. The database checks it on every action, not just the screens.</p>
      </div>
      <section className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead><tr className="text-sm text-muted"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Level</th></tr></thead>
          <tbody className="divide-y divide-line">
            {(staff ?? []).map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-semibold">{s.full_name}{!s.active && <span className="ml-2 pill bg-sand text-muted">Off</span>}</td>
                <td className="px-4 py-3 text-sm text-muted">{s.email}</td>
                <td className="px-4 py-3"><StaffLevelSelect profileId={s.id} level={staffLevel(s)} self={s.id === profile.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 font-bold">What each level can do</h2>
        <dl className="space-y-3">
          {WHAT.map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-muted">{v}</dd></div>)}
        </dl>
        <p className="mt-4 text-sm text-muted">New staff accounts are created by a full admin in Supabase for now (staff aren't invite-only providers). Every staff account needs two-step sign-in in production.</p>
      </section>
      <p className="text-xs text-muted">Your level: {STAFF_LEVEL_LABEL[staffLevel(profile)]}</p>
    </div>
  );
}
