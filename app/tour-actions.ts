"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_MODE } from "@/lib/config";
import { demoLogin } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import { TOURS, type TourRole } from "@/lib/tour";

// Demo only: signs in as the fictional provider or staff account and starts the guided tour.
// Off entirely when DEMO_MODE is false, so it can never sign anyone into a real account.
const ACCOUNT: Record<TourRole, string> = { provider: "demo.provider@example.com", staff: "demo.staff@example.com" };

export async function startTour(role: TourRole): Promise<{ error?: string }> {
  if (!DEMO_MODE) return { error: "Tours are only available on the demo site." };
  if (role !== "provider" && role !== "staff") return { error: "Unknown tour" };
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email: ACCOUNT[role], password: demoLogin.password });
  if (error) return { error: "The demo account couldn't sign in. Try again in a moment." };
  // Second guard, in the database: the project must have demo mode on and the account must be fictional.
  const { data: settings } = await supabase.from("app_settings").select("demo_mode").eq("id", 1).maybeSingle();
  if (!settings?.demo_mode || !ACCOUNT[role].endsWith("@example.com")) {
    await supabase.auth.signOut();
    return { error: "Tours are only available on the demo site." };
  }
  const c = await cookies();
  c.set("rc_lang", "en", { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  // Tour position only (no personal data). Readable by the page so the guide can move step to step.
  c.set("rc_tour", `${role}.0`, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 2, httpOnly: false });
  redirect(TOURS[role].steps[0].path);
}
