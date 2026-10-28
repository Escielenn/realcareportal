import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth-shell";
import { JoinForm } from "./join-form";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const { data } = valid ? await supabase.rpc("get_invite", { p_token: token }) : { data: null };
  const invite = data as { full_name: string; email: string; locale: string } | null;
  const es = invite?.locale === "es";

  return (
    <AuthShell title={es ? "Bienvenido a Real Care" : "Welcome to Real Care"}>
        {invite ? (
          <div className="card p-6">
            <p className="mb-1 text-lg font-semibold">{es ? "Hola" : "Hi"} {invite.full_name.split(" ")[0]},</p>
            <p className="mb-5 text-muted">
              {es
                ? "Real Care lo invitó al portal de proveedores. Elija una contraseña para activar su cuenta."
                : "Real Care has invited you to the provider portal. Choose a password to activate your account."}
            </p>
            <JoinForm token={token} email={invite.email} es={es} />
          </div>
        ) : (
          <div className="card p-6 text-center">
            <p className="font-semibold">This invitation is not valid or has expired.</p>
            <p className="mt-1 text-muted">Esta invitación no es válida o ya venció.</p>
            <p className="mt-4 text-sm text-muted">Please contact Real Care staff for a new link. / Pida un enlace nuevo al personal de Real Care.</p>
            <Link href="/login" className="btn-ghost mt-5">Sign in / Iniciar sesión</Link>
          </div>
        )}
    </AuthShell>
  );
}
