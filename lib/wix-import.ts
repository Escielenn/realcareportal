// Turns a snapshot of the live Wix training site into rows for public.stage_wix_import.
// Pure functions only (no network, no logging) so the same code runs on the real pull and on the fictional sample.
// Rules (Jason, Nov 14, 2026): skip blocked members; "FCG" = Family Caregiver; "RCI Provider" is its own type;
// English and Spanish versions of a course count as the same course; Wix keeps the latest completion per course.
import { typesFromWords, isProviderType, type ProviderType } from "./provider-types";

// ---------- the parts of each Wix record we read (shapes from the Wix REST docs)
export type WixMember = {
  id: string;
  loginEmail?: string;
  status?: string; // APPROVED, PENDING, BLOCKED, OFFLINE...
  contactId?: string;
  createdDate?: string;
  contact?: { firstName?: string; lastName?: string; phones?: string[] };
  profile?: { nickname?: string };
};
export type WixContact = { id: string; info?: { labelKeys?: { items?: string[] } | string[] } };
export type WixLabel = { key: string; displayName: string };
export type WixProgram = { id: string; description?: { title?: string } };
export type WixParticipant = {
  memberId?: string;
  programId?: string;
  progressStatus?: string;
  lastActivityDate?: string;
  certificateInfo?: { issueDate?: string };
};
export type WixPlan = { id: string; name?: string };
export type WixOrder = { planId?: string; status?: string; startDate?: string; endDate?: string; buyer?: { memberId?: string } };

export type WixSnapshot = {
  members: WixMember[];
  contacts: WixContact[];
  labels: WixLabel[];
  programs: WixProgram[];
  participants: WixParticipant[];
  plans: WixPlan[];
  orders: WixOrder[];
};

export type StagedPerson = {
  wix_member_id: string;
  full_name: string;
  email: string;
  phone: string;
  locale: "en" | "es";
  provider_types: ProviderType[];
  joined_on: string | null;
  completions: { slug: string; lang: "en" | "es"; on: string }[];
  access: { kind: "real_care" | "all_access"; starts_on?: string; ends_on?: string } | null;
};

export type ImportSummary = {
  members: number;
  skipped_blocked: number;
  skipped_other_status: number;
  default_type_used: number;
  completions: number;
  unmatched_programs: string[];
  with_access: number;
};

// ---------- course titles on Wix -> portal course slugs
const TITLE_TO_SLUG: Record<string, string> = {
  "welcome to real care training!": "welcome",
  "system values & general principles": "system-values",
  "supported community connections (scc)": "scc",
  "supports & services": "supports-services",
  "respect & dignity": "respect-dignity",
  "person centered planning": "pcp",
  "person-centered planning (pcp)": "pcp",
  "person-centered planning": "pcp",
  mane: "mane",
  "individual rights": "individual-rights",
  "health & safety": "health-safety",
  "driving safety": "driving-safety",
  "diversity, equity, & inclusion": "dei",
  confidentiality: "confidentiality",
  communication: "communication",
  "emergent & crisis intervention": "crisis",
  qmap: "qmap",
  "respite care overview & provider responsibilities": "respite",
  "documentation submissions & compliance": "documentation",
  "injection administration training -- delegated medication administration": "injection-admin",
  "employee orientation": "employee-orientation",
};

