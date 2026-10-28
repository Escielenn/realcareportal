// Public configuration. The Supabase URL and publishable key are designed to be public
// (they ship to every browser); row-level security protects the data.
// Environment variables override these defaults when set in Vercel.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lrduhuzykvvozunbcpem.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_rwZ57jSMoHGS-xCdleUO1w_falnprdB";
// Demo mode shows the one-click demo accounts on the login page.
// Set NEXT_PUBLIC_DEMO_MODE=false in Vercel before any real data is used.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";
