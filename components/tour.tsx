"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOURS, type TourRole } from "@/lib/tour";
import { startTour } from "@/app/tour-actions";

// ---------------------------------------------------------------- tour position (a cookie, so it survives page changes)
type Pos = { role: TourRole; i: number };
function readPos(): Pos | null {
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )rc_tour=(provider|staff)\.(\d+)/) : null;
  if (!m) return null;
  const role = m[1] as TourRole;
  const i = Math.min(Number(m[2]), TOURS[role].steps.length - 1);
  return { role, i };
}
function writePos(p: Pos | null) {
  document.cookie = p ? `rc_tour=${p.role}.${p.i}; path=/; max-age=7200; samesite=lax` : "rc_tour=; path=/; max-age=0; samesite=lax";
}

// ---------------------------------------------------------------- start buttons (sign-in page)
export function TourStart() {
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<TourRole | null>(null);
  const [error, setError] = useState<string>();
  const go = (role: TourRole) => {
    setWhich(role);
    start(async () => { const r = await startTour(role); if (r?.error) setError(r.error); });
  };
  return (
    <section aria-labelledby="tour-h" className="card overflow-hidden">
      <div className="brand-bar px-6 py-5 text-white">
        <h2 id="tour-h" className="text-2xl font-bold">New here? Take a tour</h2>
        <p className="mt-1 text-lg text-white/90">A few big, simple screens show you everything. About 3 minutes.</p>
      </div>
      <div className="grid gap-3 p-5">
        <button type="button" disabled={pending} onClick={() => go("provider")}
          className="flex min-h-28 flex-col items-start justify-center rounded-2xl border-2 border-teal bg-teal-soft px-5 py-4 text-left transition-colors hover:bg-teal hover:text-white disabled:opacity-60">
          <span className="text-xl font-bold">{pending && which === "provider" ? "Starting…" : "Take a tour as a provider"}</span>
          <span className="mt-1 text-base opacity-80">Training, forms and programs, as Maria sees them</span>
        </button>
        <button type="button" disabled={pending} onClick={() => go("staff")}
          className="flex min-h-28 flex-col items-start justify-center rounded-2xl border-2 border-navy bg-sky-soft px-5 py-4 text-left transition-colors hover:bg-navy hover:text-white disabled:opacity-60">
          <span className="text-xl font-bold">{pending && which === "staff" ? "Starting…" : "Take a tour as staff"}</span>
          <span className="mt-1 text-base opacity-80">Bulk actions, reviews and reports, as Dana sees them</span>
        </button>
      </div>
      {error && <p role="alert" className="px-5 pb-5 text-coral">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- the guide shown on every page while a tour is on
type Box = { top: number; left: number; width: number; height: number };

export function TourGuide() {
  const pathname = usePathname();
  const router = useRouter();
  const [pos, setPos] = useState<Pos | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [pending, start] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { setPos(readPos()); }, [pathname]);

  const tour = pos ? TOURS[pos.role] : null;
  const step = pos && tour ? tour.steps[pos.i] : null;
  const here = !!step && pathname === step.path;

  // Find and follow the highlighted element.
  const measure = useCallback(() => {
    if (!step?.target || !here) { setBox(null); return; }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 });
  }, [step, here]);

  useLayoutEffect(() => {
    if (!here) return;
    const el = step?.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 96; // clear the sticky header
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    const t = setTimeout(measure, 400);
    // Room to scroll the last parts of a page above the guide.
    document.body.style.paddingBottom = "65vh";
    heading.current?.focus();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      document.body.style.paddingBottom = "";
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [here, step, measure]);

  const end = useCallback(() => { writePos(null); setPos(null); setBox(null); }, []);

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") end(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pos, end]);

  if (!pos || !tour || !step) return null;

  const go = (i: number) => {
    const next = { role: pos.role, i };
    writePos(next);
    setPos(next);
    setBox(null);
    if (tour.steps[i].path !== pathname) router.push(tour.steps[i].path);
  };
  const last = pos.i === tour.steps.length - 1;
  const other: TourRole = pos.role === "provider" ? "staff" : "provider";

  // Wandered off the tour's page: a small bar to come back.
  if (!here) {
    return (
      <div className="no-print fixed inset-x-3 bottom-24 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-white shadow-xl md:bottom-6">
        <span className="flex-1 font-semibold">Tour paused · step {pos.i + 1} of {tour.steps.length}</span>
        <button type="button" onClick={() => router.push(step.path)} className="rounded-xl bg-white px-4 py-2 font-bold text-navy">Back to tour</button>
        <button type="button" onClick={end} className="rounded-xl px-2 py-2 text-white/80 underline">End</button>
      </div>
    );
  }

  return (
    <div className="no-print" aria-live="polite">
      {/* Dim the page; cut a window around the highlighted part. Clicks pass through to the page. */}
      {box ? (
        <div aria-hidden className="pointer-events-none fixed z-40 rounded-2xl ring-4 ring-sky transition-all duration-300"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height, boxShadow: "0 0 0 9999px rgba(20, 12, 45, 0.55)" }} />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-40 bg-[rgba(20,12,45,0.45)]" />
      )}

      <div role="dialog" aria-labelledby="tour-title" aria-describedby="tour-body"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl rounded-t-3xl bg-white p-6 shadow-2xl md:bottom-6 md:rounded-3xl md:p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-full bg-teal-soft px-3 py-1 text-sm font-bold text-teal">{tour.name}</span>
          <span className="text-base font-semibold text-muted">Step {pos.i + 1} of {tour.steps.length}</span>
          <button type="button" onClick={end} className="ml-auto rounded-full px-3 py-1.5 text-base font-semibold text-muted hover:bg-sand" aria-label="End the tour">End tour ✕</button>
        </div>
        <div className="mb-4 flex gap-1.5" aria-hidden>
          {tour.steps.map((_, k) => <span key={k} className={`h-2 flex-1 rounded-full ${k <= pos.i ? "bg-teal" : "bg-sand"}`} />)}
        </div>
        <h2 id="tour-title" ref={heading} tabIndex={-1} className="text-2xl font-bold text-navy outline-none md:text-3xl">{step.title}</h2>
        <p id="tour-body" className="mt-3 text-lg leading-relaxed text-ink md:text-xl">{step.body}</p>
        {step.points && (
          <ul className="mt-4 space-y-2">
            {step.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-lg font-semibold text-ink">
                <span aria-hidden className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-soft text-green">✓</span>{p}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          {pos.i > 0 && (
            <button type="button" onClick={() => go(pos.i - 1)} className="btn-ghost min-h-14 flex-1 text-lg sm:flex-none sm:px-8">← Back</button>
          )}
          {!last ? (
            <button type="button" onClick={() => go(pos.i + 1)} className="btn-primary min-h-14 flex-[2] text-lg sm:flex-none sm:px-10">Next →</button>
          ) : (
            <>
              <button type="button" disabled={pending} onClick={() => start(async () => { await startTour(other); })} className="btn-primary min-h-14 flex-[2] text-lg sm:flex-none sm:px-8">
                {pending ? "Starting…" : other === "staff" ? "Take the staff tour →" : "Take the provider tour →"}
              </button>
              <button type="button" onClick={end} className="btn-ghost min-h-14 flex-1 text-lg sm:flex-none sm:px-8">Finish</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
