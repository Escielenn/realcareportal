// Decorative Colorado mountains. Everything here is aria-hidden and sits behind content.

// Layered ridgelines (drawn, not traced from any photo) used along the bottom of bands and pages.
export function Ridges({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const fills =
    tone === "dark"
      ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.14)", "rgba(255,255,255,0.20)"]
      : ["rgba(130,36,227,0.07)", "rgba(13,10,91,0.07)", "rgba(36,185,226,0.08)"];
  return (
    <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className={className} aria-hidden focusable="false">
      <path fill={fills[0]} d="M0 150 L90 96 L150 120 L240 52 L330 118 L410 84 L470 104 L560 30 L650 112 L720 88 L800 120 L880 60 L960 110 L1040 74 L1110 100 L1200 40 L1290 106 L1360 80 L1440 98 V220 H0 Z" />
      <path fill={fills[1]} d="M0 178 L70 146 L140 160 L230 112 L300 150 L380 128 L450 156 L520 104 L600 150 L690 132 L760 160 L850 116 L930 154 L1010 136 L1090 162 L1170 118 L1250 156 L1340 138 L1440 160 V220 H0 Z" />
      <path fill={fills[2]} d="M0 200 L110 176 L200 190 L300 168 L410 192 L520 172 L640 194 L760 174 L880 196 L990 178 L1100 198 L1220 180 L1330 196 L1440 184 V220 H0 Z" />
    </svg>
  );
}

// A faded mountain photo plus ridgelines fixed to the bottom of every screen.
export function MountainBackdrop() {
  return (
    <div className="mountain-backdrop pointer-events-none fixed inset-x-0 bottom-0 -z-0 h-[42vh] min-h-56 select-none" aria-hidden>
      <div
        className="mountain-photo absolute inset-0 opacity-[0.13] grayscale-[35%]"
        style={{ maskImage: "linear-gradient(to top, black 15%, transparent 95%)", WebkitMaskImage: "linear-gradient(to top, black 15%, transparent 95%)" }}
      />
      <Ridges className="absolute inset-x-0 bottom-0 h-40 w-full" />
    </div>
  );
}

// A photo band with a brand tint: used for page heroes (login, dashboard greeting, course headers).
export function MountainBand({ children, className = "", photo = 1 }: { children: React.ReactNode; className?: string; photo?: 1 | 2 }) {
  return (
    <div className={`relative isolate overflow-hidden text-white ${className}`}>
      <div className={`${photo === 2 ? "mountain-photo-2" : "mountain-photo"} absolute inset-0 -z-20`} aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#2a0a5e]/90 via-[#5a12a8]/80 to-[#0d0a5b]/85" aria-hidden />
      <Ridges tone="dark" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-16 w-full" />
      {children}
    </div>
  );
}
