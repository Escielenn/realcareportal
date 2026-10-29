import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "@/components/phase3-bits";

export const metadata = { title: "Forgot your password? · Real Care Portal" };

export default function ForgotPage() {
  return (
    <AuthShell title="Forgot your password?" subtitle={<p>¿Olvidó su contraseña?</p>}>
      <ForgotForm />
      <p className="mt-5 text-center text-sm"><Link href="/login" className="font-semibold text-teal hover:underline">← Back to sign in / Volver</Link></p>
    </AuthShell>
  );
}
