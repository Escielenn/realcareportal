import type { Lang, TrainingStatus } from "@/lib/i18n";

const trainingStyles: Record<TrainingStatus, { cls: string; en: string; es: string }> = {
  complete: { cls: "bg-green-soft text-green", en: "Complete", es: "Completo" },
  overdue: { cls: "bg-coral-soft text-coral", en: "Overdue", es: "Atrasado" },
  due_soon: { cls: "bg-amber-soft text-amber", en: "Due soon", es: "Vence pronto" },
  in_progress: { cls: "bg-teal-soft text-teal", en: "On track", es: "Al día" },
};
export function TrainingPill({ status, lang = "en" }: { status: TrainingStatus; lang?: Lang }) {
  const s = trainingStyles[status];
  return <span className={`pill ${s.cls}`}>{s[lang]}</span>;
}

const subStyles: Record<string, { cls: string; en: string; es: string }> = {
  todo: { cls: "bg-sand text-muted", en: "To do", es: "Pendiente" },
  submitted: { cls: "bg-teal-soft text-teal", en: "In review", es: "En revisión" },
  returned: { cls: "bg-coral-soft text-coral", en: "Returned", es: "Devuelto" },
  accepted: { cls: "bg-green-soft text-green", en: "Accepted", es: "Aceptado" },
};
export function SubmissionPill({ status, lang = "en" }: { status: string; lang?: Lang }) {
  const s = subStyles[status] ?? subStyles.todo;
  return <span className={`pill ${s.cls}`}>{s[lang]}</span>;
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((100 * value) / max) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full bg-teal" style={{ width: `${pct}%` }} />
    </div>
  );
}
