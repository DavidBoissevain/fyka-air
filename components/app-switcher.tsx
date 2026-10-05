"use client";

import { useEffect, useRef, useState } from "react";

import { AirMark } from "./air-mark";
import { NotesMark, RetroMark, VotesMark } from "./app-marks";
import { controlButtonClass } from "./control-button";
import { NOTES_URL, RETRO_URL, VOTES_URL } from "@/lib/links";

type App = {
  name: string;
  href: string;
  external: boolean;
  tile: React.ReactNode;
};

const apps: App[] = [
  { name: "Fyka Air", href: "/", external: false, tile: <AirMark /> },
  { name: "Fyka Notes", href: NOTES_URL, external: true, tile: <NotesMark /> },
  { name: "Fyka Retro", href: RETRO_URL, external: true, tile: <RetroMark /> },
  { name: "Fyka Votes", href: VOTES_URL, external: true, tile: <VotesMark /> },
];

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${controlButtonClass} hover:scale-105 active:scale-95`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="5" r="2" />
          <circle cx="12" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="12" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
        <span className="sr-only">Wissel van app</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Fyka-apps"
          className="border-border bg-background absolute right-0 z-50 mt-2 w-max rounded-xl border p-4 shadow-xl"
        >
          {/* flex, not grid-cols-3: Tailwind's grid-cols-3 is
              repeat(3, minmax(0,1fr)), and in a shrink-to-fit absolutely
              positioned box those columns collapse to zero width, which
              piles the tiles on top of each other. */}
          <div className="flex gap-2">
            {apps.map((app) => (
              <a
                key={app.name}
                href={app.href}
                {...(app.external && { target: "_blank", rel: "noopener noreferrer" })}
                role="menuitem"
                className="hover:bg-card flex w-24 shrink-0 flex-col items-center gap-2 rounded-xl p-2 transition-colors"
                onClick={() => setOpen(false)}
              >
                {app.tile}
                <span className="text-muted-foreground text-center text-xs font-medium whitespace-nowrap">
                  {app.name}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
