import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/config";

// Browser client: uses the signed-in user's session, so row-level security and storage policies apply.
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
