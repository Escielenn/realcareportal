// Real Care, Inc. logo (from realcarecolorado.com). The artwork has a white ground,
// so on coloured backgrounds it sits on a white tile.
export function Logo({ className = "h-10", tile = false }: { className?: string; tile?: boolean }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/real-care-logo.png" alt="Real Care, Inc." className={`${tile ? "h-full" : className} w-auto`} width={480} height={377} />
  );
  if (!tile) return img;
  return <span className={`inline-flex items-center justify-center rounded-xl bg-white p-1 shadow-sm ${className}`}>{img}</span>;
}
