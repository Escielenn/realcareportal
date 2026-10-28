"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reportVideo, demoCheckout, markNotificationsRead } from "@/app/actions";

const V = {
  watched: { en: "Watched", es: "Visto" },
  of: { en: "of", es: "de" },
  done: { en: "Lesson complete", es: "Lección completada" },
  need: { en: "Watch at least 90% to complete this lesson. Skipping ahead doesn't count.", es: "Vea al menos el 90% para completar esta lección. Adelantar el video no cuenta." },
  next: { en: "Continue", es: "Continuar" },
  courseDone: { en: "Course complete!", es: "¡Curso completado!" },
};

export function VideoLesson({ lessonId, src, lang, initialWatched, duration: knownDuration, initiallyComplete, nextHref }: {
  lessonId: string; src: string; lang: "en" | "es"; initialWatched: number; duration: number | null; initiallyComplete: boolean; nextHref: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const last = useRef(0);
  const [watched, setWatched] = useState(initialWatched);
  const [duration, setDuration] = useState(knownDuration ?? 0);
  const [complete, setComplete] = useState(initiallyComplete);
  const [courseDone, setCourseDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (force = false) => {
    const v = ref.current;
    if (!v || !v.duration || complete) return;
    const now = Date.now();
    if (!force && now - last.current < 8000) return;
    last.current = now;
    const r = await reportVideo(lessonId, v.currentTime, v.duration, lang);
    if (r.error) { setError(r.error); return; }
    if (r.result) {
      setWatched(r.result.watched);
      if (r.result.lesson_complete) setComplete(true);
      if (r.result.course_complete) setCourseDone(true);
    }
  };
  const pct = duration ? Math.min(100, Math.round((100 * watched) / duration)) : 0;

  return (
    <div className="space-y-4">
      <video
        ref={ref} src={src} controls playsInline preload="metadata"
        className="aspect-video w-full rounded-xl bg-black"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={() => send(false)} onPause={() => send(true)} onEnded={() => send(true)}
      />
      <div className="rounded-xl bg-sand p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">{complete ? `✓ ${V.done[lang]}` : `${V.watched[lang]} ${Math.round(watched)}s ${V.of[lang]} ${Math.round(duration)}s`}</span>
          <span className="text-muted">{complete ? "100%" : `${pct}%`}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${complete ? "bg-green" : "bg-teal"}`} style={{ width: `${complete ? 100 : pct}%` }} /></div>
        {!complete && <p className="mt-2 text-sm text-muted">{V.need[lang]}</p>}
        {error && <p className="mt-2 text-sm text-coral">{error}</p>}
      </div>
      {courseDone && <p className="font-semibold text-green">🎉 {V.courseDone[lang]}</p>}
      {complete && <Link href={nextHref} className="btn-primary">{V.next[lang]} →</Link>}
    </div>
  );
}

const P = {
  locked: { en: "This course needs to be purchased", es: "Este curso necesita comprarse" },
  why: { en: "QMAP and specialty courses are paid separately. Real Care staff can also give you access.", es: "QMAP y los cursos especializados se pagan por separado. El personal de Real Care también puede darle acceso." },
  core: { en: "Your All-Access Package has ended. Renew it to keep training.", es: "Su paquete de acceso completo terminó. Renuévelo para seguir con la capacitación." },
  buy: { en: "Buy this course", es: "Comprar este curso" },
  all: { en: "Buy All-Access, 12 months", es: "Comprar acceso completo, 12 meses" },
  demo: { en: "Demo checkout: no card is charged. In the full portal this opens a secure Stripe payment page.", es: "Pago de demostración: no se cobra ninguna tarjeta. En el portal completo se abre una página de pago segura de Stripe." },
  days: { en: "days of access", es: "días de acceso" },
};

export function Paywall({ courseId, priceCents, accessDays, inAllAccess, lang }: { courseId: string; priceCents: number; accessDays: number; inAllAccess: boolean; lang: "en" | "es" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const buy = (id: string | null) => start(async () => {
    const r = await demoCheckout(id);
    if (r.error) setError(r.error); else router.refresh();
  });
  return (
    <div className="border-y border-amber/20 bg-amber-soft px-5 py-5">
      <p className="font-bold text-amber">🔒 {P.locked[lang]}</p>
      <p className="mt-1 text-sm text-ink">{inAllAccess ? P.core[lang] : P.why[lang]}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={pending} onClick={() => buy(courseId)} className="btn-primary">
          {P.buy[lang]} · ${(priceCents / 100).toFixed(2)} · {accessDays} {P.days[lang]}
        </button>
        {inAllAccess && <button disabled={pending} onClick={() => buy(null)} className="btn-ghost">{P.all[lang]} · $75.00</button>}
      </div>
      <p className="mt-3 text-xs text-muted">{P.demo[lang]}</p>
      {error && <p className="mt-2 text-sm text-coral">{error}</p>}
    </div>
  );
}

export function MarkAllRead({ label }: { label: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(() => markNotificationsRead(null))} className="btn-ghost text-sm">{label}</button>;
}

export function NotificationLink({ id, href, unread, children }: { id: string; href: string; unread: boolean; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <a href={href} onClick={async (e) => { e.preventDefault(); if (unread) await markNotificationsRead([id]); router.push(href); }}
      className={`flex items-start gap-3 p-4 hover:bg-sand/60 ${unread ? "bg-teal-soft/40" : ""}`}>
      {children}
    </a>
  );
}
