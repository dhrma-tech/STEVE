import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { NotificationWheel } from "@/components/marketing/notification-wheel";
import { HeroPixelScene } from "@/components/marketing/pixel-art";
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
import { buttonClassName } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Cofounder - Run an entire company with agents",
  description: "A Cofounder.co-style company operating system with departments, agents, roadmap, files, and founder approval."
};

export default function HomePage() {
  return (
    <main className="bg-[var(--background)] text-[var(--foreground)]">
      <section className="relative min-h-[914px] overflow-hidden">
        <HeroPixelScene />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.34),rgba(0,0,0,0.08)_52%,rgba(0,0,0,0))]" />
        <div className="absolute inset-x-0 top-0 mx-auto grid max-w-[1440px] gap-8 px-5 pt-[max(15dvh,92px)] text-white max-[500px]:pt-[166px]">
          <div className="grid max-w-[580px] gap-5">
            <h1 className="animate-[hero-enter_580ms_ease-out_100ms_forwards] text-[46px] font-normal leading-[1.08] tracking-[0px] opacity-0 max-[900px]:text-[38px] max-[500px]:text-[34px]">
              Run an entire company with agents.
            </h1>
            <p className="animate-[hero-enter_580ms_ease-out_500ms_forwards] max-w-[56ch] text-[16px] font-[460] leading-[1.4] tracking-[0.15px] text-white/82 opacity-0">
              Activate departments, build a roadmap, launch tasks, review agent work, and keep every company system in one operating surface.
            </p>
            <div className="flex flex-wrap gap-3 opacity-0 animate-[float-btn-spring_760ms_ease-out_900ms_forwards]">
              <Link href="/login" className={buttonClassName({ variant: "light" })}>
                Run a company
              </Link>
              <Link href="/resources/introducing-cofounder-2" className={buttonClassName({ variant: "dark" })}>
                <Play aria-hidden="true" className="size-4" />
                Check out the launch
              </Link>
            </div>
          </div>
          <div className="ml-auto mt-8 hidden md:block">
            <NotificationWheel />
          </div>
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
