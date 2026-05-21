"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { BrandingPanel } from "@/components/onboarding/branding-panel";

function BusinessPlanPreview() {
  const [content, setContent] = React.useState<string | null>(null);

  React.useEffect(() => {
    const plan = sessionStorage.getItem("businessPlan");
    setContent(plan ?? null);
  }, []);

  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="mb-4 mt-8 text-2xl font-bold tracking-[-0.4px] text-[var(--foreground)] first:mt-0">{renderInline(line.slice(2))}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="mb-3 mt-7 text-xl font-semibold tracking-[-0.2px] text-[var(--foreground)]">{renderInline(line.slice(3))}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="mb-2 mt-5 text-base font-semibold text-[var(--foreground)]">{renderInline(line.slice(4))}</h3>);
    } else if (/^[-*•] /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*•] /.test(lines[i])) {
        items.push(<li key={i} className="leading-6">{renderInline(lines[i].replace(/^[-*•] /, ""))}</li>);
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="mb-4 ml-5 list-disc space-y-1 text-sm text-[var(--foreground-80)]">{items}</ul>);
      continue;
    } else if (line.trim() === "") {
      /* skip */
    } else {
      elements.push(<p key={i} className="mb-3 text-sm leading-7 text-[var(--foreground-80)]">{renderInline(line)}</p>);
    }
    i++;
  }

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--border-10)] px-6 py-4">
        <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
          <FileText aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.2px] text-[var(--foreground)]">Business Plan</h2>
          <p className="font-mono text-xs text-[var(--foreground-50)]">general/business_context.md</p>
        </div>
        <span className="ml-auto rounded-full border border-[var(--border-10)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--foreground-50)]">
          Reference
        </span>
      </div>
      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-[640px]">{elements}</div>
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={idx} className="font-semibold text-[var(--foreground)]">{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={idx}>{part.slice(1, -1)}</em>;
        return part;
      })}
    </>
  );
}

export function BrandingWorkspace({ orgId, orgName }: { orgId: string; orgName: string }) {
  return (
    <main className="relative z-[40] flex h-dvh overflow-hidden bg-[var(--background)]">
      {/* Left — business plan reference, floating panel */}
      <div className="hidden min-w-0 flex-1 items-stretch p-5 lg:flex">
        <div
          className="animate-fullplan-in flex w-full flex-col overflow-hidden rounded-[24px] bg-[var(--background)] shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
          style={{ border: "1px solid var(--border-10)" }}
        >
          <BusinessPlanPreview />
        </div>
      </div>

      {/* Right — branding wizard panel */}
      <div className="flex w-full shrink-0 flex-col overflow-hidden border-l border-[var(--border-10)] bg-[var(--background-sidepanel)] sm:w-[390px] xl:w-[420px]">
        <BrandingPanel orgId={orgId} orgName={orgName} />
      </div>
    </main>
  );
}
