"use client";

import { useActionState, useRef } from "react";
import { signIn } from "@/app/actions";

const DEMO_ACCOUNTS = [
  { label: "Provider (English)", who: "Maria Delgado, Host Home", email: "demo.provider@example.com" },
  { label: "Proveedor (español)", who: "Luis Herrera, SCC/DSP", email: "demo.proveedor@example.com" },
  { label: "Real Care staff", who: "Dana Whitfield, reviewer", email: "demo.staff@example.com" },
];
const DEMO_PASSWORD = "RealCare-Demo-2026";

export function LoginForm({ demo, next }: { demo: boolean; next?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);

  return (
    <div className="card p-6">
      <form ref={form} action={action} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input ref={email} id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <div>
          <label htmlFor="password" className="label">Password / Contraseña</label>
          <input ref={password} id="password" name="password" type="password" autoComplete="current-password" required className="input" />
        </div>
        {state?.error && (
          <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{state.error}</p>
        )}
        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Signing in…" : "Sign in / Iniciar sesión"}
        </button>
      </form>

      {demo && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-sm font-semibold text-muted">Demo accounts</p>
          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                disabled={pending}
                onClick={() => {
                  if (email.current && password.current) {
                    email.current.value = a.email;
                    password.current.value = DEMO_PASSWORD;
                    form.current?.requestSubmit();
                  }
                }}
                className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-left hover:border-teal hover:bg-teal-soft"
              >
                <span>
                  <span className="block font-semibold text-ink">{a.label}</span>
                  <span className="block text-sm text-muted">{a.who}</span>
                </span>
                <span aria-hidden className="text-teal">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
