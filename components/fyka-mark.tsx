import { useId } from "react";

// The Fyka family mark: three waves on a light tile (docs/design/huisstijl.html).
// The wave colours belong to the whole family; don't recolour them.
export function FykaMark({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill={`url(#${gradient})`} />
      <g fill="none" strokeWidth="1.9" strokeLinecap="round">
        <path d="M7.4 17.6c1-1.68 1-3.92 0-5.6s-1-3.92 0-5.6" stroke="#EF4444" />
        <path d="M12 16.8c1-1.68 1-3.92 0-5.6s-1-3.92 0-5.6" stroke="#10B981" />
        <path d="M16.6 17.6c1-1.68 1-3.92 0-5.6s-1-3.92 0-5.6" stroke="#5B7BAA" />
      </g>
    </svg>
  );
}
