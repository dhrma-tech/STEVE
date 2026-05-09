"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { OrgShellData } from "@/lib/orgs/shell";

export function AppBreadcrumb({ shell }: { shell: OrgShellData }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parts = buildParts({ pathname, shell, searchParams });

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm text-[var(--app-text-50)] md:flex">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="flex min-w-0 items-center gap-1">
          {index > 0 ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-55" /> : null}
          <span className={index === parts.length - 1 ? "truncate text-[var(--app-text)]" : "truncate"}>{part}</span>
        </span>
      ))}
    </nav>
  );
}

function buildParts({
  pathname,
  shell,
  searchParams
}: {
  pathname: string;
  shell: OrgShellData;
  searchParams: URLSearchParams;
}) {
  const parts = [shell.organization.name];

  if (pathname.includes("/onboarding")) {
    parts.push("Onboarding");
  } else if (pathname.includes("/settings")) {
    parts.push("Settings");
  } else if (pathname.includes("/integrations")) {
    parts.push("Integrations");
  } else if (pathname.includes("/canvas")) {
    parts.push("Canvas");
  } else {
    parts.push("Workspace");
  }

  const department = searchParams.get("department");
  const agent = searchParams.get("agent");
  const task = searchParams.get("task");
  const file = searchParams.get("file");
  const roadmap = searchParams.get("roadmap");

  if (department) parts.push(labelize(department));
  if (agent) parts.push("Agent");
  if (task) parts.push("Task");
  if (file) parts.push("File");
  if (roadmap || searchParams.get("open_tech_tree")) parts.push("Roadmap");

  return parts;
}

function labelize(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
