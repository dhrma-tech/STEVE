import { Map, Rocket } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { DepartmentDetailData } from "@/lib/departments/data";

type DepartmentDetail = NonNullable<DepartmentDetailData>;

export function DepartmentRoadmapStrip({ items }: { items: DepartmentDetail["roadmapItems"] }) {
  if (!items.length) {
    return (
      <EmptyState
        surface="dark"
        icon={<Map aria-hidden="true" className="size-4" />}
        title="No roadmap items yet"
        description="This department has no linked roadmap work in the current company stage."
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Roadmap strip</h3>
        <Badge variant="neutral">{items.length} linked</Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <article key={item.id} className="min-w-[180px] rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge variant={roadmapVariant(item.status)}>{item.status}</Badge>
              <Rocket aria-hidden="true" className="size-4 text-[var(--app-text-50)]" />
            </div>
            <h4 className="mt-3 line-clamp-2 text-sm font-medium">{item.title}</h4>
            <p className="mt-2 truncate text-xs text-[var(--app-text-50)]">{item.stage}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function roadmapVariant(status: string): BadgeVariant {
  if (status === "complete") return "success";
  if (status === "available") return "running";
  if (status === "locked") return "neutral";
  return "warning";
}
