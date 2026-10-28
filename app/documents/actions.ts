"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIME = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif", "image/webp"];
type R = { ok?: boolean; error?: string };

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
