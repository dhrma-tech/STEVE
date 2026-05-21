import type { Metadata } from "next";
import Link from "next/link";
import {
  ChaptersSection,
  DemoSections,
  FooterCtaSection,
  IndustryWordsearchSection,
  MissionSection,
  ProductPreviewSection,
  RoadmapPreviewSection,
  ToolCarouselSection
} from "@/components/marketing/home-sections";
export const metadata: Metadata = {
  title: "Cofounder — Run an entire company with agents",
  description: "Activate departments, build a roadmap, launch tasks, and keep humans in the loop. The company operating system, powered by agents."
};

export default function HomePage() {
  const primaryHref = "/login";
  const primaryLabel = "Run a company";

  return (
    <main className="bg-[var(--background)] text-[var(--foreground)]">
      {/* ── Cinematic video hero ── */}
      <section className="relative min-h-screen overflow-hidden bg-[var(--background)]">
        {/* Video background */}
        {/* Hero video — poster="/hero-poster.jpg" shown while video loads (recommended: 1920×1080 JPG) */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/hero-poster.jpg"
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
            type="video/mp4"
          />
        </video>

        {/* Centered content */}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <h1
            className="animate-fade-rise max-w-7xl text-5xl font-normal leading-[0.95] tracking-[-2.46px] text-white sm:text-7xl md:text-8xl"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Where{" "}
            <em className="not-italic text-white/55">dreams rise</em>{" "}
            through the{" "}
            <em className="not-italic text-white/55">silence.</em>
          </h1>

          <p className="animate-fade-rise-delay mt-8 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
            We&apos;re designing tools for deep thinkers, bold creators, and quiet rebels.
            Amid the chaos, we build digital spaces for sharp focus and inspired work.
          </p>

          <Link
            href={primaryHref}
            className="animate-fade-rise-delay-2 liquid-glass mt-12 rounded-full px-14 py-5 text-base text-white transition-transform duration-300 hover:scale-[1.03]"
            style={{ color: "white" }}
          >
            {primaryLabel}
          </Link>
        </div>
      </section>
      <MissionSection />
      <ProductPreviewSection />
      <ChaptersSection />
      <RoadmapPreviewSection />
      <DemoSections />
      <ToolCarouselSection />
      <IndustryWordsearchSection />
      <FooterCtaSection />
      <div className="sr-only">
        <Link href="/resources/introducing-cofounder-2">Launch article</Link>
      </div>
    </main>
  );
}
