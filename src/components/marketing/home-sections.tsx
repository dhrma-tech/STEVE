import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { companyStats, demos, industryTerms, roadmapPreview, toolSystems, valueProps } from "@/data/marketing-content";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Card, FeatureCallout } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";
import { ChapterGrid } from "@/components/marketing/chapter-card";
import { OrbitPreview } from "@/components/marketing/orbit-preview";

export function ProductPreviewSection() {
  return (
    <section className="bg-[var(--background)] py-24">
      <MarketingContainer className="grid gap-8">
        <SectionHeader label="Platform preview" title="A company map that can actually do the work." description="Departments orbit a central Cofounder. Chat lives on the side. Tasks show their real progress. Everything you need to run the business sits in one workspace." />
        <OrbitPreview />
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
      <MarketingContainer className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <SectionHeader label="Roadmap" title="A tech tree for the company." description="Every milestone has dependencies, approval gates, and clear owners. Tasks unlock as the previous stage completes — so you always know what's next." />
        <div className="grid gap-3">
          {roadmapPreview.map((item) => (
            <Card key={`${item.stage}-${item.task}`} variant="app" className="grid gap-3 rounded-[14px] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={item.status === "Complete" ? "success" : item.status === "Available" ? "running" : "neutral"}>{item.stage}</Badge>
                <span className="font-mono text-xs text-[var(--app-text-50)]">{item.type}</span>
              </div>
              <h3 className="text-lg font-medium tracking-[0px]">{item.task}</h3>
              <p className="text-sm text-[var(--app-text-50)]">{item.status}</p>
            </Card>
          ))}
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
              <div className="grid gap-3 rounded-[14px] bg-[var(--app-canvas)] p-4 text-[var(--app-text)]">
                <div className="flex items-center gap-2 border-b border-[var(--app-border)] pb-3">
                  <Icon aria-hidden="true" className="size-5 text-[var(--focused)]" />
                  <span className="font-mono text-xs text-[var(--app-text-50)]">agent workspace</span>
                </div>
                {demo.bullets.map((bullet, index) => (
                  <div key={bullet} className="flex items-center justify-between rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
                    <span className="text-sm">{bullet}</span>
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
    <section className="overflow-hidden bg-[var(--tt-color-text-blue)] py-20 text-white">
      <MarketingContainer className="grid gap-8">
        <SectionHeader label="Tools and systems" title="Every system, one workspace." description="GitHub, Vercel, Supabase, Stripe, Postiz, email, analytics — every tool your company needs lives behind a single status row so you always know what's connected, what's pending, and what needs attention." invert />
        <div className="flex w-max animate-[build-carousel-slide_24s_linear_infinite] gap-4 [animation-play-state:running] motion-reduce:animate-none">
          {[...toolSystems, ...toolSystems].map((tool, index) => {
            const Icon = tool.icon;
            return (
              <div key={`${tool.label}-${index}`} className="grid w-[240px] gap-3 rounded-[14px] border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                <Icon aria-hidden="true" className="size-5" />
                <h3 className="font-medium">{tool.label}</h3>
                <p className="text-sm leading-6 text-white/70">{tool.detail}</p>
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
            <Link href="/login" className={buttonClassName({ variant: "dark" })}>
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
