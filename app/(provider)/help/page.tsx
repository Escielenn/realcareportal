import Link from "next/link";
import { requireProvider } from "@/lib/auth";
import { getLang } from "@/lib/i18n";

// Plain-language how-to for providers (about a 6th to 8th grade reading level), in English and Spanish.
const TOPICS = {
  en: [
    { title: "Your home screen", steps: ["Home shows what needs your attention first: forms sent back to you, and anything overdue.", "Below that you'll see what's due soon, your training, your messages, and news from Real Care."] },
    { title: "Training", steps: ["Open Training to see the courses you need this year and your due date.", "Watch each video all the way through. Skipping ahead doesn't count.", "Pass the quiz at the end. You can try again if you don't pass.", "When you finish, you can open or print your certificate."] },
    { title: "Forms", steps: ["Open Forms to see the forms Real Care gave you, with due dates.", "Your answers save as a draft while you work, so you can stop and come back.", "Press Submit when you're done. Staff will review it.", "If staff send a form back, only the highlighted parts can change. Fix those and send it again."] },
    { title: "Starting a form yourself", steps: ["Some forms, like incident reports and log notes, you can start yourself from Forms → Start a form.", "You can also scan the QR code Real Care posted. Sign in, and the form opens."] },
    { title: "Documents", steps: ["Open Documents to send paperwork like visit forms or medication lists.", "Pick the type and the person, then choose a PDF or take a photo with your phone.", "Staff will accept it or ask for a new copy."] },
    { title: "Messages", steps: ["Open Messages to write to Real Care staff. Only you and staff can read it.", "You'll get an email when staff reply. The email never includes private details. Sign in to read it."] },
    { title: "Language", steps: ["Tap EN or ES at the top to switch between English and Spanish. Your choice is saved."] },
    { title: "Trouble signing in", steps: ["On the sign-in page, choose \"Forgot your password?\" and enter your email.", "Real Care staff will send you a link to choose a new password."] },
  ],
  es: [
    { title: "Su pantalla de inicio", steps: ["Inicio muestra primero lo que necesita su atención: formularios devueltos y lo que está atrasado.", "Debajo verá lo que vence pronto, su capacitación, sus mensajes y las noticias de Real Care."] },
    { title: "Capacitación", steps: ["Abra Capacitación para ver los cursos que necesita este año y su fecha límite.", "Vea cada video completo. Adelantar el video no cuenta.", "Apruebe la prueba al final. Si no la aprueba, puede intentarlo otra vez.", "Al terminar, puede abrir o imprimir su certificado."] },
    { title: "Formularios", steps: ["Abra Formularios para ver los formularios que Real Care le asignó, con sus fechas.", "Sus respuestas se guardan como borrador mientras trabaja, así que puede parar y volver.", "Presione Enviar cuando termine. El personal lo revisará.", "Si el personal le devuelve un formulario, solo puede cambiar las partes marcadas. Corríjalas y envíelo otra vez."] },
    { title: "Empezar un formulario usted mismo", steps: ["Algunos formularios, como informes de incidentes y notas de registro, los puede empezar desde Formularios → Empezar un formulario.", "También puede escanear el código QR que Real Care colocó. Inicie sesión y el formulario se abre."] },
    { title: "Documentos", steps: ["Abra Documentos para enviar papeles como formularios de visitas o listas de medicamentos.", "Elija el tipo y la persona, y luego un PDF o tome una foto con su teléfono.", "El personal lo aceptará o le pedirá una copia nueva."] },
    { title: "Mensajes", steps: ["Abra Mensajes para escribirle al personal de Real Care. Solo usted y el personal pueden leerlo.", "Recibirá un correo cuando el personal responda. El correo nunca incluye detalles privados. Inicie sesión para leerlo."] },
    { title: "Idioma", steps: ["Toque EN o ES arriba para cambiar entre inglés y español. Su elección se guarda."] },
    { title: "Problemas para iniciar sesión", steps: ["En la página de inicio de sesión, elija \"¿Olvidó su contraseña?\" y escriba su correo.", "El personal de Real Care le enviará un enlace para elegir una contraseña nueva."] },
  ],
};

export default async function HelpPage() {
  await requireProvider();
  const lang = await getLang();
  const es = lang === "es";
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-navy">{es ? "Ayuda" : "Help"}</h1>
        <p className="mt-1 text-muted">{es ? "Cómo usar el portal, paso a paso." : "How to use the portal, step by step."}</p>
      </div>
      <div className="space-y-2">
        {TOPICS[lang].map((t, i) => (
          <details key={t.title} open={i === 0} className="card group p-4">
            <summary className="cursor-pointer text-lg font-semibold text-navy">{t.title}</summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-6">{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </details>
        ))}
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="font-semibold">{es ? "¿Todavía tiene preguntas?" : "Still have questions?"}</p>
        <Link href="/messages" className="btn-primary">{es ? "Escriba al personal de Real Care" : "Message Real Care staff"}</Link>
      </div>
    </div>
  );
}
