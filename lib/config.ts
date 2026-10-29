// Public configuration. The Supabase URL and publishable key are designed to be public
// (they ship to every browser); row-level security protects the data.
// Environment variables override these defaults when set in Vercel.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lrduhuzykvvozunbcpem.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_rwZ57jSMoHGS-xCdleUO1w_falnprdB";
// Demo mode shows the one-click demo accounts and guided tours, which sign in to fictional accounts.
// Fails closed: it is on only when NEXT_PUBLIC_DEMO_MODE is "true", or when the variable is unset AND the
// app points at the demo Supabase project. Any other project (production) stays off unless explicitly enabled.
const DEMO_PROJECT_URL = "https://lrduhuzykvvozunbcpem.supabase.co";
const demoFlag = process.env.NEXT_PUBLIC_DEMO_MODE;
export const DEMO_MODE = demoFlag === "true" || (demoFlag === undefined && SUPABASE_URL === DEMO_PROJECT_URL);
