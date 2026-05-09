"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getDepartmentVisual } from "@/data/departments";

type DepartmentContextTabsProps = {
  slug: string;
  context: Record<string, unknown>;
};

export function DepartmentContextTabs({ slug, context }: DepartmentContextTabsProps) {
  const visual = getDepartmentVisual(slug);
  const contextKeys = Object.keys(context).filter((key) => !["contextTabs"].includes(key));

  return (
    <Tabs defaultValue={visual.contextTabs[0]?.id ?? "company"} className="grid gap-3">
      <TabsList className="grid w-full grid-cols-3">
        {visual.contextTabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="px-2 text-xs">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {visual.contextTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-0">
          <div className="grid gap-3 rounded-[12px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.04)] p-3">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-[rgba(255,255,255,0.07)] text-[var(--app-primary-light)]">
                <FileText aria-hidden="true" className="size-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{tab.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--app-text-50)]">{tab.body}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {tab.bullets.map((bullet) => (
                <Badge key={bullet} variant="neutral">
                  {bullet}
                </Badge>
              ))}
            </div>
            {tab.id === "department" && contextKeys.length ? (
              <div className="grid gap-2 border-t border-[var(--app-border)] pt-3">
                {contextKeys.slice(0, 5).map((key) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono uppercase tracking-[0.08em] text-[var(--app-text-50)]">{key}</span>
                    <span className="max-w-[18rem] truncate text-right text-[var(--app-text)]">{stringifyContextValue(context[key])}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}

function stringifyContextValue(value: unknown) {
  if (value == null) return "empty";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  return "object";
}
