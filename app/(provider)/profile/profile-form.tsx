"use client";

import { useActionState } from "react";
import { saveMyProfile } from "@/app/actions";

export function ProfileForm({ lang, locale, phone, emailNotifications }: { lang: "en" | "es"; locale: string; phone: string; emailNotifications: boolean }) {
  const [state, action, pending] = useActionState(saveMyProfile, undefined);
  const es = lang === "es";
  return (
    <form action={action} className="card space-y-4 p-5">
      <fieldset>
        <legend className="label">{es ? "Idioma preferido" : "Preferred language"}</legend>
        <div className="flex gap-2">
          {[{ v: "en", l: "English" }, { v: "es", l: "Español" }].map((o) => (
            <label key={o.v} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-4 has-[:checked]:border-teal has-[:checked]:bg-teal-soft has-[:checked]:font-semibold">
              <input type="radio" name="locale" value={o.v} defaultChecked={locale === o.v} className="h-5 w-5 accent-[#0f5c5f]" /> {o.l}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="phone" className="label">{es ? "Teléfono" : "Phone"}</label>
        <input id="phone" name="phone" type="tel" defaultValue={phone} className="input max-w-xs" autoComplete="tel" />
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="email_notifications" defaultChecked={emailNotifications} className="mt-1 h-5 w-5 accent-[#0f5c5f]" />
        <span>
          <span className="font-medium">{es ? "Enviarme avisos por correo" : "Email me when something needs my attention"}</span>
          <span className="block text-sm text-muted">{es ? "Los formularios devueltos y la capacitación atrasada siempre se envían." : "Returned forms and overdue training are always sent."}</span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{es ? "Guardar" : "Save"}</button>
        {state?.ok && <span className="text-sm font-semibold text-green">✓ {es ? "Guardado" : "Saved"}</span>}
        {state?.error && <span className="text-sm text-coral">{state.error}</span>}
      </div>
    </form>
  );
}
