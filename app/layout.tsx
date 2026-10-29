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
        <a href="#main" className="sr-only z-50 rounded-full bg-white px-4 py-2 font-semibold text-teal shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3">Skip to main content / Ir al contenido</a>
        <MountainBackdrop />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
