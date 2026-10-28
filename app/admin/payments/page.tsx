import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { fmtDate } from "@/lib/i18n";
import { GrantAccessForm, RefundButton } from "@/components/admin-bits";

const METHOD: Record<string, string> = { wix: "Wix (imported)", demo_checkout: "Card (demo checkout)", stripe: "Card (Stripe)", paid_by_real_care: "Paid by Real Care" };

export default async function PaymentsPage() {
  const { supabase } = await requireStaff();
  const [{ data: orders }, { data: people }, { data: courses }] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("profiles").select("id, full_name").eq("role", "provider").order("full_name"),
    supabase.from("courses").select("id, title_en, in_all_access, price_cents").order("sort"),
  ]);
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const paid = (orders ?? []).filter((o) => o.status === "paid");
  const sum = (f: (o: { method: string }) => boolean) => paid.filter(f).reduce((a, o) => a + o.amount_cents, 0) / 100;
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments &amp; access</h1>
        <p className="text-muted">Course fees and who has access to what. QMAP and Respite are sold separately; the other 14 courses are covered by All-Access.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-2xl font-bold">${sum((o) => o.method !== "paid_by_real_care").toFixed(2)}</p><p className="text-sm text-muted">Collected from providers (all time)</p></div>
        <div className="card p-4"><p className="text-2xl font-bold">{paid.filter((o) => o.method === "paid_by_real_care").length}</p><p className="text-sm text-muted">Access grants paid by Real Care</p></div>
        <div className="card p-4"><p className="text-2xl font-bold">{paid.filter((o) => new Date(o.created_at).getFullYear() === year).length}</p><p className="text-sm text-muted">Orders in {year}</p></div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-line bg-sand/60 text-muted">
              <tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Provider</th><th className="px-4 py-3 font-semibold">Item</th><th className="px-4 py-3 font-semibold">Method</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(orders ?? []).map((o) => (
                <tr key={o.id} className={o.status === "refunded" ? "text-muted" : ""}>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(o.created_at)}</td>
                  <td className="px-4 py-2"><Link href={`/admin/providers/${o.provider_id}`} className="text-teal hover:underline">{names.get(o.provider_id)}</Link></td>
                  <td className="px-4 py-2">{o.description}{o.note && <span className="block text-xs text-muted">{o.note}</span>}</td>
                  <td className="px-4 py-2">{METHOD[o.method] ?? o.method}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${o.status === "refunded" ? "line-through" : ""}`}>${(o.amount_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{o.status === "refunded" ? <span className="pill bg-sand text-muted">Refunded</span> : <RefundButton orderId={o.id} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card h-fit p-5">
          <h2 className="mb-1 font-bold">Give access</h2>
          <p className="mb-4 text-sm text-muted">For courses Real Care pays for. The provider gets an in-app notice right away.</p>
          <GrantAccessForm providers={(people ?? []).map((p) => ({ id: p.id, name: p.full_name }))} courses={(courses ?? []).map((c) => ({ id: c.id, title: `${c.title_en}${c.in_all_access ? "" : " (sold separately)"}` }))} />
          <p className="mt-4 text-xs text-muted">Live card payments go through Stripe Checkout in production. This demo uses a simulated checkout with no card.</p>
        </section>
      </div>
    </div>
  );
}
