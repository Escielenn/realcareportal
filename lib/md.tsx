import React from "react";

// Minimal, safe renderer for course text: "## " headings, "- " bullets, "*note*" lines, paragraphs.
// Renders text nodes only (no HTML injection).
export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="my-3 list-disc space-y-1.5 pl-6">
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={blocks.length} className="mt-6 mb-2 text-lg font-semibold text-ink first:mt-0">
          {line.slice(3)}
        </h3>,
      );
    } else if (line.startsWith("*") && line.endsWith("*")) {
      blocks.push(
        <p key={blocks.length} className="mt-4 rounded-lg bg-sand px-4 py-3 text-sm text-muted italic">
          {line.slice(1, -1)}
        </p>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="my-2 leading-relaxed">
          {line}
        </p>,
      );
    }
  }
  flush();
  return <div className="text-[17px] text-ink">{blocks}</div>;
}
