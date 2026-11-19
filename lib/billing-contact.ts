// Where providers should call or write about billing and payments.
// Real Care asked (Nov 16, 2026) that billing questions reach a Real Care business contact, never a staff member's personal phone.
// Fill in the two values below once Real Care confirms them (or set NEXT_PUBLIC_BILLING_PHONE / NEXT_PUBLIC_BILLING_EMAIL in Vercel).
// While both are empty, the portal shows no billing contact line at all.
export const BILLING_PHONE = process.env.NEXT_PUBLIC_BILLING_PHONE || "";
export const BILLING_EMAIL = process.env.NEXT_PUBLIC_BILLING_EMAIL || "";

export const hasBillingContact = () => Boolean(BILLING_PHONE || BILLING_EMAIL);
export const telHref = (phone: string) => `tel:${phone.replace(/[^0-9+]/g, "")}`;
