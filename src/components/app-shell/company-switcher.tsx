"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { OrgShellData } from "@/lib/orgs/shell";

export function CompanySwitcher({ shell }: { shell: OrgShellData }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] px-2.5 py-1.5 text-left outline-none transition-colors hover:bg-[var(--foreground-10)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]">
        <Avatar className="size-6">
          <AvatarImage src={shell.user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="text-[10px]">{initials(shell.organization.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden truncate text-sm font-medium text-[var(--foreground-80)] sm:block">
          {shell.organization.name}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-[var(--foreground-50)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Companies</DropdownMenuLabel>
        {shell.organizations.map((organization) => (
          <DropdownMenuItem key={organization.id} asChild>
            <Link href={organization.status === "active" ? `/org/${organization.id}/canvas` : `/org/${organization.id}/onboarding`} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate">{organization.name}</span>
                <span className="block text-xs text-[var(--foreground-50)]">{organization.role}</span>
              </span>
              <span className="text-xs text-[var(--foreground-50)]">{organization.status}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/questions">New company</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
