import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { companyStats, demos, industryTerms, toolSystems, valueProps } from "@/data/marketing-content";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, FeatureCallout } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";
import { ChapterGrid } from "@/components/marketing/chapter-card";

export function MissionSection() {
  return (
    <>
      {/* Mission statement — white canvas, display-scale quote */}
      <section className="bg-[var(--background)] px-6 py-28 text-center">
        <p
          className="mx-auto max-w-3xl text-2xl font-bold leading-[1.2] tracking-[-0.5px] text-[var(--foreground)] sm:text-3xl md:text-4xl"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Our Mission is to build unified general intelligence that can generate, understand, and operate in the physical world.
        </p>
      </section>

      {/* Full-width cinematic image */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "21/9" }}>
        {/* Replace src with your image: <img src="/your-cinematic.jpg" alt="Mission visual" className="h-full w-full object-cover" /> */}
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1a2e]">
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-white/30">
            Drop your cinematic image here · 21 : 9
          </p>
        </div>
      </div>
    </>
  );
}

export function ProductPreviewSection() {
  return (
    <section className="bg-[var(--background)] py-24">
      <MarketingContainer className="grid gap-10">
        <SectionHeader label="Platform preview" title="A company map that can actually do the work." description="Departments orbit a central Cofounder. Chat lives on the side. Tasks show their real progress. Everything you need to run the business sits in one workspace." />
        {/* ── Product screenshot — replace src with your image (ratio 16:9) ── */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border-10)] bg-[var(--foreground-5)] shadow-[0_8px_40px_rgba(0,0,0,0.08)]" style={{ aspectRatio: '16/9' }}>
          {/* Replace the block below with: <img src="/your-screenshot.png" alt="Product preview" className="w-full h-full object-cover" /> */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--foreground-30)]">
            <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 15l-5-5L5 21" />
            </svg>
            <p className="font-mono text-xs tracking-[0.08em] uppercase">Add your screenshot here · 16 : 9</p>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function ValuePropsSection() {
  return (
    <section className="bg-[var(--background)] py-16">
      <MarketingContainer className="grid gap-8">
        <div className="grid gap-4 md:grid-cols-3">
          {valueProps.map((item) => {
            const Icon = item.icon;
            return (
              <FeatureCallout key={item.title} label="Core value" title={item.title} description={item.description}>
                <Icon aria-hidden="true" />
              </FeatureCallout>
            );
          })}
        </div>
      </MarketingContainer>
    </section>
  );
}

export function ChaptersSection() {
  return (
    <section className="bg-[var(--background)] py-24">
      <MarketingContainer className="grid gap-8">
        <SectionHeader label="How to" title="Four chapters for company building." description="Start, Build, Sell, and Scale — long-form guides that walk you through the founder's journey, from idea to billion-dollar company." />
        <ChapterGrid />
      </MarketingContainer>
    </section>
  );
}

export function RoadmapPreviewSection() {
  return (
    <section className="bg-[var(--background)] py-24">
      <MarketingContainer className="grid gap-10">
        <SectionHeader label="Roadmap" title="A tech tree for the company." description="Every milestone has dependencies, approval gates, and clear owners. Tasks unlock as the previous stage completes — so you always know what's next." />
        {/* ── Roadmap screenshot — replace src with your image (ratio 16:9) ── */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border-10)] bg-[var(--foreground-5)] shadow-[0_8px_40px_rgba(0,0,0,0.08)]" style={{ aspectRatio: '16/9' }}>
          {/* Replace the block below with: <img src="/your-roadmap-screenshot.png" alt="Roadmap preview" className="w-full h-full object-cover" /> */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--foreground-30)]">
            <svg width="40" height="40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
              <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 15l-5-5L5 21" />
            </svg>
            <p className="font-mono text-xs tracking-[0.08em] uppercase">Add your screenshot here · 16 : 9</p>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

