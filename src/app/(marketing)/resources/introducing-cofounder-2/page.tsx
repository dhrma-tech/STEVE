import type { Metadata } from "next";
import Link from "next/link";
import { launchArticleSections, resourcesPosts } from "@/data/marketing-content";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MarketingContainer } from "@/components/ui/container";

const launchPost = resourcesPosts.find((post) => post.slug === "introducing-cofounder-2") ?? resourcesPosts[0];

export const metadata: Metadata = {
  title: "Announcing Cofounder 2",
  description: launchPost.excerpt
};

export default function LaunchPostPage() {
  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer className="grid gap-10">
        <article className="mx-auto grid max-w-[820px] gap-8">
          <header className="grid gap-4">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">
              {launchPost.category} / {launchPost.date}
            </p>
            <h1 className="text-[44px] font-normal leading-[1.12] tracking-[0px]">{launchPost.title}</h1>
            <p className="text-[16px] leading-7 text-[var(--foreground-60)]">{launchPost.excerpt}</p>
          </header>

          <div className="h-[360px] rounded-[16px] border border-[var(--border-10)] bg-[linear-gradient(135deg,#d8f999,#d7e8ff_42%,#f0abfc_74%,#fff3c9)] [image-rendering:pixelated]" />

          <div className="grid gap-6">
            {launchArticleSections.map((section) => (
              <section key={section.heading} className="grid gap-3">
                <h2 className="text-[28px] font-normal leading-[1.15] tracking-[0px]">{section.heading}</h2>
                <p className="text-[15px] leading-7 text-[var(--foreground-60)]">{section.body}</p>
              </section>
            ))}
          </div>

          <Card className="grid gap-4 p-5 text-center">
            <h2 className="text-[28px] font-normal leading-[1.15] tracking-[0px]">Launch your company workspace.</h2>
            <p className="text-sm leading-6 text-[var(--foreground-60)]">
              Sign in with GitHub, walk through onboarding, and activate every department in one sitting.
            </p>
            <div className="flex justify-center">
              <Link href="/login" className={buttonClassName({ variant: "dark" })}>
                Run a company
              </Link>
            </div>
          </Card>
        </article>
      </MarketingContainer>
    </main>
  );
}
