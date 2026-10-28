import type { SupabaseClient } from "@supabase/supabase-js";
import { trainingStatus, type TrainingStatus } from "@/lib/i18n";

export type ProviderRow = {
  provider_id: string; full_name: string; email: string; provider_types: string[]; locale: string; active: boolean;
  cycle_id: string | null; cycle_number: number | null; starts_on: string | null; due_on: string | null;
  required_count: number; done_count: number; status: TrainingStatus;
};

export async function providerRows(supabase: SupabaseClient): Promise<ProviderRow[]> {
  const { data } = await supabase.from("provider_status").select("*").order("full_name");
  return ((data ?? []) as Omit<ProviderRow, "status">[]).map((r) => ({ ...r, status: trainingStatus(r.required_count, r.done_count, r.due_on) }));
}
