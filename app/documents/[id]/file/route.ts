import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opens a private document. RLS decides whether the caller may see the row; only then do we
// mint a 60-second signed link. Staff views are written to the audit log.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("id, storage_path, provider_id").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const { data: { user } } = await supabase.auth.getUser();
  if (user && user.id !== doc.provider_id) await supabase.rpc("log_event", { p_action: "view_document", p_table: "documents", p_record: id });
  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 60);
  if (!signed?.signedUrl) return new NextResponse("Not found", { status: 404 });
  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
