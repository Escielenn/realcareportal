"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordDocument } from "@/app/documents/actions";

type Type = { code: string; name: string; per_individual: boolean };
type Person = { id: string; name: string };

const ACCEPT = "application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp";

export function DocumentUpload({ userId, types, people, lang }: { userId: string; types: Type[]; people: Person[]; lang: "en" | "es" }) {
  const es = lang === "es";
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [type, setType] = useState(types[0]?.code ?? "");
  const [person, setPerson] = useState(people[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const needsPerson = types.find((t) => t.code === type)?.per_individual ?? false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const f = file.current?.files?.[0];
    if (!f) return setMsg({ error: es ? "Elija un archivo." : "Choose a file." });
    if (f.size > 20 * 1024 * 1024) return setMsg({ error: es ? "El archivo puede ser de hasta 20 MB." : "Files can be up to 20 MB." });
    if (needsPerson && !person) return setMsg({ error: es ? "Elija a la persona." : "Choose the person." });
    setBusy(true); setMsg({});
    const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    // Random file name: no person names or details end up in the storage path.
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient();
    const up = await supabase.storage.from("documents").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) { setBusy(false); return setMsg({ error: es ? "No se pudo subir el archivo. Intente de nuevo." : "The upload didn't go through. Try again." }); }
    const r = await recordDocument({ path, filename: f.name, mime: f.type, size: f.size, typeCode: type, individualId: needsPerson ? person : null, note });
    setBusy(false);
    if (r.error) return setMsg({ error: r.error });
    setMsg({ ok: es ? "Documento enviado. El personal lo revisará." : "Document sent. Staff will review it." });
    setNote(""); if (file.current) file.current.value = "";
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="doc-type" className="label">{es ? "Tipo de documento" : "Document type"}</label>
          <select id="doc-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </div>
        {needsPerson && (
          <div>
            <label htmlFor="doc-person" className="label">{es ? "Persona" : "Person"}</label>
            <select id="doc-person" className="input" value={person} onChange={(e) => setPerson(e.target.value)}>
              {people.length === 0 && <option value="">{es ? "No apoya a nadie ahora" : "You don't support anyone right now"}</option>}
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="doc-file" className="label">{es ? "Archivo (PDF o foto, hasta 20 MB)" : "File (PDF or photo, up to 20 MB)"}</label>
        <input ref={file} id="doc-file" type="file" accept={ACCEPT} capture="environment" className="input file:mr-3 file:rounded-full file:border-0 file:bg-teal-soft file:px-3 file:py-1 file:font-semibold file:text-teal" />
        <p className="mt-1 text-sm text-muted">{es ? "En el teléfono puede tomar una foto del papel." : "On a phone you can take a photo of the paper."}</p>
      </div>
      <div>
        <label htmlFor="doc-note" className="label">{es ? "Nota para el personal (opcional)" : "Note for staff (optional)"}</label>
        <input id="doc-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </div>
      {msg.error && <p role="alert" className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{msg.error}</p>}
      {msg.ok && <p role="status" className="rounded-lg bg-green-soft px-3 py-2 text-sm text-green">{msg.ok}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? (es ? "Enviando…" : "Sending…") : es ? "Enviar documento" : "Send document"}</button>
    </form>
  );
}

export function DocumentReview({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function act(action: "accept" | "return") {
    setBusy(true); setErr("");
    const { reviewDocument } = await import("@/app/documents/actions");
    const r = await reviewDocument(documentId, action, note);
    setBusy(false);
    if (r.error) setErr(r.error); else router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input aria-label="Note to provider" placeholder="Note (needed to return it)…" className="input max-w-xs py-1.5" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn-primary py-1.5" disabled={busy} onClick={() => act("accept")}>Accept</button>
      <button className="btn-ghost py-1.5" disabled={busy} onClick={() => act("return")}>Return</button>
      {err && <span role="alert" className="text-sm text-coral">{err}</span>}
    </div>
  );
}
