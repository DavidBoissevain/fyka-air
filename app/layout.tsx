import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_URL } from "@/lib/links";
import { figtree, geistMono } from "./fonts";
import "./globals.css";

const DESCRIPTION =
  "Hoe schoon is de lucht bij jou? Elk uur de luchtkwaliteit in Nederland op de kaart, op basis van open data van het RIVM.";

// Pages set their own title and canonical; the share preview image is
// app/opengraph-image.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Fyka Air",
  description: DESCRIPTION,
  applicationName: "Fyka Air",
  openGraph: {
    type: "website",
    siteName: "Fyka Air",
    locale: "nl_NL",
    title: "Fyka Air",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

// The browser bar follows the theme's background.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEF1F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      // next-themes sets the theme class before hydration.
      suppressHydrationWarning
      className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
