// End-to-end smoke test against a deployed portal (fictional demo data only).
// Usage: BASE_URL=https://realcareportal.vercel.app node tests/smoke.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://realcareportal.vercel.app";
const results = [];
const browser = await chromium.launch();

async function session(label, email) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.goto(BASE + "/login");
  await page.fill("#email", email);
  await page.fill("#password", "RealCare-Demo-2026");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.click("button[type=submit]")]);
  return { ctx, page, errors, label };
}

async function visit(s, path, expectText) {
  s.errors.length = 0;
  let status = 0;
  try {
    const res = await s.page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 });
    status = res?.status() ?? 0;
  } catch (e) { s.errors.push("nav: " + e.message); }
  const body = (await s.page.innerText("body").catch(() => "")) || "";
  const crashed = /Application error|could not be found|Internal Server Error|This page couldn.t load/i.test(body);
  const missing = expectText && !body.includes(expectText) ? `missing "${expectText}"` : "";
  const ok = status < 400 && !crashed && !missing && s.errors.filter((e) => !/favicon|Failed to load resource.*404/.test(e)).length === 0;
  results.push({ who: s.label, path, status, ok, note: [crashed ? "CRASH" : "", missing, ...s.errors].filter(Boolean).join(" | ").slice(0, 300) });
  return body;
}

async function step(s, name, fn) {
  s.errors.length = 0;
  try { await fn(); results.push({ who: s.label, path: "FLOW " + name, status: 200, ok: s.errors.length === 0, note: s.errors.join(" | ").slice(0, 300) }); }
  catch (e) {
    results.push({ who: s.label, path: "FLOW " + name, status: 0, ok: false, note: e.message.replace(/\s+/g, " ").slice(0, 900) });
    if (process.env.SHOTS) await s.page.screenshot({ path: `${process.env.SHOTS}/fail-${name.replace(/[^a-z0-9]+/gi, "-")}.png` }).catch(() => {});
  }
}

// ---------------- provider
const p = await session("provider", "demo.provider@example.com");
for (const [path, text] of [
  ["/dashboard", "Hello, Maria"], ["/training", "My training"], ["/training/confidentiality", "Confidentiality"],
  ["/training/qmap", "This course needs to be purchased"], ["/training/welcome", "A quick tour"], ["/forms", "Returned for a correction"],
  ["/messages", "Messages"], ["/notifications", "Notifications"], ["/profile", "My profile"],
  ["/documents", "Send a document"],
  ["/training/documentation", "Documentation Submissions"], ["/training/injection-admin", "RCI Injection Administration"],
]) await visit(p, path, text);

await step(p, "course video plays from portal storage", async () => {
  await p.page.goto(BASE + "/training/documentation");
  await p.page.click("a:has-text('Watch the training')");
  const v = await p.page.waitForSelector("video", { timeout: 15000 });
  // Playwright's Chromium has no H.264 decoder, so check the signed stream answers instead of playing it.
  const ok = await v.evaluate(async (el) => { const r = await fetch(el.currentSrc || el.src, { headers: { Range: "bytes=0-1023" } }); return r.status === 206 && /video\/mp4/.test(r.headers.get("content-type") || ""); });
  if (!ok) throw new Error("signed video URL did not stream");
  await p.page.click("summary:has-text('Read the transcript')");
  await p.page.waitForSelector("text=Welcome to Real Care", { timeout: 5000 });
});
if (process.env.SHOTS) {
  const dir = process.env.SHOTS;
  for (const [path, name] of [["/dashboard", "dashboard"], ["/training", "training"], ["/training/documentation", "course"]]) {
    await p.page.goto(BASE + path, { waitUntil: "networkidle" });
    await p.page.screenshot({ path: `${dir}/${name}.png`, fullPage: false });
  }
  await p.page.setViewportSize({ width: 390, height: 844 });
  await p.page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
  await p.page.screenshot({ path: `${dir}/dashboard-phone.png` });
  await p.page.setViewportSize({ width: 1280, height: 900 });
}

