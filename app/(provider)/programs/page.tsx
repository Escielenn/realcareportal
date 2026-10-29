import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { getLang, fmtDate } from "@/lib/i18n";
import { title, type Course } from "@/lib/data";
import { accessFor, daysUntil, money, programName, today } from "@/lib/programs";
import { JoinProgramButton } from "@/components/program-bits";

const L = {
  title: { en: "Programs & pricing", es: "Programas y precios" },
  intro: {
    en: "A program opens a set of courses for a full term, usually 12 months. Join once, then renew each year.",
    es: "Un programa abre un grupo de cursos por un periodo completo, normalmente 12 meses. Únase una vez y renueve cada año.",
  },
  months12: { en: "12 months", es: "12 meses" },
  days: { en: "days", es: "días" },
  per: { en: "for", es: "por" },
  free: { en: "Free", es: "Gratis" },
  courses: { en: "courses included", es: "cursos incluidos" },
  activeUntil: { en: "Active until", es: "Activo hasta" },
  renewedThrough: { en: "Renewed through", es: "Renovado hasta" },
  ended: { en: "Ended", es: "Terminó" },
  join: { en: "Join", es: "Unirse" },
  joinFree: { en: "Join for free", es: "Unirse gratis" },
  renew: { en: "Renew", es: "Renovar" },
  renewFrom: { en: "You can renew starting", es: "Puede renovar a partir del" },
  endsSoon: { en: "Ends in", es: "Termina en" },
  example: { en: "Example", es: "Ejemplo" },
  single: { en: "Courses sold on their own", es: "Cursos que se venden por separado" },
  singleNote: { en: "These are not part of a program you hold. Open a course to buy it.", es: "No son parte de un programa que usted tiene. Abra un curso para comprarlo." },
  demo: {
    en: "Demo checkout: no card is charged. In the full portal, paying opens a secure Stripe page. Real Care staff can also give you a program.",
    es: "Pago de demostración: no se cobra ninguna tarjeta. En el portal completo, el pago abre una página segura de Stripe. El personal de Real Care también puede darle un programa.",
  },
  none: { en: "No programs are offered right now. Contact Real Care staff.", es: "No hay programas disponibles ahora. Comuníquese con el personal de Real Care." },
};

export default async function ProgramsPage() {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const [acc, { data: courses }] = await Promise.all([
    accessFor(supabase, profile.id),
    supabase.from("courses").select("*").eq("published", true).order("sort"),
  ]);
  const all = (courses ?? []) as Course[];
  const t0 = today();
  const term = (d: number) => (d === 365 ? L.months12[lang] : `${d} ${L.days[lang]}`);
  const visible = acc.programs.filter((p) => p.active && (p.audience.length === 0 || p.audience.some((a) => profile.provider_types.includes(a)) || acc.latest.has(p.id)));
  const single = all.filter((c) => c.price_cents > 0 && !acc.canOpen(c));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/training" className="text-sm font-semibold text-teal hover:underline">← {lang === "es" ? "Capacitación" : "Training"}</Link>
        <h1 className="mt-2 text-2xl font-bold">{L.title[lang]}</h1>
        <p className="text-muted">{L.intro[lang]}</p>
      </div>

      {visible.length === 0 && <p className="card p-5 text-muted">{L.none[lang]}</p>}

      <ul className="space-y-4">
        {visible.map((p) => {
          const last = acc.latest.get(p.id);
          const active = last && last.ends_on >= t0;
          const left = last ? daysUntil(last.ends_on) : 0;
          const canRenew = !last || left <= 60;
          const included = all.filter((c) => acc.coursesOf.get(p.id)?.has(c.id));
          const price = p.price_cents > 0 ? `${money(p.price_cents)} ${L.per[lang]} ${term(p.duration_days)}` : `${L.free[lang]} · ${term(p.duration_days)}`;
          return (
            <li key={p.id} className={`card overflow-hidden ${active ? "border-teal" : ""}`}>
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-bold">{programName(p, lang)}</h2>
                  {p.is_example && <span className="pill bg-sand text-muted">{L.example[lang]}</span>}
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">{price}</p>
                <p className="mt-2 text-muted">{lang === "es" ? p.description_es : p.description_en}</p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-teal">{included.length} {L.courses[lang]}</summary>
                  <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                    {included.map((c) => <li key={c.id}><Link href={`/training/${c.slug}`} className="hover:underline">{title(c, lang)}</Link></li>)}
                  </ul>
                </details>
              </div>
              <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 ${active ? "bg-teal-soft/50" : "bg-sand/40"}`}>
                <p className="text-sm font-semibold">
                  {!last ? null : active ? (
                    <span className={left <= 30 ? "text-amber" : "text-green"}>
                      {last.starts_on > t0 ? L.renewedThrough[lang] : L.activeUntil[lang]} {fmtDate(last.ends_on, lang)}
                      {left <= 30 && last.starts_on <= t0 && <> · {L.endsSoon[lang]} {left} {L.days[lang]}</>}
                    </span>
                  ) : (
                    <span className="text-muted">{L.ended[lang]} {fmtDate(last.ends_on, lang)}</span>
                  )}
                </p>
                {canRenew ? (
                  <JoinProgramButton programId={p.id} label={`${last ? L.renew[lang] : p.price_cents ? L.join[lang] : L.joinFree[lang]}${p.price_cents ? ` · ${money(p.price_cents)}` : ""}`} />
                ) : (
                  <p className="text-sm text-muted">{L.renewFrom[lang]} {fmtDate(new Date(Date.parse(last!.ends_on) - 60 * 86_400_000).toISOString().slice(0, 10), lang)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {single.length > 0 && (
        <section className="card p-5">
          <h2 className="font-bold">{L.single[lang]}</h2>
          <p className="mb-3 text-sm text-muted">{L.singleNote[lang]}</p>
          <ul className="divide-y divide-line">
            {single.map((c) => (
              <li key={c.id}>
                <Link href={`/training/${c.slug}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-teal">
                  <span className="font-medium">{title(c, lang)}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">{money(c.price_cents)} · {c.access_days} {L.days[lang]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">{L.demo[lang]}</p>
    </div>
  );
}
