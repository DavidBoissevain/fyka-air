import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// The house style's primary button: the sky gradient with white text.
export const primaryButtonClass =
  "bg-linear-135 from-sky-600 to-sky-700 text-white hover:brightness-108 border-transparent";

/**
 * The Stroom glyph (AirMark) drawn large on a soft sky circle. "lost": the
 * particle has blown away along a dashed trail (404). "error": an amber
 * warning dot where the particle was.
 */
function StatusIllustration({ variant }: { variant: "lost" | "error" }) {
  return (
    <svg viewBox="0 0 160 160" className="size-36" aria-hidden>
      <circle cx="80" cy="80" r="80" className="fill-brand-soft" />
      <g className="stroke-brand-text" fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 70c8-9.6 16-9.6 24 0s16 9.6 24 0 16-9.6 24 0" />
        <path d="M32 98c8-9.6 16-9.6 24 0s16 9.6 24 0" />
      </g>
      {variant === "lost" ? (
        <>
          <path
            d="M98 98c10-2 16-14 18-30s6-24 14-28"
            className="stroke-brand-text"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="1 9"
            opacity="0.6"
          />
          <circle cx="132" cy="38" r="7" className="fill-brand-text" />
        </>
      ) : (
        <>
          <circle cx="118" cy="100" r="20" className="fill-warn" />
          <path d="M118 90v11" className="stroke-white" strokeWidth="5" strokeLinecap="round" />
          <circle cx="118" cy="110" r="3" className="fill-white" />
        </>
      )}
    </svg>
  );
}

type StatusPageProps = {
  variant: "lost" | "error";
  title: string;
  children: ReactNode;
  actions: ReactNode;
  footnote?: ReactNode;
  className?: string;
};

/** The 404 and error pages: an illustration, a plain-Dutch message and a way back. */
export function StatusPage({ variant, title, children, actions, footnote, className }: StatusPageProps) {
  return (
    <main
      className={cn(
        "mx-auto grid min-h-dvh w-full max-w-md content-center justify-items-center gap-6 px-4 py-24 text-center",
        className,
      )}
    >
      <StatusIllustration variant={variant} />
      <div className="grid gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-balance">{title}</h1>
        <p className="text-muted-foreground text-pretty">{children}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">{actions}</div>
      {footnote && <p className="text-muted-foreground text-xs">{footnote}</p>}
    </main>
  );
}
