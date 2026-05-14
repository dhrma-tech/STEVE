import { Check, Minus } from "lucide-react";
import { featureComparison } from "@/data/pricing";
import { Card } from "@/components/ui/card";

export function FeatureComparison() {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[1.3fr_repeat(3,0.9fr)] border-b border-[var(--border-10)] bg-[var(--background)] text-sm font-medium text-[var(--foreground-80)]">
        <div className="p-3">Feature</div>
        <div className="p-3">Trial</div>
        <div className="p-3">Pro</div>
        <div className="p-3">Team</div>
      </div>
      {featureComparison.map((row) => (
        <div key={row.feature} className="grid grid-cols-[1.3fr_repeat(3,0.9fr)] border-b border-[var(--border-10)] text-sm last:border-0">
          <div className="p-3 text-[var(--foreground-80)]">{row.feature}</div>
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
    <div className="flex items-center gap-2 p-3 text-[var(--foreground-60)]">
      {positive ? <Check aria-hidden="true" className="size-4 text-[var(--success-100)]" /> : <Minus aria-hidden="true" className="size-4 text-[var(--foreground-40)]" />}
      <span>{value}</span>
    </div>
  );
}

