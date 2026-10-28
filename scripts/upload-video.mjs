// CI helper: upload one transcoded training video to the private training-media bucket.
// Signs in as the fictional demo staff account so storage policies (staff-only insert) apply;
// no service-role key is used anywhere.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, statSync } from "node:fs";

const [file, path] = process.argv.slice(2);
const supabase = createClient("https://lrduhuzykvvozunbcpem.supabase.co", "sb_publishable_rwZ57jSMoHGS-xCdleUO1w_falnprdB");
const { error: e1 } = await supabase.auth.signInWithPassword({ email: "demo.staff@example.com", password: "RealCare-Demo-2026" });
if (e1) { console.error("sign-in failed", e1.message); process.exit(1); }
const size = statSync(file).size;
const { error } = await supabase.storage.from("training-media").upload(path, readFileSync(file), { contentType: "video/mp4", upsert: true, cacheControl: "31536000" });
if (error) { console.error("upload failed", size, error.message); process.exit(2); }
console.log(JSON.stringify({ path, size }));
