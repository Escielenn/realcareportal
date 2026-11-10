import type { SupabaseClient } from "@supabase/supabase-js";

// A page of course material (PDF or image) stored privately in training-media; shown with a short-lived link.
export async function LessonAttachment({ supabase, path, title, lang = "en" }: { supabase: SupabaseClient; path: string | null; title: string; lang?: "en" | "es" }) {
  if (!path) return null;
  const { data } = await supabase.storage.from("training-media").createSignedUrl(path, 60 * 60);
  const url = data?.signedUrl;
  if (!url) return <p className="rounded-xl bg-sand p-4 text-muted">{lang === "es" ? "No se pudo abrir la página." : "The page couldn't be opened."}</p>;
  const isPdf = path.toLowerCase().endsWith(".pdf");
  return (
    <figure className="space-y-2">
      {isPdf ? (
        <iframe src={url} title={title} className="h-[70vh] min-h-96 w-full rounded-xl border border-line bg-white" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="w-full rounded-xl border border-line bg-white" />
      )}
      <figcaption>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-teal hover:underline">
          {lang === "es" ? "Abrir la página en una pestaña nueva" : "Open the page in a new tab"}
        </a>
      </figcaption>
    </figure>
  );
}
