"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];
type R = { ok?: boolean; error?: string };

function matchesSignature(mime: string, b: Uint8Array) {
  const hex = Array.from(b.slice(0, 12), (x) => x.toString(16).padStart(2, "0")).join("");
  const ascii = String.fromCharCode(...b.slice(0, 12));
  switch (mime) {
    case "application/pdf": return ascii.startsWith("%PDF-");
    case "image/jpeg": return hex.startsWith("ffd8ff");
    case "image/png": return hex.startsWith("89504e470d0a1a0a");
    case "image/webp": return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
    case "image/heic": case "image/heif": return ascii.slice(4, 8) === "ftyp";
    default: return false;
  }
}

// Called after the browser uploads the file straight to private storage (under the provider's own folder).
// The insert runs as the signed-in provider, so the documents RLS policy re-checks folder, person, type and size.
export async function recordDocument(input: {
  path: string; filename: string; mime: string; size: number; typeCode: string; individualId: string | null; note: string;
}): Promise<R> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  if (typeof input.path !== "string" || !input.path.startsWith(user.id + "/") || input.path.includes("..")) return { error: "Upload failed. Try again." };
  if (!MIME.includes(input.mime)) return { error: "Use a PDF or a photo (JPG, PNG, HEIC)." };
  if (!(input.size > 0 && input.size <= 20 * 1024 * 1024)) return { error: "Files can be up to 20 MB." };
  if (input.individualId !== null && !UUID.test(input.individualId)) return { error: "Choose a person." };
  if (!/^[a-z_]{2,40}$/.test(input.typeCode)) return { error: "Choose a document type." };
  // Check the file really is what it claims to be (first bytes), not just its declared type.
  const { data: blob } = await supabase.storage.from("documents").download(input.path);
  const head = blob ? new Uint8Array(await blob.slice(0, 16).arrayBuffer()) : new Uint8Array();
  if (!matchesSignature(input.mime, head)) {
    await supabase.storage.from("documents").remove([input.path]);
    return { error: "That file doesn't look like a PDF or photo. Please choose a different file." };
  }
  const { error } = await supabase.from("documents").insert({
    provider_id: user.id,
    individual_id: input.individualId,
    type_code: input.typeCode,
    storage_path: input.path,
    filename: String(input.filename).slice(0, 200),
    mime: input.mime,
    size_bytes: input.size,
    note: String(input.note ?? "").trim().slice(0, 500) || null,
  });
  if (error) {
    await supabase.storage.from("documents").remove([input.path]);
    return { error: "We couldn't save that document. Check the person and type, then try again." };
  }
  revalidatePath("/documents");
  return { ok: true };
}

export async function reviewDocument(documentId: string, action: "accept" | "return", note: string): Promise<R> {
  if (!UUID.test(documentId) || !["accept", "return"].includes(action)) return { error: "Invalid request" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_document", { p_document: documentId, p_action: action, p_note: note?.trim() || null });
  if (error) return { error: error.message };
  revalidatePath("/admin/documents", "layout");
  return { ok: true };
}
