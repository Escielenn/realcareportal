export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#0f5c5f" />
      <path d="M32 47s-15-8.6-15-20.2C17 21 21.2 17 26.2 17c2.6 0 4.6 1.2 5.8 3 1.2-1.8 3.2-3 5.8-3 5 0 9.2 4 9.2 9.8C47 38.4 32 47 32 47z" fill="#f7f6f2" />
    </svg>
  );
}
