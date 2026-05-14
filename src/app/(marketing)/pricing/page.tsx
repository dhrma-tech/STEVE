import type { Metadata } from "next";
import Link from "next/link";
import { pricingFaq, pricingPlans } from "@/data/pricing";
import { FeatureComparison } from "@/components/marketing/feature-comparison";
import { PricingCalculator } from "@/components/marketing/pricing-calculator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { buttonClassName } from "@/components/ui/button";
import { Card, PricingCard } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple plans that grow with your company — usage-based pricing, a free trial, and full data graduation when you're ready."
};

export default function PricingPage() {
  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="grid gap-14">
        <header className="mx-auto grid max-w-[720px] gap-4 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Pricing</p>
          <h1 className="text-[40px] font-normal leading-[1.15] tracking-[0px]">Start simple. Grow without limits.</h1>
          <p className="text-[16px] leading-7 text-[var(--foreground-60)]">
            Start with a free trial, scale to Pro as you ship, and join the Team plan when you&apos;re ready for multiplayer and SOC 2.
          </p>
        </header>

        <section className="grid justify-items-center gap-5 lg:grid-cols-3 lg:items-start">
          {pricingPlans.map((plan) => (
            <PricingCard
              key={plan.id}
              title={plan.name}
              price={plan.price}
              period={plan.period}
              description={`${plan.description} ${plan.usageIncluded}.`}
              features={plan.features}
              ctaLabel={plan.cta}
              highlighted={plan.highlighted}
            />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <PricingCalculator />
          <Card className="grid content-center gap-4 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Data graduation</p>
            <h2 className="text-[32px] font-normal leading-[1.15] tracking-[0px]">GitHub, Supabase, and Vercel stay portable.</h2>
            <p className="text-[15px] leading-7 text-[var(--foreground-60)]">
              We manage your repository, database, and deployments so you can ship from day one — and hand the keys back whenever you want. Graduate to your own GitHub, Supabase, and Vercel accounts with one click.
            </p>
            <Link href="/docs" className={buttonClassName({ variant: "dark" })}>
              Read docs
            </Link>
          </Card>
        </section>

        <section className="grid gap-5">
          <h2 className="text-[32px] font-normal leading-[1.15] tracking-[0px]">Feature comparison</h2>
          <FeatureComparison />
        </section>

        <section className="mx-auto grid w-full max-w-[740px] gap-4">
          <h2 className="text-center text-[32px] font-normal leading-[1.15] tracking-[0px]">FAQ</h2>
          <Accordion type="single" collapsible>
            {pricingFaq.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </MarketingContainer>
    </main>
  );
}
