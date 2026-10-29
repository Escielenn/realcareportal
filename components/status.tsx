import type { Lang, TrainingStatus } from "@/lib/i18n";

// Every status pill pairs colour with an icon so meaning never rests on colour alone (WCAG 1.4.1).
type IconName = "check" | "alert" | "clock" | "eye" | "return" | "circle";
function Icon({ name }: { name: IconName }) {
  const d: Record<IconName, React.ReactNode> = {
    check: <path d="M5 12l4 4 10-10" />,
    alert: <><path d="M12 8v5" /><path d="M12 16.5h.01" /><circle cx="12" cy="12" r="9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    return: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
    circle: <circle cx="12" cy="12" r="8" />,
  };
  return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d[name]}</svg>;
}

const trainingStyles: Record<TrainingStatus, { cls: string; icon: IconName; en: string; es: string }> = {
  complete: { cls: "bg-green-soft text-green", icon: "check", en: "Complete", es: "Completo" },
  overdue: { cls: "bg-coral-soft text-coral", icon: "alert", en: "Overdue", es: "Atrasado" },
  due_soon: { cls: "bg-amber-soft text-amber", icon: "clock", en: "Due soon", es: "Vence pronto" },
  in_progress: { cls: "bg-teal-soft text-teal", icon: "circle", en: "On track", es: "Al día" },
};
export function TrainingPill({ status, lang = "en" }: { status: TrainingStatus; lang?: Lang }) {
  const s = trainingStyles[status];
  return <span className={`pill ${s.cls}`}><Icon name={s.icon} />{s[lang]}</span>;
}

const subStyles: Record<string, { cls: string; icon: IconName; en: string; es: string }> = {
  todo: { cls: "bg-sand text-ink", icon: "circle", en: "To do", es: "Pendiente" },
  submitted: { cls: "bg-teal-soft text-teal", icon: "eye", en: "In review", es: "En revisión" },
  returned: { cls: "bg-coral-soft text-coral", icon: "return", en: "Returned", es: "Devuelto" },
  accepted: { cls: "bg-green-soft text-green", icon: "check", en: "Accepted", es: "Aceptado" },
};
export function SubmissionPill({ status, lang = "en" }: { status: string; lang?: Lang }) {
  const s = subStyles[status] ?? subStyles.todo;
  return <span className={`pill ${s.cls}`}><Icon name={s.icon} />{s[lang]}</span>;
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((100 * value) / max) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
    </div>
  );
}
