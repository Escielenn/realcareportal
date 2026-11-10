import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  role: "provider" | "staff" | "admin";
  full_name: string;
  email: string;
  locale: "en" | "es";
  provider_types: string[];
  hire_date: string | null;
  active: boolean;
  staff_level?: StaffLevel | null;
  login_enabled?: boolean;
};

// Staff permission levels (the database enforces the same rules through staff_can()).
export type StaffLevel = "reviewer" | "training_admin" | "super_admin";
const RANK: Record<StaffLevel, number> = { reviewer: 1, training_admin: 2, super_admin: 3 };
export function staffLevel(p: Pick<Profile, "role" | "staff_level">): StaffLevel {
  return p.staff_level ?? (p.role === "admin" ? "super_admin" : "reviewer");
}
export function staffCan(p: Pick<Profile, "role" | "staff_level">, need: StaffLevel) {
  return p.role !== "provider" && RANK[staffLevel(p)] >= RANK[need];
}
export const STAFF_LEVEL_LABEL: Record<StaffLevel, string> = { reviewer: "Reviewer", training_admin: "Training admin", super_admin: "Full admin" };

// Phase switch: client features (people supported, forms, documents) stay hidden until the HIPAA step.
export async function clientFeaturesOn(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("app_settings").select("client_features").eq("id", 1).maybeSingle();
  return !!data?.client_features;
}

export async function getProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, profile: null as Profile | null };
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return { supabase, profile: data as Profile | null };
}

export async function requireProvider() {
  const { supabase, profile } = await getProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role !== "provider") redirect("/admin");
  return { supabase, profile };
}

export async function requireStaff(need: StaffLevel = "reviewer") {
  const { supabase, profile } = await getProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role === "provider") redirect("/dashboard");
  // Second factor: anyone with an authenticator must use it; when the setting requires MFA, staff must set one up.
  // The database enforces the same rule (is_staff() needs aal2), so skipping this page check gains nothing.
  const { data: mfa } = await supabase.rpc("my_mfa_status");
  const m = mfa as { required: boolean; aal: string; verified_factors: number } | null;
  if (m && m.verified_factors > 0 && m.aal !== "aal2") redirect("/mfa");
  if (m && m.required && m.verified_factors === 0) redirect("/staff-security");
  if (!staffCan(profile, need)) redirect("/admin?denied=1");
  return { supabase, profile };
}

// Pages for client features: 404 while the switch is off.
export async function requireClientFeatures() {
  const supabase = await createClient();
  if (!(await clientFeaturesOn(supabase))) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
}

// Staff pages that must work before MFA is complete (setting up or entering a code).
export async function requireStaffAccount() {
  const { supabase, profile } = await getProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role === "provider") redirect("/dashboard");
  return { supabase, profile };
}