/** "Health & Safety / Salud y seguridad (español)" -> { slug: "health-safety", lang: "es" } */
export function courseFromTitle(title: string | undefined): { slug: string; lang: "en" | "es" } | null {
  const raw = (title ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const spanish = /\(español\)/i.test(raw);
  let english = raw;
  if (spanish && raw.includes(" / ")) english = raw.split(" / ")[0];
  english = english.replace(/\(español\)/gi, "").replace(/\s+/g, " ").trim().toLowerCase();
  const slug = TITLE_TO_SLUG[english];
  return slug ? { slug, lang: spanish ? "es" : "en" } : null;
}

/** An ISO timestamp as a calendar date in Denver (Real Care's time zone). */
export function denverDate(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function labelKeys(c: WixContact | undefined): string[] {
  const lk = c?.info?.labelKeys;
  if (!lk) return [];
  return Array.isArray(lk) ? lk : lk.items ?? [];
}

function planKind(name: string | undefined): "real_care" | "all_access" | null {
  const n = (name ?? "").toLowerCase();
  if (n.includes("all-access") || n.includes("all access")) return "all_access";
  if (n.includes("real care providers")) return "real_care";
  return null;
}

export function buildPeople(snap: WixSnapshot, opts: { defaultType?: string } = {}): { people: StagedPerson[]; summary: ImportSummary } {
  const defaultType = opts.defaultType && isProviderType(opts.defaultType) ? opts.defaultType : null;
  const labelName = new Map(snap.labels.map((l) => [l.key, l.displayName]));
  const contactById = new Map(snap.contacts.map((c) => [c.id, c]));
  const programById = new Map(snap.programs.map((p) => [p.id, p]));
  const planById = new Map(snap.plans.map((p) => [p.id, p]));

  const unmatched = new Set<string>();
  const courseByProgram = new Map<string, { slug: string; lang: "en" | "es" }>();
  for (const p of snap.programs) {
    const c = courseFromTitle(p.description?.title);
    if (c) courseByProgram.set(p.id, c);
    else unmatched.add((p.description?.title ?? "(untitled)").trim());
  }

  // Latest completion per member per course (English and Spanish together).
  const done = new Map<string, Map<string, { slug: string; lang: "en" | "es"; on: string }>>();
  for (const part of snap.participants) {
    if (part.progressStatus !== "COMPLETED" || !part.memberId || !part.programId) continue;
    if (!programById.has(part.programId)) continue;
    const course = courseByProgram.get(part.programId);
    const on = denverDate(part.certificateInfo?.issueDate ?? part.lastActivityDate);
    if (!course || !on) continue;
    const mine = done.get(part.memberId) ?? new Map();
    const prev = mine.get(course.slug);
    if (!prev || prev.on < on) mine.set(course.slug, { slug: course.slug, lang: course.lang, on });
    done.set(part.memberId, mine);
  }

  // Current plan access: Real Care's free plan wins over a paid All-Access term.
  const access = new Map<string, StagedPerson["access"]>();
  for (const o of snap.orders) {
    const mid = o.buyer?.memberId;
    if (!mid || o.status !== "ACTIVE") continue;
    const kind = planKind(planById.get(o.planId ?? "")?.name);
    if (!kind) continue;
    const prev = access.get(mid);
    const next = { kind, starts_on: denverDate(o.startDate) ?? undefined, ends_on: kind === "real_care" ? undefined : denverDate(o.endDate) ?? undefined };
    if (!prev || (prev.kind !== "real_care" && (kind === "real_care" || (next.ends_on ?? "") > (prev.ends_on ?? "")))) access.set(mid, next);
  }

  const summary: ImportSummary = { members: 0, skipped_blocked: 0, skipped_other_status: 0, default_type_used: 0, completions: 0, unmatched_programs: [...unmatched].sort(), with_access: 0 };
  const people: StagedPerson[] = [];
  for (const m of snap.members) {
    const status = (m.status ?? "").toUpperCase();
    if (status === "BLOCKED") { summary.skipped_blocked++; continue; }
    if (status && status !== "APPROVED") { summary.skipped_other_status++; continue; }
    summary.members++;
    const labels = labelKeys(contactById.get(m.contactId ?? "")).map((k) => labelName.get(k) ?? k);
    let types = typesFromWords(labels);
    if (types.length === 0 && defaultType) { types = [defaultType]; summary.default_type_used++; }
    const completions = [...(done.get(m.id)?.values() ?? [])].sort((a, b) => a.slug.localeCompare(b.slug));
    const es = completions.filter((c) => c.lang === "es").length;
    const name = [m.contact?.firstName, m.contact?.lastName].filter(Boolean).join(" ").trim() || m.profile?.nickname?.trim() || "";
    const acc = access.get(m.id) ?? null;
    summary.completions += completions.length;
    if (acc) summary.with_access++;
    people.push({
      wix_member_id: m.id,
      full_name: name,
      email: (m.loginEmail ?? "").trim().toLowerCase(),
      phone: (m.contact?.phones?.[0] ?? "").trim(),
      locale: es > completions.length - es ? "es" : "en",
      provider_types: types,
      joined_on: denverDate(m.createdDate),
      completions,
      access: acc,
    });
  }
  return { people, summary };
}
