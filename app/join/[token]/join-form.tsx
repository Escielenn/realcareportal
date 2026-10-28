"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/app/actions";

export function JoinForm({ token, email, es }: { token: string; email: string; es: boolean }) {
  const [state, action, pending] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <p className="label">Email</p>
        <p className="rounded-xl bg-sand px-3.5 py-2.5 font-medium">{email}</p>
      </div>
      <div>
        <label htmlFor="password" className="label">{es ? "Contraseña nueva" : "New password"}</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" />
        <p className="mt-1 text-sm text-muted">{es ? "Al menos 10 caracteres." : "At least 10 characters."}</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">{es ? "Repita la contraseña" : "Type it again"}</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className="input" />
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "…" : es ? "Activar mi cuenta" : "Activate my account"}</button>
    </form>
  );
}
