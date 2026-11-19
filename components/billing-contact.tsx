import { BILLING_EMAIL, BILLING_PHONE, hasBillingContact, telHref } from "@/lib/billing-contact";

// One line, shown wherever providers pay: "Billing questions? Call ... or email ...". Hidden until a contact is set.
export function BillingContact({ lang }: { lang: "en" | "es" }) {
  if (!hasBillingContact()) return null;
  const lead = lang === "es" ? "¿Preguntas sobre pagos?" : "Billing questions?";
  return (
    <p className="text-sm text-muted">
      {lead}{" "}
      {BILLING_PHONE && <>{lang === "es" ? "Llame al" : "Call"} <a className="font-semibold text-teal hover:underline" href={telHref(BILLING_PHONE)}>{BILLING_PHONE}</a></>}
      {BILLING_PHONE && BILLING_EMAIL && (lang === "es" ? " o escriba a " : " or email ")}
      {!BILLING_PHONE && BILLING_EMAIL && (lang === "es" ? "Escriba a " : "Email ")}
      {BILLING_EMAIL && <a className="font-semibold text-teal hover:underline" href={`mailto:${BILLING_EMAIL}`}>{BILLING_EMAIL}</a>}
      .
    </p>
  );
}
