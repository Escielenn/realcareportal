import { DEMO_MODE } from "@/lib/config";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const demo = DEMO_MODE;
  return (
    <AuthShell
      title="Real Care Portal"
      subtitle={
        <>
          <p>Sign in to your training, forms and messages.</p>
          <p>Inicie sesión para ver su capacitación, formularios y mensajes.</p>
        </>
      }
    >
      <LoginForm demo={demo} next={next && /^\/forms\/start\/[0-9a-f-]{36}$/i.test(next) ? next : undefined} />
      {demo && <p className="mt-6 text-center text-xs text-muted">Demo environment. Every person and record here is fictional.</p>}
    </AuthShell>
  );
}
