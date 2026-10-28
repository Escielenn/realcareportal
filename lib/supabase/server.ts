import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/config";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Session client: every query runs as the signed-in user, so row-level security applies.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
