import { DEMO_MODE } from "@/lib/config";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const demo = DEMO_MODE;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="h-12 w-12" />
          <h1 className="mt-4 text-2xl font-bold text-ink">Real Care Portal</h1>
          <p className="mt-1 text-muted">Training, forms and messages in one place.</p>
          <p className="text-muted">Capacitación, formularios y mensajes en un solo lugar.</p>
        </div>
        <LoginForm demo={demo} />
        {demo && (
          <p className="mt-6 text-center text-xs text-muted">
            Demo environment. Every person and record here is fictional.
          </p>
        )}
      </div>
    </main>
  );
}
