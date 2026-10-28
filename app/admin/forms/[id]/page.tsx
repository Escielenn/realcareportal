import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth";
import { fmtDateTime } from "@/lib/i18n";
import type { FormSchema } from "@/lib/forms";
import { TemplateEditor, TemplateFlag } from "@/components/phase2-bits";
import { PrintButton } from "@/components/client-bits";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://realcareportal.vercel.app";

export default async function FormEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: t } = await supabase.from("form_templates").select("*").eq("id", id).maybeSingle();
  if (!t) notFound();
  const { data: versions } = await supabase.from("form_versions").select("version, note, published_at, profiles(full_name)").eq("template_id", id).order("version", { ascending: false });
  // The QR code holds only a link to the portal. Scanning it still requires signing in.
  const startUrl = `${BASE}/forms/start/${t.id}`;
  const qr = t.self_start ? await QRCode.toString(startUrl, { type: "svg", margin: 1, color: { dark: "#0d0a5bff", light: "#ffffffff" } }) : null;
  return (
    <div className="space-y-6">
      <Link href="/admin/forms" className="no-print text-sm font-semibold text-teal hover:underline">← Forms</Link>
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-navy">{t.title_en}</h1>
          <p className="text-muted">{t.title_es} · version {t.version} · {t.per_individual ? "about a person" : "general"}</p>
        </div>
        <div className="flex flex-col gap-1">
          <TemplateFlag templateId={t.id} flag="active" on={t.active} label="Active (can be assigned)" />
          <TemplateFlag templateId={t.id} flag="self_start" on={t.self_start} label="Providers can start it themselves" />
        </div>
      </div>

      {qr && (
        <section className="card flex flex-wrap items-center gap-6 p-5 print:border-0">
          <div className="h-40 w-40 shrink-0" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">QR code</h2>
            <p className="max-w-md text-sm text-muted">Print this and post it where the form is needed (a med cabinet, a vehicle visor). Scanning opens the form in the portal after the provider signs in. The code contains only this link: <span className="break-all">{startUrl}</span></p>
            <div className="no-print"><PrintButton label="Print QR sign" /></div>
          </div>
        </section>
      )}

      <div className="no-print">
        <TemplateEditor templateId={t.id} initial={t.schema as FormSchema} individual={{ full_name: "Sample Person", goals: ["Practice making a simple lunch", "Walk to the mailbox with support"] }} />
      </div>

      <section className="no-print card p-5">
        <h2 className="mb-3 text-lg font-semibold">Version history</h2>
        <ul className="divide-y divide-line text-sm">
          {(versions ?? []).map((v) => (
            <li key={v.version} className="flex flex-wrap justify-between gap-2 py-2">
              <span><strong>v{v.version}</strong> {v.note ? `· ${v.note}` : ""}</span>
              <span className="text-muted">{fmtDateTime(v.published_at)}{(v.profiles as unknown as { full_name: string } | null)?.full_name ? ` · ${(v.profiles as unknown as { full_name: string }).full_name}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
