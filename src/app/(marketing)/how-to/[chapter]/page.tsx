import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { howToChapters, howToSlugs, type HowToChapterSlug } from "@/data/how-to-content";
import { HowToRenderer } from "@/components/marketing/how-to-renderer";
import { MarketingContainer } from "@/components/ui/container";

type PageProps = {
  params: Promise<{ chapter: string }>;
};

export function generateStaticParams() {
  return howToSlugs.map((chapter) => ({ chapter }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { chapter } = await params;
  const content = howToChapters[chapter as HowToChapterSlug];

  if (!content) {
    return { title: "Guide not found" };
  }

  return {
    title: `How to ${content.title}`,
    description: content.intro
  };
}

export default async function HowToPage({ params }: PageProps) {
  const { chapter } = await params;
  const content = howToChapters[chapter as HowToChapterSlug];

  if (!content) {
    notFound();
  }

  return (
    <main className="bg-[var(--background)] pb-24 pt-[130px] text-[var(--foreground)]">
      <MarketingContainer>
        <HowToRenderer chapter={content} />
      </MarketingContainer>
    </main>
  );
}

