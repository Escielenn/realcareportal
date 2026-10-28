import type { Metadata, Viewport } from "next";
import { getLang } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Care Portal",
  description: "Training, forms and messages for Real Care providers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f5c5f" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
