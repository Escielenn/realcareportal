import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { AddProviderForm, RosterImport } from "@/components/ops-bits";

export default async function NewProviders() {
  await requireStaff("training_admin");
  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/admin/providers" className="text-sm font-semibold text-teal hover:underline">← Providers</Link>
      <div>
        <h1 className="text-2xl font-bold">Add providers</h1>
        <p className="text-muted">Providers are added without a login, so staff can start managing training now. Their courses come from their provider type(s). Send each one a login later from their page.</p>
      </div>
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-bold">Upload your roster</h2>
        <p className="mb-4 text-sm text-muted">Best for adding everyone at once. Each row is checked before anything is saved, and a bad row never stops the rest.</p>
        <RosterImport />
      </section>
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-bold">Add one provider</h2>
        <AddProviderForm />
      </section>
    </div>
  );
}
