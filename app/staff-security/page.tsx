import Link from "next/link";
import { requireStaffAccount } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { AuthShell } from "@/components/auth-shell";
import { MfaSetup } from "@/components/mfa-bits";

export default async function StaffSecurity() {
  const { supabase, profile } = await requireStaffAccount();
  const { data } = await supabase.rpc("my_mfa_status");
  const m = data as { required: boolean; aal: string; verified_factors: number } | null;
  // The shared demo staff login must stay one-click, so it can't have a second factor.
  const blocked = DEMO_MODE && profile.email.endsWith("@example.com")
    ? "This is the shared demo staff account, so two-step sign-in stays off here. Real staff accounts set it up on this page; it's required once the portal holds real records."
    : null;
  return (
    <AuthShell title="Two-step sign-in" subtitle={<p>{m?.required ? "Real Care requires a second step for staff accounts because the portal holds private health information." : "Protect your staff account with a code from an authenticator app."}</p>}>
      <div className="card p-6"><MfaSetup blocked={blocked} /></div>
      {(!m?.required || (m?.verified_factors ?? 0) > 0) && <p className="mt-5 text-center text-sm"><Link href="/admin" className="font-semibold text-teal hover:underline">← Back to the staff console</Link></p>}
    </AuthShell>
  );
}
