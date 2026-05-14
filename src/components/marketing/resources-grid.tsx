import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { resourcesPosts } from "@/data/marketing-content";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function ResourcesGrid() {
  const featured = resourcesPosts.find((post) => post.featured) ?? resourcesPosts[0];
  const rest = resourcesPosts.filter((post) => post.slug !== featured.slug);

  return (
    <div className="grid gap-8">
      <Link href={`/resources/${featured.slug}`} className="group outline-none focus-visible:ring-2 focus-visible:ring-[var(--focused)]">
        <Card className="grid gap-6 overflow-hidden p-4 transition-transform group-hover:-translate-y-1 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="min-h-[260px] rounded-[8px] bg-[linear-gradient(135deg,#d8f999,#d7e8ff_48%,#f0abfc)] [image-rendering:pixelated]" />
          <div className="grid content-center gap-3 p-2">
            <Badge variant="brand">{featured.category}</Badge>
            <p className="font-mono text-xs text-[var(--foreground-50)]">{featured.date}</p>
            <h2 className="text-[32px] font-normal leading-[1.15] tracking-[0px] text-[var(--foreground)]">{featured.title}</h2>
            <p className="text-[15px] leading-6 text-[var(--foreground-60)]">{featured.excerpt}</p>
            <span className="inline-flex items-center gap-2 text-sm text-[var(--foreground-80)]">
              Read post <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </div>
        </Card>
      </Link>

      <div className="grid gap-4 md:grid-cols-2">
        {rest.map((post) => (
          <Card key={post.slug} className="grid gap-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <Badge>{post.category}</Badge>
              <span className="font-mono text-xs text-[var(--foreground-50)]">{post.date}</span>
            </div>
            <h3 className="text-xl font-medium tracking-[0px]">{post.title}</h3>
            <p className="text-sm leading-6 text-[var(--foreground-60)]">{post.excerpt}</p>
            <span className="text-sm text-[var(--foreground-50)]">Observed post card</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

