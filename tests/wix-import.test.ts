// Unit tests for the Wix import mapping, on the fictional sample only.
// Run: npx tsx --test tests/wix-import.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPeople, courseFromTitle, denverDate } from "../lib/wix-import";
import { sampleWixSnapshot } from "../lib/wix-sample";
import { typesFromWords } from "../lib/provider-types";

test("course titles map to portal courses, Spanish versions included", () => {
  assert.deepEqual(courseFromTitle("Health & Safety / Salud y seguridad (español)\n"), { slug: "health-safety", lang: "es" });
  assert.deepEqual(courseFromTitle("Emergent & Crisis Intervention (español) / Intervención en emergencias y crisis"), { slug: "crisis", lang: "es" });
  assert.deepEqual(courseFromTitle("MANE (español)"), { slug: "mane", lang: "es" });
  assert.deepEqual(courseFromTitle("Person-Centered Planning (PCP) / Planificación centrada en la persona (español)"), { slug: "pcp", lang: "es" });
  assert.deepEqual(courseFromTitle("Person Centered Planning"), { slug: "pcp", lang: "en" });
  assert.deepEqual(courseFromTitle("Confidentiality\n"), { slug: "confidentiality", lang: "en" });
  assert.deepEqual(courseFromTitle("Injection Administration Training -- Delegated Medication Administration"), { slug: "injection-admin", lang: "en" });
  assert.equal(courseFromTitle("Old practice course (draft)"), null);
});

test("Wix labels map to provider types (FCG = Family Caregiver, RCI Provider is its own type)", () => {
  assert.deepEqual(typesFromWords(["FCG"]), ["family_caregiver"]);
  assert.deepEqual(typesFromWords(["Family Caregiver", "FCG"]), ["family_caregiver"]);
  assert.deepEqual(typesFromWords(["RCI Provider"]), ["rci_provider"]);
  assert.deepEqual(typesFromWords(["Import 6 16 2025", "Wix Contacts .csv"]), []);
});

test("dates are Denver calendar days", () => {
  assert.equal(denverDate("2025-06-17T03:40:57.714Z"), "2025-06-16");
  assert.equal(denverDate("not a date"), null);
});

test("sample snapshot: blocked member skipped, types, history, access", () => {
  const { people, summary } = buildPeople(sampleWixSnapshot(), { defaultType: "family_caregiver" });
  const by = new Map(people.map((p) => [p.wix_member_id, p]));

  assert.equal(summary.skipped_blocked, 1);
  assert.ok(!by.has("s-06"), "blocked member must not be staged");
  assert.equal(people.length, 7);
  assert.equal(summary.default_type_used, 1);
  assert.deepEqual(summary.unmatched_programs, ["Old practice course (draft)"]);

  assert.deepEqual(by.get("s-01")!.provider_types, ["family_caregiver"]);
  assert.deepEqual(by.get("s-02")!.provider_types, ["rci_provider"]);
  assert.deepEqual(by.get("s-04")!.provider_types, ["family_caregiver"], "no label gets the default type");

  assert.equal(by.get("s-01")!.completions.length, 14);
  assert.ok(by.get("s-01")!.completions.every((c) => c.on === "2025-06-17"));

  // Lucía did the Spanish versions, then retook Welcome in English: one record per course, latest wins.
  const lucia = by.get("s-05")!;
  assert.equal(lucia.completions.length, 14);
  assert.equal(lucia.locale, "es");
  assert.equal(lucia.completions.find((c) => c.slug === "welcome")!.lang, "en");

  // In-progress and unknown courses don't count.
  const priya = by.get("s-08")!;
  assert.equal(priya.completions.length, 14);
  assert.ok(!priya.completions.some((c) => c.slug === "qmap"));

  // Real Care's free plan wins over a paid term; paid terms keep their end date.
  assert.equal(by.get("s-01")!.access?.kind, "real_care");
  assert.equal(priya.access?.kind, "real_care");
  assert.equal(by.get("s-03")!.access?.kind, "all_access");
  assert.match(by.get("s-03")!.access?.ends_on ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(by.get("s-07")!.access, null);
  assert.equal(by.get("s-07")!.completions.length, 0);
});

test("without a default type, unlabeled people stay unassigned for staff to fix", () => {
  const { people, summary } = buildPeople(sampleWixSnapshot());
  assert.equal(summary.default_type_used, 0);
  assert.deepEqual(people.find((p) => p.wix_member_id === "s-04")!.provider_types, []);
});
