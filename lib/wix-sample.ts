// FICTIONAL Wix snapshot for the demo site. Same shape as a real pull; every person is made up (@example.com).
// Covers the cases the import must handle: FCG and RCI Provider labels, a blocked member, no label, Spanish
// courses, someone overdue (finished June 2025), someone current, someone with nothing done, and both plans.
import type { WixSnapshot, WixParticipant } from "./wix-import";

const CORE_EN = [
  "Welcome to Real Care Training!", "System Values & General Principles", "Supported Community Connections (SCC)", "Supports & Services",
  "Respect & Dignity", "Person Centered Planning", "MANE", "Individual Rights", "Health & Safety", "Driving Safety",
  "Diversity, Equity, & Inclusion", "Confidentiality", "Communication", "Emergent & Crisis Intervention",
];
const CORE_ES = [
  "Welcome to Real Care Training! / ¡Bienvenido a Real Care Training! (español)", "System Values & General Principles / Valores del sistema y principios generales (español)",
  "Supported Community Connections (SCC) / Conexiones comunitarias con apoyo (SCC) (español)", "Supports & Services / Asistencia y servicios (español)",
  "Respect & Dignity / Respeto y dignidad (español)", "Person-Centered Planning (PCP) / Planificación centrada en la persona (español)", "MANE (español)",
  "Individual Rights / Derechos individuales (español)", "Health & Safety / Salud y seguridad (español)", "Driving Safety / Seguridad vial (español)",
  "Diversity, Equity, & Inclusion / Diversidad, equidad e inclusión (español)", "Confidentiality / Confidencialidad (español)",
  "Communication / Comunicación (español)", "Emergent & Crisis Intervention (español) / Intervención en emergencias y crisis",
];
const EXTRA = ["QMAP", "Respite Care Overview & Provider Responsibilities", "Documentation Submissions & Compliance", "Old practice course (draft)"];

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const pid = (i: number) => `sample-program-${String(i).padStart(2, "0")}`;

export function sampleWixSnapshot(): WixSnapshot {
  const titles = [...CORE_EN, ...CORE_ES, ...EXTRA];
  const programs = titles.map((t, i) => ({ id: pid(i), description: { title: t } }));
  const en = (i: number) => pid(i);
  const es = (i: number) => pid(CORE_EN.length + i);
  const extra = (title: string) => pid(titles.indexOf(title));

  const people: { id: string; first: string; last: string; email: string; labels: string[]; status?: string; joinedDaysAgo: number }[] = [
    { id: "s-01", first: "Rosa", last: "Example", email: "rosa.example@example.com", labels: ["fcg"], joinedDaysAgo: 540 },
    { id: "s-02", first: "Theo", last: "Sample", email: "theo.sample@example.com", labels: ["rci"], joinedDaysAgo: 400 },
    { id: "s-03", first: "Mina", last: "Placeholder", email: "mina.placeholder@example.com", labels: ["fc"], joinedDaysAgo: 120 },
    { id: "s-04", first: "Jonas", last: "Fakename", email: "jonas.fakename@example.com", labels: [], joinedDaysAgo: 600 },
    { id: "s-05", first: "Lucía", last: "Ejemplo", email: "lucia.ejemplo@example.com", labels: ["fcg"], joinedDaysAgo: 300 },
    { id: "s-06", first: "Blocked", last: "Person", email: "blocked.person@example.com", labels: ["fcg"], status: "BLOCKED", joinedDaysAgo: 500 },
    { id: "s-07", first: "Nate", last: "Newcomer", email: "nate.newcomer@example.com", labels: ["rci"], joinedDaysAgo: 20 },
    { id: "s-08", first: "Priya", last: "Testcase", email: "priya.testcase@example.com", labels: ["fcg", "import"], joinedDaysAgo: 420 },
  ];
  const labels = [
    { key: "fcg", displayName: "FCG" }, { key: "fc", displayName: "Family Caregiver" },
    { key: "rci", displayName: "RCI Provider" }, { key: "import", displayName: "Import 6 16 2025" },
  ];
  const contacts = people.map((p) => ({ id: `c-${p.id}`, info: { labelKeys: { items: p.labels } } }));
  const members = people.map((p) => ({
    id: p.id, loginEmail: p.email, status: p.status ?? "APPROVED", contactId: `c-${p.id}`, createdDate: daysAgo(p.joinedDaysAgo),
    contact: { firstName: p.first, lastName: p.last, phones: ["303-555-01" + p.id.slice(-2)] },
  }));

  const done = (memberId: string, programId: string, when: string): WixParticipant => ({
    memberId, programId, progressStatus: "COMPLETED", lastActivityDate: when, certificateInfo: { issueDate: when },
  });
  const june2025 = "2025-06-17T18:00:00.000Z";
  const participants: WixParticipant[] = [
    // Rosa: every core course in June 2025, then nothing. Overdue now (due June 2026).
    ...CORE_EN.map((_, i) => done("s-01", en(i), june2025)),
    // Theo: every core course last month. Current.
    ...CORE_EN.map((_, i) => done("s-02", en(i), daysAgo(35))),
    // Mina: half done this year, plus QMAP.
    ...CORE_EN.slice(0, 7).map((_, i) => done("s-03", en(i), daysAgo(60))),
    done("s-03", extra("QMAP"), daysAgo(50)),
    // Jonas: no label; everything done early this year, plus Respite.
    ...CORE_EN.map((_, i) => done("s-04", en(i), daysAgo(200))),
    done("s-04", extra("Respite Care Overview & Provider Responsibilities"), daysAgo(190)),
    // Lucía: the Spanish versions, with one English course retaken later.
    ...CORE_ES.map((_, i) => done("s-05", es(i), daysAgo(150))),
    done("s-05", en(0), daysAgo(20)),
    // Blocked member's history (must not come over).
    ...CORE_EN.map((_, i) => done("s-06", en(i), june2025)),
    // Priya: all core in two sittings; an in-progress record and a draft course that doesn't exist in the portal.
    ...CORE_EN.slice(0, 10).map((_, i) => done("s-08", en(i), daysAgo(330))),
    ...CORE_EN.slice(10).map((_, i) => done("s-08", en(10 + i), daysAgo(100))),
    { memberId: "s-08", programId: extra("QMAP"), progressStatus: "IN_PROGRESS", lastActivityDate: daysAgo(5) },
    done("s-08", extra("Old practice course (draft)"), daysAgo(90)),
  ];

  const plans = [{ id: "plan-all-access", name: "All-Access Package" }, { id: "plan-real-care", name: "Real Care Providers & Caregivers" }];
  const orders = [
    { planId: "plan-real-care", status: "ACTIVE", startDate: daysAgo(500), buyer: { memberId: "s-01" } },
    { planId: "plan-real-care", status: "ACTIVE", startDate: daysAgo(390), buyer: { memberId: "s-02" } },
    { planId: "plan-all-access", status: "ACTIVE", startDate: daysAgo(60), endDate: new Date(Date.now() + 305 * 86400000).toISOString(), buyer: { memberId: "s-03" } },
    { planId: "plan-real-care", status: "ACTIVE", startDate: daysAgo(280), buyer: { memberId: "s-05" } },
    { planId: "plan-all-access", status: "ACTIVE", startDate: daysAgo(330), endDate: new Date(Date.now() + 35 * 86400000).toISOString(), buyer: { memberId: "s-08" } },
    { planId: "plan-real-care", status: "ACTIVE", startDate: daysAgo(330), buyer: { memberId: "s-08" } },
  ];
  return { members, contacts, labels, programs, participants, plans, orders };
}
