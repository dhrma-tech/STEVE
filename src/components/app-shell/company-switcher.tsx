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
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-2 rounded-[10px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.06)] px-2 py-2 text-left outline-none transition-colors hover:bg-[rgba(255,255,255,0.1)] focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]">
        <Avatar className="size-8">
          <AvatarImage src={shell.user.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{initials(shell.organization.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden min-w-0 sm:grid">
          <span className="truncate text-sm font-medium text-[var(--app-text)]">{shell.organization.name}</span>
          <span className="truncate text-xs text-[var(--app-text-50)]">{shell.membershipRole}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 text-[var(--app-text-50)]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Companies</DropdownMenuLabel>
        {shell.organizations.map((organization) => (
          <DropdownMenuItem key={organization.id} asChild>
            <Link href={organization.status === "active" ? `/org/${organization.id}/canvas` : `/org/${organization.id}/onboarding`} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate">{organization.name}</span>
                <span className="block text-xs text-[var(--app-text-50)]">{organization.role}</span>
              </span>
              <span className="text-xs text-[var(--app-text-50)]">{organization.status}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">New company</Link>
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
