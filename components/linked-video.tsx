import type { Lang } from "@/lib/i18n";

// A training video hosted outside the portal (Dropbox for the demo; Mux in production).
// Opens in a new tab; the lesson is completed by the provider confirming they watched it.
export function LinkedVideo({ href, lang, minutes }: { href: string; lang: Lang; minutes: number | null }) {
  const es = lang === "es";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative isolate flex aspect-video w-full items-end overflow-hidden rounded-xl text-white shadow-sm focus-visible:outline-offset-4"
    >
      <span className="mountain-photo absolute inset-0 -z-20 transition-transform duration-500 group-hover:scale-105" aria-hidden />
      <span className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0d0a5b]/95 via-[#5a12a8]/70 to-[#8224e3]/40" aria-hidden />
      <span className="absolute top-1/2 left-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-teal shadow-lg transition-transform group-hover:scale-110" aria-hidden>
        <svg viewBox="0 0 24 24" className="ml-1 h-9 w-9" fill="currentColor"><path d="M7 4.5v15l13-7.5z" /></svg>
      </span>
      <span className="p-4 md:p-5">
        <span className="block font-display text-lg font-semibold">{es ? "Ver el video de capacitación" : "Watch the training video"}</span>
        <span className="block text-sm text-white/80">
          {es ? "Se abre en una pestaña nueva" : "Opens in a new tab"}
          {minutes ? ` · ${minutes} min` : ""}
          {es ? " · Narración en inglés; la transcripción en español está abajo" : ""}
        </span>
      </span>
    </a>
  );
}
