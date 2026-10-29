"use client";

import { useActionState, useState } from "react";
import { submitApplication } from "@/app/actions";

const TYPES = [
  { v: "host_home", en: "Host Home Provider", es: "Proveedor de Hogar Anfitrión" },
  { v: "family_caregiver", en: "Family Caregiver", es: "Cuidador familiar" },
  { v: "scc_dsp", en: "SCC / Direct Support Professional", es: "SCC / Profesional de apoyo directo" },
  { v: "nmt", en: "Non-Medical Transportation", es: "Transporte no médico" },
];

export function ApplyForm() {
  const [lang, setLang] = useState<"en" | "es">("en");
  const es = lang === "es";
  const [r, action, pending] = useActionState(submitApplication, undefined);
  if (r?.ok) {
    return (
      <div className="card p-6" role="status">
        <p className="text-lg font-semibold text-green">✓ {es ? "¡Gracias! Recibimos su solicitud." : "Thank you! We received your application."}</p>
        <p className="mt-2 text-muted">{es ? "El personal de Real Care se comunicará con usted pronto." : "Real Care staff will contact you soon."}</p>
      </div>
    );
  }
  return (
    <form action={action} className="card space-y-4 p-6">
      <div className="flex justify-end">
        <div className="flex rounded-full border border-line p-0.5 text-sm" role="group" aria-label="Language">
          {(["en", "es"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 font-semibold ${lang === l ? "bg-teal text-white" : "text-muted"}`}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>
      <input type="hidden" name="locale" value={lang} />
      {/* Honeypot for bots: hidden from people and screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div><label className="label" htmlFor="ap-name">{es ? "Nombre completo" : "Full name"}</label><input id="ap-name" name="full_name" className="input" required autoComplete="name" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="ap-email">{es ? "Correo electrónico" : "Email"}</label><input id="ap-email" name="email" type="email" spellCheck={false} className="input" required autoComplete="email" /></div>
        <div><label className="label" htmlFor="ap-phone">{es ? "Teléfono" : "Phone"}</label><input id="ap-phone" name="phone" type="tel" className="input" autoComplete="tel" /></div>
      </div>
      <div><label className="label" htmlFor="ap-city">{es ? "Ciudad" : "City"}</label><input id="ap-city" name="city" className="input" autoComplete="address-level2" /></div>
      <fieldset>
        <legend className="label">{es ? "¿Qué le interesa?" : "What are you interested in?"}</legend>
        <div className="grid gap-2">
          {TYPES.map((t) => (
            <label key={t.v} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 has-[:checked]:border-teal has-[:checked]:bg-teal-soft">
              <input type="checkbox" name="types" value={t.v} /> {es ? t.es : t.en}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="ap-exp">{es ? "Cuéntenos sobre su experiencia (opcional)" : "Tell us about your experience (optional)"}</label>
        <textarea id="ap-exp" name="experience" rows={3} className="input" maxLength={1000} />
        <p className="mt-1 text-sm text-muted">{es ? "No incluya información médica ni de otras personas." : "Please don't include medical details or information about other people."}</p>
      </div>
      {r?.error && <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{r.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? (es ? "Enviando…" : "Sending…") : es ? "Enviar solicitud" : "Send application"}</button>
    </form>
  );
}
