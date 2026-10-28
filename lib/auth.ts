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
  return { supabase, profile };
}
