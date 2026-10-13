"use client";

import { useEffect } from "react";

import { StatusPage, primaryButtonClass } from "@/components/status-page";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { figtree, geistMono } from "./fonts";
import "./globals.css";

/**
 * An error in the root layout itself. It replaces the layout, so it brings its
 * own document, styles and fonts, and has no theme toggle; it follows the
 * viewer's saved theme (next-themes' "theme" key) or the system setting.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    let theme: string | null = null;
    try {
      theme = localStorage.getItem("theme");
    } catch {}
    const dark = theme === "dark" || (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, [error]);

  return (
    <html lang="nl" className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="bg-background text-foreground min-h-full font-sans">
        <title>Er ging iets mis · Luchtmeter</title>
        <StatusPage
          variant="error"
          title="Er ging iets mis"
          actions={
            <>
              <Button size="lg" onClick={() => retry()} className={primaryButtonClass}>
                Opnieuw proberen
              </Button>
              {/* A full reload, since the app itself failed to start. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- client navigation needs the app that just failed */}
              <a href="/" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-card dark:bg-card")}>
                Naar de kaart
              </a>
            </>
          }
          footnote={
            error.digest && (
              <>
                Foutcode: <span className="font-mono select-all">{error.digest}</span>
              </>
            )
          }
        >
          Luchtmeter kon niet laden. Probeer het opnieuw. Lukt het dan nog niet, kom over een paar minuten terug.
        </StatusPage>
      </body>
    </html>
  );
}
