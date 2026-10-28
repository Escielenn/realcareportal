import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { IndividualForm } from "@/components/phase2-bits";

export default async function IndividualsPage() {
  const { supabase } = await requireStaff();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: people }, { data: links }] = await Promise.all([
    supabase.from("individuals").select("id, full_name, active, goals").order("full_name"),
    supabase.from("provider_individuals").select("individual_id, starts_on, ends_on, profiles(full_name)"),
  ]);
  const current = new Map<string, string[]>();
  for (const l of links ?? []) {
    if (l.starts_on <= today && (!l.ends_on || l.ends_on >= today)) {
      const n = (l.profiles as unknown as { full_name: string } | null)?.full_name ?? "";
      current.set(l.individual_id, [...(current.get(l.individual_id) ?? []), n]);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-navy">People supported</h1>
        <p className="text-muted">Who each provider supports, and since when. A provider sees a person&apos;s forms and documents only while this link is current.</p>
      </div>
      <ul className="card divide-y divide-line">
        {(people ?? []).map((p) => (
          <li key={p.id}>
            <Link href={`/admin/individuals/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-sand/60">
              <span>
                <span className={`font-semibold ${p.active ? "" : "text-muted line-through"}`}>{p.full_name}</span>
                <span className="block text-sm text-muted">{(current.get(p.id) ?? []).join(", ") || "No current provider"} · {(p.goals as string[] | null)?.length ?? 0} goals</span>
              </span>
              <span className="text-teal" aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="card p-5">
        <h2 className="mb-3 text-lg font-semibold">Add a person</h2>
        <p className="mb-4 text-sm text-muted">Demo: use made-up names only. Real records come in after the HIPAA review.</p>
        <IndividualForm />
      </section>
    </div>
  );
}
