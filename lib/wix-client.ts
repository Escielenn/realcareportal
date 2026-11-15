import "server-only";
import type { WixSnapshot, WixMember, WixContact, WixLabel, WixProgram, WixParticipant, WixPlan, WixOrder } from "./wix-import";

// Reads the live Wix training site with a Wix API key (Wix dashboard > Settings > API Keys: read access to
// Members, Contacts, Online Programs and Pricing Plans). Server only. Nothing fetched here is logged or cached;
// errors carry the step and HTTP status only, never response bodies.
const BASE = "https://www.wixapis.com";
const TIMEOUT_MS = 20000;

export function wixConfigured() {
  return Boolean(process.env.WIX_API_KEY && process.env.WIX_SITE_ID);
}

async function call<T>(step: string, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: process.env.WIX_API_KEY!, "wix-site-id": process.env.WIX_SITE_ID!, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Wix ${step} failed (HTTP ${res.status}). Check the API key's permissions and the site ID.`);
  return (await res.json()) as T;
}

// Offset paging until a short page comes back. Hard cap so a bad response can't loop forever.
async function pages<T>(fetchPage: (offset: number) => Promise<T[]>, size: number, cap = 200): Promise<T[]> {
  const all: T[] = [];
  for (let i = 0, offset = 0; i < cap; i++, offset += size) {
    const batch = await fetchPage(offset);
    all.push(...batch);
    if (batch.length < size) break;
  }
  return all;
}

export async function fetchWixSnapshot(): Promise<WixSnapshot> {
  if (!wixConfigured()) throw new Error("Wix isn't connected. Add WIX_API_KEY and WIX_SITE_ID to the server settings.");

  const members = await pages<WixMember>(async (offset) =>
    (await call<{ members?: WixMember[] }>("members", "POST", "/members/v1/members/query",
      { fieldsets: ["FULL"], query: { paging: { limit: 100, offset } } })).members ?? [], 100);

  const contacts = await pages<WixContact>(async (offset) =>
    (await call<{ contacts?: WixContact[] }>("contacts", "POST", "/contacts/v4/contacts/query",
      { query: { paging: { limit: 100, offset } } })).contacts ?? [], 100);

  const labels = await pages<WixLabel>(async (offset) =>
    (await call<{ labels?: WixLabel[] }>("labels", "GET", `/contacts/v4/labels?paging.limit=100&paging.offset=${offset}`)).labels ?? [], 100, 20);

  const programs = await pages<WixProgram>(async (offset) =>
    (await call<{ programs?: WixProgram[] }>("programs", "POST", "/online-programs/v3/programs/query",
      { query: { paging: { limit: 100, offset } } })).programs ?? [], 100, 10);

  const participants = await pages<WixParticipant>(async (offset) =>
    (await call<{ participants?: WixParticipant[] }>("course completions", "POST", "/online-programs/v3/participants/query",
      { query: { filter: { progressStatus: { $eq: "COMPLETED" } }, paging: { limit: 100, offset } } })).participants ?? [], 100);

  const plans = await pages<WixPlan>(async (offset) =>
    (await call<{ plans?: WixPlan[] }>("plans", "POST", "/pricing-plans/v3/plans/query",
      { query: { paging: { limit: 100, offset } } })).plans ?? [], 100, 5);

  const orders = await pages<WixOrder>(async (offset) =>
    (await call<{ orders?: WixOrder[] }>("plan orders", "GET", `/pricing-plans/v2/orders?limit=50&offset=${offset}&orderStatuses=ACTIVE`)).orders ?? [], 50);

  return { members, contacts, labels, programs, participants, plans, orders };
}
