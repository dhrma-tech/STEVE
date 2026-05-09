import type { Metadata } from "next";
import { Figtree, IBM_Plex_Mono, Pixelify_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "@/styles/globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap"
});

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
  variable: "--font-pixelify",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Cofounder Build",
  description: "An AI company operating system built from the Cofounder.co source notes."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${figtree.variable} ${ibmPlexMono.variable} ${pixelifySans.variable}`}>
        {children}
      </body>
    </html>
  );
}
