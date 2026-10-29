import { requireProvider } from "@/lib/auth";
import { getLang, t, fmtDateTime } from "@/lib/i18n";
import { MessageComposer } from "@/components/client-bits";
import { MarkThreadRead } from "@/components/phase3-bits";

export default async function MessagesPage() {
  const { supabase, profile } = await requireProvider();
  const lang = await getLang();
  const { data: msgs } = await supabase.from("messages").select("id, body, created_at, sender_id").eq("provider_id", profile.id).order("created_at");
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <MarkThreadRead providerId={profile.id} />
      <div>
        <h1 className="text-3xl font-semibold text-navy">{t(lang, "messages")}</h1>
        <p className="text-muted">{t(lang, "messagesIntro")}</p>
      </div>
      <div className="card space-y-3 p-4">
        {(msgs ?? []).length === 0 && (
          <div className="rounded-xl bg-sand/60 p-4 text-center">
            <p className="font-semibold">{lang === "es" ? "Todavía no hay mensajes" : "No messages yet"}</p>
            <p className="mt-1 text-sm text-muted">
              {lang === "es"
                ? "¿Preguntas sobre la capacitación o los formularios? Escriba al personal de Real Care aquí. Normalmente respondemos en un día hábil."
                : "Questions about training or forms? Write to Real Care staff here. We usually answer within one business day."}
            </p>
          </div>
        )}
        {(msgs ?? []).map((m) => {
          const mine = m.sender_id === profile.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${mine ? "rounded-br-sm bg-teal text-white" : "rounded-bl-sm bg-sand"}`}>
                <p className={`text-xs font-semibold ${mine ? "text-white/75" : "text-muted"}`}>{mine ? t(lang, "you") : t(lang, "realCareStaff")} · {fmtDateTime(m.created_at, lang)}</p>
                <p className="mt-0.5 whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div className="border-t border-line pt-3">
          <MessageComposer providerId={profile.id} placeholder={t(lang, "writeMessage")} sendLabel={t(lang, "send")} />
        </div>
      </div>
    </div>
  );
}