export function DemoSections() {
  return (
    <section className="bg-[var(--background)] py-24">
      <MarketingContainer className="grid gap-6">
        {demos.map((demo) => {
          const Icon = demo.icon;
          return (
            <Card key={demo.title} className="grid gap-6 p-5 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
              <div className="grid gap-4">
                <Badge variant="brand">{demo.eyebrow}</Badge>
                <h2 className="text-[32px] font-normal leading-[1.15] tracking-[0px] text-[var(--foreground)]">{demo.title}</h2>
                <p className="text-[15px] leading-6 text-[var(--foreground-60)]">{demo.description}</p>
              </div>
              <div className="grid gap-3 rounded-[14px] bg-[var(--background)] p-4 border border-[var(--border-10)]">
                <div className="flex items-center gap-2 border-b border-[var(--border-10)] pb-3">
                  <Icon aria-hidden="true" className="size-5 text-[var(--focused)]" />
                  <span className="font-mono text-xs text-[var(--foreground-50)]">agent workspace</span>
                </div>
                {demo.bullets.map((bullet, index) => (
                  <div key={bullet} className="flex items-center justify-between rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0-85)] p-3">
                    <span className="text-sm text-[var(--foreground-80)]">{bullet}</span>
                    <StatusBadge status={index === demo.bullets.length - 1 ? "ready_to_review" : index === 0 ? "completed" : "running"} />
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </MarketingContainer>
    </section>
  );
}

export function ToolCarouselSection() {
  return (
    <section className="overflow-hidden bg-white py-20">
      <MarketingContainer className="grid gap-8">
        <SectionHeader label="Tools and systems" title="Every system, one workspace." description="GitHub, Vercel, Supabase, Stripe, Postiz, email, analytics — every tool your company needs lives behind a single status row so you always know what's connected, what's pending, and what needs attention." />
        <div className="flex w-max animate-[build-carousel-slide_24s_linear_infinite] gap-4 [animation-play-state:running] motion-reduce:animate-none">
          {[...toolSystems, ...toolSystems].map((tool, index) => {
            const Icon = tool.icon;
            return (
              <div key={`${tool.label}-${index}`} className="grid w-[240px] gap-3 rounded-[14px] border border-[var(--border-10)] bg-[var(--background)] p-4">
                <Icon aria-hidden="true" className="size-5 text-[var(--foreground-80)]" />
                <h3 className="font-medium text-[var(--foreground-80)]">{tool.label}</h3>
                <p className="text-sm leading-6 text-[var(--foreground-50)]">{tool.detail}</p>
                <Badge variant={tool.status === "Ready" ? "success" : tool.status === "Setup" ? "warning" : "neutral"}>{tool.status}</Badge>
              </div>
            );
          })}
        </div>
      </MarketingContainer>
    </section>
  );
}

export function IndustryWordsearchSection() {
  return (
    <section className="bg-[var(--background)] py-24">
      <MarketingContainer className="grid gap-8">
        <SectionHeader label="Industries" title="The system starts with the company, not a template." description="AI platforms, recruiting firms, voice agents, newsletters, growth agencies — the work shape is different for every wedge. Cofounder adapts the agents to yours." />
        <div className="grid gap-3 rounded-[16px] border border-[var(--border-10)] bg-[var(--background-l0)] p-5 sm:grid-cols-2 md:grid-cols-5">
          {industryTerms.map((term, index) => (
            <span
              key={term}
              className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-3 text-center font-mono text-xs text-[var(--foreground-60)]"
              style={{ animation: index % 2 === 0 ? "wordsearch-stroke-cw 12s linear infinite" : "wordsearch-stroke-ccw 12s linear infinite" }}
            >
              {term}
            </span>
          ))}
        </div>
      </MarketingContainer>
    </section>
  );
}

export function StatsSection() {
  return (
    <section className="bg-[var(--background)] py-16">
      <MarketingContainer className="grid gap-4 md:grid-cols-4">
        {companyStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="grid gap-2 p-4">
              <Icon aria-hidden="true" className="size-5 text-[var(--tt-color-text-blue)]" />
              <div className="text-3xl font-normal tracking-[0px]">{stat.value}</div>
              <div className="text-sm text-[var(--foreground-60)]">{stat.label}</div>
            </Card>
          );
        })}
      </MarketingContainer>
    </section>
  );
}

export function FooterCtaSection() {
  return (
    <section className="bg-[var(--background)] py-24">
      <MarketingContainer>
        <div className="grid gap-5 rounded-[16px] border border-[var(--border-10)] bg-[var(--background-l0)] p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Ready to start</p>
          <h2 className="mx-auto max-w-[16ch] text-[40px] font-normal leading-[1.12] tracking-[0px]">Run your first company loop today.</h2>
          <p className="mx-auto max-w-[56ch] text-[15px] leading-6 text-[var(--foreground-60)]">
            Sign up, describe your idea, accept the business plan, and watch your eight departments activate. You&apos;ll be assigning your first agent task in under five minutes.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[#fdf8f0] px-5 py-2 text-sm font-semibold text-[#1a1917] transition-all duration-300 hover:scale-[1.03] hover:bg-white"
            >
              Run a company
            </Link>
            <Link href="/resources/introducing-cofounder-2" className="inline-flex items-center gap-1 text-sm text-[var(--foreground-60)]">
              Read the launch post <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}

function SectionHeader({ label, title, description, invert = false }: { label: string; title: string; description: string; invert?: boolean }) {
  return (
    <div className="grid max-w-[680px] gap-3">
      <p className={`font-mono text-xs uppercase tracking-[0.08em] ${invert ? "text-white/60" : "text-[var(--foreground-50)]"}`}>{label}</p>
      <h2 className={`text-[40px] font-normal leading-[1.15] tracking-[0px] ${invert ? "text-white" : "text-[var(--foreground)]"}`}>{title}</h2>
      <p className={`text-[15px] leading-6 ${invert ? "text-white/72" : "text-[var(--foreground-60)]"}`}>{description}</p>
    </div>
  );
}
