import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-5" aria-label={`Step ${current + 1} of ${steps.length}`}>
      <span className="sr-only">{`Step ${current + 1} of ${steps.length}`}</span>
      {steps.map((step, index) => {
        const complete = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border text-xs",
                complete ? "border-[var(--success)] bg-[var(--success)] text-white" : active ? "border-[var(--tt-brand-color-500)] bg-[var(--tt-brand-color-500)] text-white" : "border-[var(--border-10)] text-[var(--foreground-50)]"
              )}
            >
              {complete ? <Check aria-hidden="true" className="size-4" /> : index + 1}
            </span>
            <span className={cn("text-xs leading-4", active ? "text-[var(--foreground)]" : "text-[var(--foreground-50)]")}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
