import { requireStaffAccount } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
import { MfaChallenge } from "@/components/mfa-bits";

export default async function MfaPage() {
  await requireStaffAccount();
  return (
    <AuthShell title="Two-step sign-in" subtitle={<p>Staff accounts use a code from an authenticator app.</p>}>
      <MfaChallenge />
    </AuthShell>
  );
}
