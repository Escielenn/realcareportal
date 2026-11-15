"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, staffCan } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { buildPeople } from "@/lib/wix-import";
import { sampleWixSnapshot } from "@/lib/wix-sample";
import { fetchWixSnapshot } from "@/lib/wix-client";
import { cleanProviderTypes, isProviderType } from "@/lib/provider-types";

// One-step import from the live Wix training site. Super admins only; the database checks the level again,
// refuses real Wix data on the demo site and refuses the fictional sample anywhere else.
// Nothing here logs people's details: errors are generic and summaries are counts only.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type R = { ok?: boolean; error?: string; message?: string };

async function superAdmin() {
  const { supabase, profile } = await getProfile();
  return { supabase, denied: !profile || !profile.active || !staffCan(profile, "super_admin") ? "Only a super admin can import from Wix." : null };
}

export async function pullFromWix(_p: R | undefined, fd: FormData): Promise<R> {
  const { supabase, denied } = await superAdmin();
  if (denied) return { error: denied };
  const defaultType = String(fd.get("default_type") ?? "");
  let snapshot;
  try {
    snapshot = DEMO_MODE ? sampleWixSnapshot() : await fetchWixSnapshot();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't reach Wix." };
  }
  const { people, summary } = buildPeople(snapshot, { defaultType: isProviderType(defaultType) ? defaultType : undefined });
  const { error } = await supabase.rpc("stage_wix_import", {
    p_source: DEMO_MODE ? "sample" : "wix",
    p_people: people,
    p_summary: { ...summary, default_type: isProviderType(defaultType) ? defaultType : null, pulled_at: new Date().toISOString() },
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/import/wix");
  redirect("/admin/import/wix");
}

export async function setImportTypes(_p: R | undefined, fd: FormData): Promise<R> {
  const { supabase, denied } = await superAdmin();
  if (denied) return { error: denied };
  const id = String(fd.get("person_id") ?? "");
  if (!UUID.test(id)) return { error: "Unknown person." };
  const types = cleanProviderTypes(fd.getAll("types").map(String));
  if (types.length === 0) return { error: "Choose at least one provider type." };
  const { error } = await supabase.rpc("set_wix_import_types", { p_person: id, p_types: types });
  if (error) return { error: error.message };
  revalidatePath("/admin/import/wix");
  return { ok: true, message: "Saved" };
}

export async function commitWixImport(_p: R | undefined, fd: FormData): Promise<R> {
  const { supabase, denied } = await superAdmin();
  if (denied) return { error: denied };
  const run = String(fd.get("run_id") ?? "");
  if (!UUID.test(run)) return { error: "Unknown import." };
  const { data, error } = await supabase.rpc("commit_wix_import", { p_run: run });
  if (error) return { error: error.message };
  const r = data as { people: number; completions: number; access: number };
  revalidatePath("/admin", "layout");
  return { ok: true, message: `Added ${r.people} providers with ${r.completions} completed courses. Nobody was notified. Send login invites from Providers when you're ready.` };
}

export async function discardWixImport(_p: R | undefined, fd: FormData): Promise<R> {
  const { supabase, denied } = await superAdmin();
  if (denied) return { error: denied };
  const run = String(fd.get("run_id") ?? "");
  if (!UUID.test(run)) return { error: "Unknown import." };
  const { error } = await supabase.rpc("discard_wix_import", { p_run: run });
  if (error) return { error: error.message };
  revalidatePath("/admin/import/wix");
  return { ok: true, message: "Discarded. Nothing was added." };
}
