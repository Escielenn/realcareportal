import type { Metadata, Viewport } from "next";
import { getLang } from "@/lib/i18n";
import { MountainBackdrop } from "@/components/mountains";
// Brand fonts from realcarecolorado.com, self-hosted (no request to Google from providers' browsers).
import "@fontsource-variable/open-sans";
import "@fontsource-variable/raleway";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Care Portal",
  description: "Training, forms and messages for Real Care providers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#8224e3" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className="min-h-dvh antialiased">
        <MountainBackdrop />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
