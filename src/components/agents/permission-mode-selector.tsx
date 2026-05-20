"use client";

import { Eye, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const PERMISSION_MODES = [
  {
    value: "review_required",
    label: "Review Required",
    description: "Agent flags dangerous actions for approval before executing",
    icon: Shield,
    isDefault: true,
  },
  {
    value: "sandbox_only",
    label: "Sandbox Only",
    description: "Agent reads and previews only — never writes or acts",
    icon: Eye,
    isDefault: false,
  },
  {
    value: "trusted",
    label: "Trusted",
    description: "Agent executes without pausing — no approval checks",
    icon: Zap,
    isDefault: false,
  },
] as const;

export function PermissionModeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {PERMISSION_MODES.map((mode) => {
        const Icon = mode.icon;
        const isSelected = value === mode.value;

        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={cn(
              "flex items-start gap-3 rounded-[10px] border px-3 py-2.5 text-left transition-colors duration-150",
              isSelected
                ? "border-[var(--primary)] bg-[var(--primary)]/5"
                : "border-[var(--border-10)] hover:bg-[var(--foreground-5)]"
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "mt-0.5 size-4 shrink-0",
                isSelected ? "text-[var(--primary)]" : "text-[var(--foreground-40)]"
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{mode.label}</span>
                {mode.isDefault && (
                  <span className="rounded border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--primary)]">
                    Default
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--foreground-40)]">
                {mode.description}
              </p>
            </div>
            <div
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                isSelected
                  ? "border-[var(--primary)] bg-[var(--primary)]"
                  : "border-[var(--border-10)]"
              )}
            >
              {isSelected && <div className="size-1.5 rounded-full bg-white" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
