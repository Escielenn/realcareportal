import { requireStaff } from "@/lib/auth";
import { fmtDateTime, providerTypeLabel } from "@/lib/i18n";
import { ApplicationActions } from "@/components/phase2-bits";

export default async function ApplicationsPage() {
  const { supabase } = await requireStaff();
  const { data: apps } = await supabase.from("applications").select("*").order("created_at", { ascending: false }).limit(200);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Applications</h1>
        <p className="text-muted">People who applied on the public <a href="/apply" target="_blank" className="font-semibold text-teal hover:underline">/apply</a> page. Inviting someone creates their portal invitation.</p>
      </div>
      {(apps ?? []).length === 0 ? <p className="card p-6 text-muted">No applications yet.</p> : (
        <ul className="card divide-y divide-line">
          {(apps ?? []).map((a) => {
            const d = (a.data ?? {}) as Record<string, string>;
            return (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{a.full_name} <span className="font-normal text-muted">· {a.email}{a.phone ? ` · ${a.phone}` : ""}</span></p>
                  <p className="text-sm text-muted">{(a.provider_types as string[]).map((t) => providerTypeLabel[t]?.en ?? t).join(", ") || "Type not chosen"} · {a.locale === "es" ? "Spanish" : "English"} · {fmtDateTime(a.created_at)}</p>
                  {(d.city || d.experience) && <p className="mt-1 text-sm">{d.city ? `${d.city}. ` : ""}{d.experience}</p>}
                </div>
                {a.status === "new" ? <ApplicationActions id={a.id} /> : <span className={`pill ${a.status === "invited" ? "bg-green-soft text-green" : "bg-sand text-muted"}`}>{a.status}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
