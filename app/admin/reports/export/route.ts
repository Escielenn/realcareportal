import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildReports, toCsv } from "@/lib/reports";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["training", "courses", "overdue_training", "forms", "overdue_forms"] as const;

// CSV downloads for staff. RLS limits what the session can read; the role check stops providers;
// every export is written to the audit log with the report kind (never the contents).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as (typeof KINDS)[number];
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const type = url.searchParams.get("type") ?? "";
  if (!KINDS.includes(kind) || !DATE.test(from) || !DATE.test(to)) return new NextResponse("Bad request", { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sign in", { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!me || !me.active || me.role === "provider") return new NextResponse("Forbidden", { status: 403 });
  const r = await buildReports(supabase, { from, to, type: ["host_home", "family_caregiver", "scc_dsp", "nmt"].includes(type) ? type : "" });
  const rows = { training: r.byType, courses: r.courseRows, overdue_training: r.overdueTraining, forms: r.formRows, overdue_forms: r.overdueRows }[kind] as Record<string, unknown>[];
  await supabase.rpc("log_event", { p_action: "export_report", p_table: "reports", p_record: `${kind}:${from}:${to}` });
  return new NextResponse("﻿" + toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="real-care-${kind}-${from}-to-${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
