import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { StatusPage, primaryButtonClass } from "@/components/status-page";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pagina niet gevonden · Fyka Air",
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <SiteHeader />
      <StatusPage
        variant="lost"
        title="Deze pagina is weggewaaid"
        actions={
          <Link href="/" className={cn(buttonVariants({ size: "lg" }), primaryButtonClass)}>
            Naar de kaart
          </Link>
        }
      >
        Het adres klopt niet, of de pagina bestaat niet meer. De kaart met de luchtkwaliteit staat gewoon voor je klaar.
      </StatusPage>
    </div>
  );
}
