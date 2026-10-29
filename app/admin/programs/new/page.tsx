import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { ProgramForm } from "@/components/program-bits";

export default async function NewProgram() {
  const { supabase } = await requireStaff();
  const { data: courses } = await supabase.from("courses").select("id, title_en, price_cents, published").order("sort");
  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/programs" className="text-sm font-semibold text-teal hover:underline">← Programs</Link>
      <h1 className="text-2xl font-bold">New program</h1>
      <section className="card p-5">
        <ProgramForm courses={(courses ?? []).map((c) => ({ id: c.id, title: c.title_en, note: c.published ? undefined : "Draft course" }))} included={[]} />
      </section>
    </div>
  );
}
