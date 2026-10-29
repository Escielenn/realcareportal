import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "@/components/phase3-bits";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const { data } = valid ? await supabase.rpc("get_password_reset", { p_token: token }) : { data: null };
  const info = data as { full_name: string; locale: string } | null;
  const es = info?.locale === "es";
  return (
    <AuthShell title={es ? "Elija una contraseña nueva" : "Choose a new password"}>
      {info ? (
        <div className="card p-6">
          <p className="mb-4 font-semibold">{es ? "Hola" : "Hi"} {info.full_name},</p>
          <ResetForm token={token} es={es} />
        </div>
      ) : (
        <div className="card p-6 text-center">
          <p className="font-semibold">This link is not valid or has expired.</p>
          <p className="mt-1 text-muted">Este enlace no es válido o ya venció.</p>
          <Link href="/forgot" className="btn-ghost mt-5">Ask for a new link / Pedir otro enlace</Link>
        </div>
      )}
    </AuthShell>
  );
}
