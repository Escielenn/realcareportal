import { cookies } from "next/headers";

export type Lang = "en" | "es";

export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get("rc_lang")?.value === "es" ? "es" : "en";
}

const dict = {
  home: { en: "Home", es: "Inicio" },
  training: { en: "Training", es: "Capacitación" },
  forms: { en: "Forms", es: "Formularios" },
  messages: { en: "Messages", es: "Mensajes" },
  signOut: { en: "Sign out", es: "Cerrar sesión" },
  hello: { en: "Hello", es: "Hola" },
  dashIntro: { en: "Here is everything you need to do, in one place.", es: "Aquí está todo lo que necesita hacer, en un solo lugar." },
  needsAttention: { en: "Needs your attention", es: "Necesita su atención" },
  dueSoon: { en: "Due soon", es: "Vence pronto" },
  allCaughtUp: { en: "You're all caught up.", es: "Está al día." },
  myTraining: { en: "My training", es: "Mi capacitación" },
  coursesDone: { en: "courses done", es: "cursos terminados" },
  dueBy: { en: "Due by", es: "Fecha límite" },
  continueTraining: { en: "Continue training", es: "Continuar capacitación" },
  announcements: { en: "Announcements", es: "Anuncios" },
  recentlySubmitted: { en: "Recently submitted", es: "Enviados recientemente" },
  returnedForm: { en: "Returned for a correction", es: "Devuelto para corregir" },
  fixNow: { en: "Fix now", es: "Corregir" },
  start: { en: "Start", es: "Empezar" },
  open: { en: "Open", es: "Abrir" },
  view: { en: "View", es: "Ver" },
  for: { en: "for", es: "para" },
  due: { en: "Due", es: "Vence" },
  overdue: { en: "Overdue", es: "Atrasado" },
  required: { en: "Required this cycle", es: "Requeridos en este ciclo" },
  moreTraining: { en: "More training", es: "Más capacitación" },
  history: { en: "Training history", es: "Historial de capacitación" },
  complete: { en: "Complete", es: "Completado" },
  notStarted: { en: "Not started", es: "Sin empezar" },
  inProgress: { en: "In progress", es: "En curso" },
  lessons: { en: "Lessons", es: "Lecciones" },
  markRead: { en: "I've read this, continue", es: "Ya lo leí, continuar" },
  backToCourse: { en: "Back to course", es: "Volver al curso" },
  submitAnswers: { en: "Submit answers", es: "Enviar respuestas" },
  yourScore: { en: "Your score", es: "Su calificación" },
  passed: { en: "Passed", es: "Aprobado" },
  tryAgain: { en: "Try again", es: "Intentar de nuevo" },
  needed: { en: "needed to pass", es: "necesario para aprobar" },
  courseComplete: { en: "Course complete!", es: "¡Curso completado!" },
  viewCertificate: { en: "View certificate", es: "Ver certificado" },
  certificate: { en: "Certificate", es: "Certificado" },
  cycle: { en: "Cycle", es: "Ciclo" },
  toDo: { en: "To do", es: "Pendientes" },
  submittedWaiting: { en: "Submitted, waiting for review", es: "Enviado, en revisión" },
  accepted: { en: "Accepted", es: "Aceptado" },
  submit: { en: "Submit", es: "Enviar" },
  resubmit: { en: "Send corrections", es: "Enviar correcciones" },
  required_: { en: "Required", es: "Obligatorio" },
  fixThis: { en: "Please fix", es: "Por favor corrija" },
  onlyFlagged: { en: "Only the highlighted fields need changes. Everything else is saved.", es: "Solo los campos marcados necesitan cambios. Todo lo demás ya está guardado." },
  formHistory: { en: "History", es: "Historial" },
  submittedOn: { en: "Submitted", es: "Enviado" },
  send: { en: "Send", es: "Enviar" },
  writeMessage: { en: "Write a message to Real Care staff", es: "Escriba un mensaje al personal de Real Care" },
  messagesIntro: { en: "Messages are private between you and Real Care staff.", es: "Los mensajes son privados entre usted y el personal de Real Care." },
  you: { en: "You", es: "Usted" },
  realCareStaff: { en: "Real Care staff", es: "Personal de Real Care" },
  thanksSubmitted: { en: "Thank you! Your form was submitted.", es: "¡Gracias! Su formulario fue enviado." },
  fillRequired: { en: "Please complete the required fields.", es: "Por favor complete los campos obligatorios." },
  noForms: { en: "No forms here right now.", es: "No hay formularios por ahora." },
  print: { en: "Print", es: "Imprimir" },
  of: { en: "of", es: "de" },
  instructions: { en: "Instructions", es: "Instrucciones" },
  signatureHint: { en: "Typing your name counts as your signature.", es: "Escribir su nombre cuenta como su firma." },
  select: { en: "Select…", es: "Seleccione…" },
  noLongerLinked: { en: "Forms for people you no longer support are hidden automatically.", es: "Los formularios de personas que ya no apoya se ocultan automáticamente." },
} as const;

export type Key = keyof typeof dict;
export function t(lang: Lang, key: Key): string {
  return dict[key][lang];
}

export function fmtDate(d: string | null | undefined, lang: Lang = "en", opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(d);
  const date = new Date(isDateOnly ? d + "T12:00:00Z" : d);
  return date.toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: isDateOnly ? "UTC" : "America/Denver",
    ...opts,
  });
}

export function fmtDateTime(d: string, lang: Lang = "en") {
  return new Date(d).toLocaleString(lang === "es" ? "es-US" : "en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Denver",
  });
}

export function todayDenver(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}

export const providerTypeLabel: Record<string, { en: string; es: string }> = {
  host_home: { en: "Host Home", es: "Hogar anfitrión" },
  family_caregiver: { en: "Family Caregiver", es: "Cuidador familiar" },
  scc_dsp: { en: "SCC/DSP", es: "SCC/DSP" },
  nmt: { en: "NMT", es: "NMT" },
};

export type TrainingStatus = "complete" | "overdue" | "due_soon" | "in_progress";
export function trainingStatus(required: number, done: number, dueOn: string | null): TrainingStatus {
  if (required > 0 && done >= required) return "complete";
  if (!dueOn) return "in_progress";
  const left = daysBetween(todayDenver(), dueOn);
  if (left < 0) return "overdue";
  if (left <= 30) return "due_soon";
  return "in_progress";
}
