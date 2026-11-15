import Link from "next/link";
import { requireStaff, staffCan } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { wixConfigured } from "@/lib/wix-client";
import { fmtDate, fmtDateTime, providerTypeLabel } from "@/lib/i18n";
import { PullForm, TypeEditor, CommitBar } from "@/components/wix-import-bits";

export const maxDuration = 120;

const STATUS: Record<string, { label: string; cls: string; help: string }> = {
  ready: { label: "Ready", cls: "bg-green-soft text-green", help: "Will be added" },
  no_type: { label: "Needs a type", cls: "bg-amber-soft text-amber", help: "Choose a provider type to add them" },
  existing: { label: "Already here", cls: "bg-sky-soft text-ink", help: "Someone with this email is already in the portal; skipped" },
  duplicate_email: { label: "Same email twice", cls: "bg-amber-soft text-amber", help: "Another Wix member uses this email; skipped" },
  no_email: { label: "No email", cls: "bg-coral-soft text-coral", help: "No valid email on Wix; skipped" },
  imported: { label: "Added", cls: "bg-green-soft text-green", help: "Added to the portal" },
};
const ORDER = ["no_type", "ready", "duplicate_email", "no_email", "existing", "imported"];

type Person = {
  id: string; full_name: string; email: string | null; provider_types: string[]; status: string;
  completions: { slug: string; lang: string; on: string }[]; access: { kind: string; ends_on?: string } | null; provider_id: string | null;
};

