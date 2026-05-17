import type { Metadata } from "next";
import { headers } from "next/headers";
import { EB_Garamond, Figtree, IBM_Plex_Mono, Pixelify_Sans } from "next/font/google";
import { cn } from "@/lib/utils/cn";
import { Toaster } from "sonner";
import "@xyflow/react/dist/style.css";
import "@/styles/globals.css";

/* ============================================================
   Section C — Typography font loading (Slice 1)

   Six font families are required by the spec. Four are available
   via next/font/google; the remaining two (ppmondwest, Departure
   Mono) are proprietary and have no Google Fonts source.

   Loaded via next/font/google:
     - Figtree         → --font-figtree         (primary UI)
     - IBM Plex Mono   → --font-ibm-plex-mono   (code / badges)
     - Pixelify Sans   → --font-pixelify-sans   (pixel-art overlays)
     - EB Garamond     → --font-eb-garamond     (editorial / login)

   Declared as font-family literals in tokens.css :root, see
   `--font-ppmondwest` and `--font-departure-mono`:
     - ppmondwest      → --font-ppmondwest      (brand headlines)
     - Departure Mono  → --font-departure-mono  (roadmap labels)

   All six are then composed into Section-C-aligned family stacks
   under `--font-*-stack` in tokens.css.
   ============================================================ */

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap"
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap"
});

const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  variable: "--font-pixelify-sans",
  display: "swap"
});

const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Cofounder — Run an entire company with agents",
    template: "%s · Cofounder"
  },
  description:
    "Cofounder is an AI company operating system. Activate departments, build a roadmap, launch tasks, and keep humans in the loop — your whole company in one workspace.",
  applicationName: "Cofounder",
  keywords: ["AI agents", "company operating system", "founders", "automation", "Cofounder"],
  openGraph: {
    title: "Cofounder — Run an entire company with agents",
    description:
      "Activate departments, build a roadmap, launch tasks, and keep humans in the loop.",
    type: "website"
  }
};

/*
 * Slice 3 — dual-mode theme activation.
 *
 * The middleware (src/middleware.ts) stamps every request with an
 * `x-theme` response header ("light" | "dark") based on the route.
 * This async Server Component reads that header and applies the
 * corresponding class to <html> in the SSR output, so the correct
 * theme tokens are active before hydration — no flash.
 *
 * Light routes:  /, /login, /onboarding, /pricing, /resources,
 *                /how-to/*, /privacy-policy, /terms, /docs, /referrals
 * Dark  routes:  everything else (app shell, canvas, settings, etc.)
 */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  const theme = headersList.get("x-theme") ?? "dark";

  return (
    <html lang="en" className={theme} suppressHydrationWarning>
      <body
        className={cn(
          figtree.variable,
          ibmPlexMono.variable,
          pixelifySans.variable,
          ebGaramond.variable
        )}
        suppressHydrationWarning
      >
        {children}
        <Toaster position="bottom-right" richColors closeButton theme={theme === "dark" ? "dark" : "light"} />
      </body>
    </html>
  );
}
