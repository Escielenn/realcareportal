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
};

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

export async function requireStaff() {
  const { supabase, profile } = await getProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role === "provider") redirect("/dashboard");
  // Second factor: anyone with an authenticator must use it; when the setting requires MFA, staff must set one up.
  // The database enforces the same rule (is_staff() needs aal2), so skipping this page check gains nothing.
  const { data: mfa } = await supabase.rpc("my_mfa_status");
  const m = mfa as { required: boolean; aal: string; verified_factors: number } | null;
  if (m && m.verified_factors > 0 && m.aal !== "aal2") redirect("/mfa");
  if (m && m.required && m.verified_factors === 0) redirect("/staff-security");
  return { supabase, profile };
}

// Staff pages that must work before MFA is complete (setting up or entering a code).
export async function requireStaffAccount() {
  const { supabase, profile } = await getProfile();
  if (!profile || !profile.active) redirect("/login");
  if (profile.role === "provider") redirect("/dashboard");
  return { supabase, profile };
}
