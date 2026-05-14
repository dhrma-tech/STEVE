"use client";

import * as React from "react";
import type { PlanId } from "@/data/pricing";
import { pricingPlans } from "@/data/pricing";
import { calculatePricing, type PricingBreakdown } from "@/lib/pricing/calculator";
import { Card } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SliderField } from "@/components/ui/slider";

const rows: Array<{ key: keyof PricingBreakdown; label: string; format?: "money" | "number" }> = [
  { key: "includedUsage", label: "Included usage", format: "money" },
  { key: "numberOfAgents", label: "Number of agents", format: "number" },
  { key: "tokenCost", label: "Token cost", format: "money" },
  { key: "computeCost", label: "Compute cost", format: "money" },
  { key: "databaseCost", label: "Database cost", format: "money" },
  { key: "customerSupport", label: "Customer support", format: "money" },
  { key: "adSpend", label: "Ad spend", format: "money" },
  { key: "dataPurchasing", label: "Data purchasing", format: "money" },
  { key: "totalMonthlyCost", label: "Total monthly cost", format: "money" }
];

export function PricingCalculator() {
  const [plan, setPlan] = React.useState<PlanId>("pro");
  const [businessSize, setBusinessSize] = React.useState(3);
  const [breakdown, setBreakdown] = React.useState<PricingBreakdown>(() => calculatePricing({ plan, businessSize }));

  React.useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/pricing/calculate?plan=${plan}&businessSize=${businessSize}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((payload: { data?: PricingBreakdown }) => {
        if (payload.data) {
          setBreakdown(payload.data);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setBreakdown(calculatePricing({ plan, businessSize }));
        }
      });

    return () => controller.abort();
  }, [plan, businessSize]);

  return (
    <Card className="grid gap-6 p-5">
      <div className="grid gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--foreground-50)]">Usage estimate</p>
        <h2 className="text-[32px] font-normal leading-[1.15] tracking-[0px]">Cost calculator</h2>
        <p className="text-sm leading-6 text-[var(--foreground-60)]">
          Estimate the monthly cost of your company by plan and business size. Numbers are indicative — you only pay for the usage you actually consume.
        </p>
      </div>

      <SegmentedControl
        value={plan}
        onValueChange={(value) => setPlan(value as PlanId)}
        items={pricingPlans.map((item) => ({ value: item.id, label: item.name }))}
      />

      <SliderField
        label="Business size"
        min={1}
        max={10}
        step={1}
        value={[businessSize]}
        onValueChange={(value) => setBusinessSize(value[0] ?? 1)}
        valueLabel={`${businessSize}/10`}
      />

      <div className="grid gap-2 rounded-[12px] border border-[var(--border-10)] bg-[var(--background)] p-3">
        {rows.map((row) => {
          const value = breakdown[row.key];
          const formatted = row.format === "money" ? `$${Number(value).toFixed(2)}` : String(value);
          return (
            <div key={row.key} className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] py-2 last:border-0">
              <span className="text-sm text-[var(--foreground-60)]">{row.label}</span>
              <span className="font-mono text-[15px] text-[var(--foreground)]">{formatted}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
