import { Check, Minus } from "lucide-react";
import { featureComparison } from "@/data/pricing";
import { Card } from "@/components/ui/card";

export function FeatureComparison() {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.3fr_repeat(3,0.9fr)] border-b border-[var(--color-border-card)] bg-[var(--background)] text-sm font-medium text-[var(--color-ink-strong)]">
        <div className="p-3">Feature</div>
        <div className="p-3">Trial</div>
        <div className="p-3">Pro</div>
        <div className="p-3">Team</div>
      </div>
      {featureComparison.map((row) => (
        <div key={row.feature} className="grid grid-cols-[1.3fr_repeat(3,0.9fr)] border-b border-[var(--color-border-card)] text-sm last:border-0">
          <div className="p-3 text-[var(--color-ink-strong)]">{row.feature}</div>
          <Cell value={row.trial} />
          <Cell value={row.pro} />
          <Cell value={row.team} />
        </div>
      ))}
    </Card>
  );
}

function Cell({ value }: { value: string }) {
  const positive = !/not|coming/i.test(value);
  return (
    <div className="flex items-center gap-2 p-3 text-[var(--color-ink-muted)]">
      {positive ? <Check aria-hidden="true" className="size-4 text-[var(--color-feature-success)]" /> : <Minus aria-hidden="true" className="size-4 text-[var(--color-feature-neutral)]" />}
      <span>{value}</span>
    </div>
  );
}

