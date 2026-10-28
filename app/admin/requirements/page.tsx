import { requireStaff } from "@/lib/auth";
import { providerTypeLabel } from "@/lib/i18n";
import { RequirementToggle } from "@/components/admin-bits";

const TYPES = ["host_home", "family_caregiver", "scc_dsp", "nmt"];

export default async function RequirementsPage() {
  const { supabase } = await requireStaff();
  const [{ data: courses }, { data: reqs }, { data: people }] = await Promise.all([
    supabase.from("courses").select("id, title_en, published").order("sort"),
    supabase.from("requirements").select("course_id, provider_type"),
    supabase.from("profiles").select("provider_types").eq("role", "provider").eq("active", true),
  ]);
  const has = new Set((reqs ?? []).map((r) => `${r.provider_type}:${r.course_id}`));
  const countType = (t: string) => (people ?? []).filter((p) => (p.provider_types as string[]).includes(t)).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Training requirements</h1>
        <p className="text-muted">Tick which courses each provider type must complete every cycle. Changes apply to everyone of that type right away, including dashboards, compliance and transcripts.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-sand/60 text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Course</th>
              {TYPES.map((t) => <th key={t} className="px-4 py-3 text-center font-semibold">{providerTypeLabel[t].en}<span className="block font-normal">{countType(t)} providers</span></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(courses ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-sand/40">
                <td className="px-4 py-2.5 font-medium">{c.title_en}{!c.published && <span className="ml-2 pill bg-sand text-muted">Draft</span>}</td>
                {TYPES.map((t) => <td key={t} className="px-4 py-2.5 text-center"><RequirementToggle type={t} courseId={c.id} on={has.has(`${t}:${c.id}`)} /></td>)}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-line font-semibold">
            <tr><td className="px-4 py-2.5">Required courses</td>{TYPES.map((t) => <td key={t} className="px-4 py-2.5 text-center">{(reqs ?? []).filter((r) => r.provider_type === t).length}</td>)}</tr>
          </tfoot>
        </table>
      </div>
      <p className="text-sm text-muted">These defaults are placeholders until Real Care confirms the requirements matrix in the decisions workshop.</p>
    </div>
  );
}