export default async function WixImportPage({ searchParams }: { searchParams: Promise<{ done?: string; discarded?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile } = await requireStaff("training_admin");
  const canImport = staffCan(profile, "super_admin");
  const { data: runs } = await supabase.from("wix_import_runs").select("*").order("created_at", { ascending: false }).limit(10);
  const staged = (runs ?? []).find((r) => r.status === "staged");
  const { data: people } = staged
    ? await supabase.from("wix_import_people").select("id, full_name, email, provider_types, status, completions, access, provider_id").eq("run_id", staged.id).order("full_name")
    : { data: [] as Person[] };
  const list = ((people ?? []) as Person[]).sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.full_name.localeCompare(b.full_name));
  const count = (s: string) => list.filter((p) => p.status === s).length;
  const summary = (staged?.summary ?? {}) as { skipped_blocked?: number; default_type_used?: number; unmatched_programs?: string[]; completions?: number; with_access?: number };
  const connected = DEMO_MODE || wixConfigured();
  const done = sp.done ? (runs ?? []).find((r) => r.id === sp.done && r.status === "committed") : undefined;
  const doneResult = (done?.result ?? null) as { people?: number; completions?: number; access?: number } | null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm"><Link href="/admin/import" className="text-teal hover:underline">Import from Wix</Link> / Everyone at once</p>
        <h1 className="text-2xl font-bold">Bring everyone over from Wix</h1>
        <p className="max-w-3xl text-muted">
          Reads the live Wix training site: members, their provider type labels, every completed course and their plan.
          You see a preview first. When you add them, they get <strong>no login and no emails</strong> until you send invites from Providers.
          Blocked Wix members are never brought over.
        </p>
      </div>

      {doneResult && (
        <div role="status" className="rounded-xl bg-green-soft p-4 text-sm">
          <p className="font-semibold">Added {doneResult.people ?? 0} providers with {doneResult.completions ?? 0} completed courses. Nobody was notified.</p>
          <p className="mt-1">They have no login yet. <Link href="/admin/providers" className="font-semibold text-teal underline">Send login invites from Providers</Link> when you&apos;re ready.</p>
        </div>
      )}
      {sp.discarded && <p role="status" className="rounded-xl bg-sand p-4 text-sm">Preview discarded. Nothing was added.</p>}

      {DEMO_MODE && (
        <p className="rounded-xl bg-amber-soft p-4 text-sm">
          <strong>Demo site:</strong> this uses a fictional sample, never the real Wix site. Real people are only imported on the production portal.
        </p>
      )}

      {!canImport ? (
        <p className="card p-5 text-muted">Only a super admin can run the Wix import. You can still see past imports below.</p>
      ) : !connected ? (
        <section className="card space-y-2 p-5">
          <h2 className="text-lg font-bold">Connect Wix first</h2>
          <p className="text-muted">Add <code>WIX_API_KEY</code> and <code>WIX_SITE_ID</code> to the server settings (Vercel), then reload this page. See PRODUCTION-SETUP.md.</p>
        </section>
      ) : !staged ? (
        <section className="card p-5"><PullForm demo={DEMO_MODE} /></section>
      ) : (
        <>
          <section className="card space-y-4 p-5">
            <h2 className="text-lg font-bold">Preview from {fmtDateTime(staged.created_at)}</h2>
            <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Ready to add", count("ready")], ["Need a type", count("no_type")], ["Skipped", count("existing") + count("duplicate_email") + count("no_email")],
                ["Blocked, left out", summary.skipped_blocked ?? 0], ["Completed courses", summary.completions ?? 0], ["With a plan", summary.with_access ?? 0],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-sand/60 p-3"><dt className="text-xs text-muted">{k}</dt><dd className="text-2xl font-bold">{v}</dd></div>
              ))}
            </dl>
            {(summary.default_type_used ?? 0) > 0 && <p className="text-sm text-muted">{summary.default_type_used} people had no type label on Wix and got the default type. Change any of them below.</p>}
            {(summary.unmatched_programs ?? []).length > 0 && (
              <p className="text-sm text-muted">Wix courses with no match in the portal (their completions are left out): {summary.unmatched_programs!.join("; ")}</p>
            )}
            <p className="text-sm text-muted">
              Each person&apos;s Wix history becomes their first training year. If they finished every required course more than a year ago,
              their next year shows as overdue right away.
            </p>
            <CommitBar runId={staged.id} ready={count("ready")} />
          </section>

          <section className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-line bg-sand/60 text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Person</th><th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Courses done</th><th className="px-4 py-3 font-semibold">Last course</th>
                  <th className="px-4 py-3 font-semibold">Plan</th><th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => {
                  const last = p.completions.reduce((m, c) => (c.on > m ? c.on : m), "");
                  const st = STATUS[p.status] ?? { label: p.status, cls: "bg-sand", help: "" };
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="px-4 py-2"><span className="font-semibold">{p.full_name}</span><span className="block text-xs text-muted">{p.email ?? "no email"}</span></td>
                      <td className="px-4 py-2">
                        {canImport && (p.status === "ready" || p.status === "no_type")
                          ? <TypeEditor personId={p.id} types={p.provider_types} />
                          : p.provider_types.map((t) => providerTypeLabel[t]?.en ?? t).join(", ") || "None"}
                      </td>
                      <td className="px-4 py-2">{p.completions.length}{p.completions.some((c) => c.lang === "es") && <span className="block text-xs text-muted">includes Spanish</span>}</td>
                      <td className="px-4 py-2">{last ? fmtDate(last) : "None"}</td>
                      <td className="px-4 py-2">{p.access ? (p.access.kind === "real_care" ? "Real Care (free)" : `All-Access to ${p.access.ends_on ? fmtDate(p.access.ends_on) : "?"}`) : "None"}</td>
                      <td className="px-4 py-2"><span className={`pill ${st.cls}`} title={st.help}>{st.label}</span></td>
                    </tr>
                  );
                })}
                {list.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">No members found on Wix.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Past imports</h2>
        <ul className="card divide-y divide-line">
          {(runs ?? []).filter((r) => r.status !== "staged").map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
              <span>{fmtDateTime(r.created_at)} · {r.source === "sample" ? "Sample data" : "Live Wix site"}</span>
              <span className="text-muted">
                {r.status === "committed" ? `Added ${(r.result as { people?: number } | null)?.people ?? 0} providers` : "Discarded"}
              </span>
            </li>
          ))}
          {(runs ?? []).filter((r) => r.status !== "staged").length === 0 && <li className="px-4 py-3 text-sm text-muted">None yet.</li>}
        </ul>
      </section>
    </div>
  );
}
