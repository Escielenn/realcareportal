import { requireClientFeatures } from "@/lib/auth";

// Client features stay hidden until the HIPAA step (app_settings.client_features).
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireClientFeatures();
  return children;
}
