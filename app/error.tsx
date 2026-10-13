"use client";

import { useEffect } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { StatusPage, primaryButtonClass } from "@/components/status-page";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** An unexpected error on a page. The digest matches the error in Vercel's logs. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <SiteHeader />
      <StatusPage
        variant="error"
        title="Er ging iets mis"
        actions={
          <>
            <Button size="lg" onClick={() => retry()} className={primaryButtonClass}>
              Opnieuw proberen
            </Button>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-card dark:bg-card")}
            >
              Naar de kaart
            </Link>
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
        Deze pagina kon niet laden. Probeer het opnieuw. Lukt het dan nog niet, kom over een paar minuten terug.
      </StatusPage>
    </div>
  );
}
