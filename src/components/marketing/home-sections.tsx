import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { footerLinks } from "@/data/marketing-content";
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
          Founders drown in execution across 8 departments while their vision waits.<br />We believe there&apos;s a better way: AI agents that execute, so founders can lead.
        </p>
      </section>

      {/* Full-width cinematic image with text overlays */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "21/9" }}>
        {/* Image */}
        <img src="/second.jpg" alt="Mission visual" className="absolute inset-0 h-full w-full object-cover" />

        {/* Left text — over bright sky — dark navy palette */}
        <div className="absolute inset-y-0 left-[13%] flex w-[38%] flex-col justify-center gap-4 px-6 py-6">
          {[
            { head: "See everything", body: "Session replay shows exactly what agents did" },
            { head: "Own everything", body: "Data stays on your hardware, never shared" },
            { head: "Control everything", body: "Approve before agents execute" },
            { head: "Connect everything", body: "Departments hand off seamlessly" },
            { head: "Founder to $5K MRR", body: "In 6 months instead of 12–18 months" }
          ].map(({ head, body }) => (
            <div key={head} className="flex items-start gap-3">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: "#1a3a6e" }} />
              <p className="leading-6" style={{ textShadow: "0 1px 3px rgba(255,255,255,0.4)" }}>
                <span
                  className="block text-[15px] font-semibold tracking-[-0.2px]"
                  style={{ fontFamily: "'Instrument Serif', serif", color: "#0f1f3d", fontSize: "17px" }}
                >
                  {head}
                </span>
                <span className="text-[13px] leading-5" style={{ color: "#1e3560cc" }}>{body}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Right text — over dark starfield — warm gold palette */}
        <div className="absolute inset-y-0 right-0 flex w-[38%] flex-col justify-center gap-4 px-10 py-6">
          {[
            { head: "32-task roadmap", body: "Guiding founders from Idea to Scale" },
            { head: "8 specialized agents", body: "One per department with approval gates" },
            { head: "Design once, inject everywhere", body: "Brand Kit flows through all departments" },
            { head: "Unified workspace", body: "Replacing chaos with clarity" },
            { head: "Structured execution", body: "Founder-controlled decisions" }
          ].map(({ head, body }) => (
            <div key={head} className="flex items-start gap-3">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: "#c9a96e" }} />
              <p className="leading-6" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                <span
                  className="block font-semibold tracking-[-0.2px]"
                  style={{ fontFamily: "'Instrument Serif', serif", color: "#f2deb0", fontSize: "17px" }}
                >
                  {head}
                </span>
                <span className="text-[13px] leading-5" style={{ color: "#d4bc8acc" }}>{body}</span>
              </p>
            </div>
          ))}
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
        <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border-10)] shadow-[0_8px_40px_rgba(0,0,0,0.08)]" style={{ aspectRatio: '16/9' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src="/vdo1.mp4" type="video/mp4" />
          </video>
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
        <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border-10)] shadow-[0_8px_40px_rgba(0,0,0,0.08)]" style={{ aspectRatio: '16/9' }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src="/vdo2.mp4" type="video/mp4" />
          </video>
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
    <section className="relative overflow-hidden py-24">
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/middle.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/60" />

      <MarketingContainer className="relative z-10 grid gap-10">
        <SectionHeader
          label="Tools and systems"
          title="Every system, one workspace."
          description="GitHub, Vercel, Supabase, Stripe, Postiz, email, analytics — every tool your company needs lives behind a single status row so you always know what's connected, what's pending, and what needs attention."
          invert
        />
        <div className="flex w-max animate-[build-carousel-slide_24s_linear_infinite] gap-5 [animation-play-state:running] motion-reduce:animate-none">
          {[...toolSystems, ...toolSystems].map((tool, index) => {
            const Icon = tool.icon;
            return (
              <div
                key={`${tool.label}-${index}`}
                className="grid w-[260px] gap-3 rounded-[16px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm"
                style={{ background: "rgba(255,255,255,0.07)" }}
              >
                <Icon aria-hidden="true" className="size-5 text-white/80" />
                <h3 className="font-medium text-white">{tool.label}</h3>
                <p className="text-sm leading-6 text-white/50">{tool.detail}</p>
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
    <section className="relative overflow-hidden py-32">
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/footer.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay so text remains readable */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Content */}
      <MarketingContainer className="relative z-10">
        <div className="grid gap-6 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-white/50">Ready to start</p>
          <h2
            className="mx-auto max-w-[16ch] text-[44px] font-normal leading-[1.1] tracking-[-0.5px] text-white sm:text-5xl"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Run your first company loop today.
          </h2>
          <p className="mx-auto max-w-[52ch] text-[15px] leading-7 text-white/60">
            Sign up, describe your idea, accept the business plan, and watch your eight departments activate. You&apos;ll be assigning your first agent task in under five minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-[#1a1917] transition-all duration-300 hover:scale-[1.03] hover:bg-white/90"
            >
              Run a company
            </Link>
            <Link
              href="https://discord.gg/yvjur4qj"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-6 py-2.5 text-sm transition-all hover:border-white/60"
              style={{ color: "white" }}
            >
              Join Community <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>

        {/* Footer bar — inside the video section */}
        <div className="mt-20 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-white/40 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-white/70">
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <span>SOC 2 compliant security</span>
            <span>Original design system</span>
            <span>© 2026 Cofounder</span>
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