await step(p, "open video lesson", async () => {
  await p.page.goto(BASE + "/training/welcome");
  await p.page.click("text=A quick tour of your portal");
  await p.page.waitForSelector("video", { timeout: 15000 });
});
await step(p, "returned form shows flags", async () => {
  await p.page.goto(BASE + "/forms");
  await p.page.click("text=Returned >> xpath=ancestor::a[1]").catch(async () => { await p.page.locator("a", { hasText: "RCI Log Notes" }).first().click(); });
  await p.page.waitForSelector("text=Please fix", { timeout: 15000 });
});
await step(p, "confidentiality course end to end", async () => {
  await p.page.goto(BASE + "/training/confidentiality");
  await p.page.click("a:has-text('Start')");
  for (let i = 0; i < 2; i++) {
    await p.page.waitForSelector("button:has-text(\"I've read this\")", { timeout: 15000 });
    await Promise.all([p.page.waitForURL(/\/training\/confidentiality\//), p.page.click("button:has-text(\"I've read this\")")]);
    await p.page.waitForLoadState("networkidle");
  }
  const answers = [0, 1, 1];
  const fieldsets = p.page.locator("fieldset");
  for (let q = 0; q < answers.length; q++) await fieldsets.nth(q).locator("input[type=radio]").nth(answers[q]).check();
  await p.page.click("button:has-text('Submit answers')");
  await p.page.waitForSelector("text=Course complete", { timeout: 15000 });
});
await step(p, "certificate", async () => {
  await p.page.goto(BASE + "/training/confidentiality");
  await p.page.click("text=View certificate");
  await p.page.waitForSelector("text=Certificate of Completion", { timeout: 15000 });
});
await step(p, "demo checkout unlocks QMAP", async () => {
  await p.page.goto(BASE + "/training/qmap");
  await p.page.click("button:has-text('Buy this course')");
  await p.page.waitForSelector("a:has-text('Start')", { timeout: 15000 });
});
await step(p, "switch to Spanish", async () => {
  await p.page.goto(BASE + "/dashboard");
  await p.page.click("button[aria-pressed=false]:has-text('ES')");
  await p.page.waitForSelector("text=Hola, Maria", { timeout: 15000 });
  await p.page.click("button[aria-pressed=false]:has-text('EN')");
  await p.page.waitForSelector("text=Hello, Maria", { timeout: 15000 });
});
await p.ctx.close();

// ---------------- spanish provider
const l = await session("proveedor", "demo.proveedor@example.com");
await visit(l, "/dashboard", "Hola, Luis");
await visit(l, "/training", "Mi capacitación");
await l.ctx.close();

// ---------------- staff
const s = await session("staff", "demo.staff@example.com");
for (const [path, text] of [
  ["/admin", "Annual training renewal"], ["/admin/providers", "Providers & training"], ["/admin/providers?status=overdue", "Overdue"],
  ["/admin/review", "Review queue"], ["/admin/review?show=all", "All submissions"], ["/admin/transcripts", "Transcripts"],
  ["/admin/transcripts?type=host_home&from=2026-01-01&to=2026-12-31", "Reporting period"], ["/admin/messages", "Messages"],
  ["/admin/courses", "Courses"], ["/admin/requirements", "Training requirements"], ["/admin/payments", "Payments"],
  ["/admin/invites", "Invite providers"], ["/admin/documents", "Documents"], ["/admin/forms", "Form library"],
  ["/admin/individuals", "People supported"], ["/admin/applications", "Jamie Fontaine"], ["/admin/notifications", "Alerts"], ["/admin/import", "Import training history"], ["/admin/outbox", "Email outbox"], ["/admin/audit", "Audit log"],
]) await visit(s, path, text);

if (process.env.SHOTS) {
  await s.page.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await s.page.screenshot({ path: `${process.env.SHOTS}/admin.png` });
}
await step(s, "form editor + QR", async () => {
  await s.page.goto(BASE + "/admin/forms");
  await s.page.click("a:has-text('Incident Report')");
  await s.page.waitForSelector("text=QR code", { timeout: 15000 });
  await s.page.waitForSelector("text=Live preview", { timeout: 15000 });
});
await step(s, "assign a form", async () => {
  await s.page.goto(BASE + "/admin/forms");
  await s.page.selectOption("#af-t", { label: "Fire Disaster Drill" });
  await s.page.locator("input[name=providers]").first().check();
  await s.page.click("button:has-text('Assign to')");
  await s.page.waitForSelector("text=Assigned to 1 provider", { timeout: 15000 });
});
await step(s, "provider detail", async () => {
  await s.page.goto(BASE + "/admin/providers");
  await s.page.click("a:has-text('Maria Delgado')");
  await s.page.waitForSelector("text=Training by cycle", { timeout: 15000 });
  await s.page.waitForSelector("text=Record training done elsewhere");
});
await step(s, "review detail", async () => {
  await s.page.goto(BASE + "/admin/review");
  await s.page.locator("a[href^='/admin/review/']").first().click();
  await s.page.waitForSelector("text=History", { timeout: 15000 });
});
await step(s, "course + lesson editors", async () => {
  await s.page.goto(BASE + "/admin/courses");
  await s.page.click("a:has-text('Confidentiality')");
  await s.page.waitForSelector("text=Course details", { timeout: 15000 });
  await s.page.locator("a[href*='/lessons/']").last().click();
  await s.page.waitForSelector("text=Questions", { timeout: 15000 });
});
await step(s, "bulk reminder", async () => {
  await s.page.goto(BASE + "/admin/providers?status=overdue");
  await s.page.locator("tbody input[type=checkbox]").first().check();
  await s.page.click("button:has-text('Send reminder')");
  await s.page.waitForSelector("text=Sent 1 reminder", { timeout: 15000 });
});
await step(s, "wix import", async () => {
  await s.page.goto(BASE + "/admin/import");
  const csv = (await import("node:fs")).readFileSync(new URL("../public/samples/wix-communication-participants.csv", import.meta.url));
  await s.page.selectOption("#imp-course", { label: "Communication" });
  await s.page.setInputFiles("#imp-file", { name: "wix-communication-participants.csv", mimeType: "text/csv", buffer: csv });
  await s.page.click("button:has-text('Match rows to providers')");
  await s.page.waitForURL(/\/admin\/import\/[0-9a-f-]{36}/, { timeout: 20000 });
  await s.page.waitForSelector("text=Ready: 5", { timeout: 15000 });
});
await step(s, "create invite", async () => {
  await s.page.goto(BASE + "/admin/invites");
  await s.page.fill("#inv-name", "Smoke Test Person");
  await s.page.fill("#inv-email", "smoke.test@example.com");
  await s.page.check("input[name=types][value=nmt]");
  await s.page.click("button:has-text('Create invitation')");
  await s.page.waitForSelector("text=Invitation link", { timeout: 15000 });
});
await s.ctx.close();

// ---------------- invite page (signed out)
const anon = await browser.newContext();
const ap = await anon.newPage();
await ap.goto(BASE + "/join/83265b49-d84b-53ff-9e13-45fd3e167c5b");
const jt = await ap.innerText("body");
results.push({ who: "anon", path: "/join/<riley>", status: 200, ok: /Activate my account/.test(jt), note: /Activate my account/.test(jt) ? "" : jt.slice(0, 200) });
const ap2 = await anon.newPage();
await ap2.goto(BASE + "/apply");
const at = await ap2.innerText("body");
results.push({ who: "anon", path: "/apply", status: 200, ok: /Become a provider/.test(at), note: /Become a provider/.test(at) ? "" : at.slice(0, 200) });
await anon.close();

await browser.close();
const bad = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.who.padEnd(9)} ${r.path}${r.note ? "  -> " + r.note : ""}`);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
if (process.env.GITHUB_ACTIONS) {
  const enc = (t) => t.replace(/%/g, "%25").replace(/\r/g, "").replace(/\n/g, "%0A");
  const lines = results.map((r) => `${r.ok ? "PASS" : "FAIL"} ${r.who} ${r.path}${r.note ? " -> " + r.note : ""}`).join("\n");
  console.log(`::notice title=Smoke ${results.length - bad.length}/${results.length} passed::${enc(lines)}`);
}
process.exit(bad.length ? 1 : 0);
