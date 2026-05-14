import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  ChaptersSection,
  DemoSections,
  FooterCtaSection,
  IndustryWordsearchSection,
  ProductPreviewSection,
  RoadmapPreviewSection,
  StatsSection,
  ToolCarouselSection,
  ValuePropsSection
} from "@/components/marketing/home-sections";
import { getSession } from "@/lib/auth/session";
import { resolveActiveOrg } from "@/lib/orgs/active";

export const metadata: Metadata = {
  title: "Cofounder — Run an entire company with agents",
  description: "Activate departments, build a roadmap, launch tasks, and keep humans in the loop. The company operating system, powered by agents."
};

export default async function HomePage() {
  const session = await getSession();
  const activeOrg = session.user ? await resolveActiveOrg(session.user.id) : null;
  const primaryHref = activeOrg
    ? `/org/${activeOrg.id}/canvas`
    : session.user
      ? "/onboarding"
      : "/login";
  const primaryLabel = session.user ? "Go to workspace" : "Run a company";

  return (
    <main className="bg-[var(--background)] text-[var(--foreground)]">
      {/* ── Cinematic video hero ── */}
      <section className="relative min-h-screen overflow-hidden bg-[var(--background)]">
        {/* Video background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
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
          >
            {primaryLabel}
          </Link>
        </div>
      </section>
      <StatsSection />
      <ProductPreviewSection />
      <ValuePropsSection />
      <ChaptersSection />
      <RoadmapPreviewSection />
      <DemoSections />
      <ToolCarouselSection />
      <IndustryWordsearchSection />
      <FooterCtaSection />
      <div className="sr-only">
        <Link href="/resources/introducing-cofounder-2">
          Launch article <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
