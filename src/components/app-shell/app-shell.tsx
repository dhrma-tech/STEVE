"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Cpu,
  CreditCard,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Map,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Workflow,
  X
} from "lucide-react";
import { SidePanelTabs } from "@/components/app-shell/side-panel-tabs";
import { UpgradeModal } from "@/components/app-shell/upgrade-modal";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { InboxPanel } from "@/components/notifications/inbox-panel";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils/cn";
import type { OrgShellData } from "@/lib/orgs/shell";

const navItems = [
  { label: "Canvas", href: "canvas", icon: LayoutDashboard },
  { label: "Roadmap", href: "canvas?open_tech_tree=1", icon: Workflow },
  { label: "Tasks", href: "canvas?tab=tasks", icon: ListTodo },
  { label: "Agents", href: "canvas?tab=company", icon: Cpu },
  { label: "Library", href: "canvas?tab=library", icon: BookOpen },
  { label: "Settings", href: "settings/preferences", icon: Settings }
] as const;

export function AppShell({ shell, children }: { shell: OrgShellData; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isCanvas = pathname.includes("/canvas");
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = React.useState(false);
  const [inboxOpen, setInboxOpen] = React.useState(false);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(shell.unreadInboxCount);

  // Close nav on route change
  React.useEffect(() => { setNavOpen(false); }, [pathname]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isOnboarding = pathname.includes("/onboarding");

  // Minimal onboarding shell — just a logout button, no nav
  if (isOnboarding) {
    return (
      <div className="h-dvh overflow-hidden text-[var(--foreground-80)]">
        <div className="pointer-events-none absolute left-4 top-4 z-30">
          <button
            type="button"
            aria-label="Log out"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="pointer-events-auto flex items-center gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] px-3 py-2 text-sm text-[var(--foreground-80)] shadow-sm transition-colors hover:bg-[var(--foreground-10)]"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Log out
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-[var(--background)] text-[var(--foreground-80)]">
      {/* Nav drawer backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/10"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* Nav drawer panel */}
      <div className={cn(
        "fixed left-3 top-3 z-50 flex w-[260px] flex-col rounded-[16px] border border-[var(--border-10)] bg-[var(--background-l0-85)] shadow-[var(--tt-shadow-elevated-md)] backdrop-blur-[20px]",
        navOpen
          ? "animate-nav-drawer-pop pointer-events-auto"
          : "opacity-0 scale-90 -translate-y-2 pointer-events-none transition-all duration-200 ease-in"
      )}>
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-[var(--border-10)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--foreground-10)] text-sm font-semibold text-[var(--foreground-80)]">
              {shell.organization.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-medium text-[var(--foreground-80)]">{shell.organization.name}</p>
              <p className="text-xs text-[var(--foreground-50)]">{shell.user.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            className="grid size-7 place-items-center rounded-[6px] text-[var(--foreground-50)] hover:bg-[var(--foreground-8)] hover:text-[var(--foreground-80)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Account */}
        <nav className="p-3">
          <p className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--foreground-30)]">Account</p>
          <div className="grid gap-0.5">
            <button
              type="button"
              onClick={() => { setNavOpen(false); setUpgradeOpen(true); }}
              className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm text-[var(--foreground-60)] hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
            >
              <Sparkles aria-hidden="true" className="size-4 shrink-0" />
              Upgrade plan
            </button>
            <Link
              href={`/org/${shell.organization.id}/settings/billing`}
              className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm text-[var(--foreground-60)] hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
            >
              <CreditCard aria-hidden="true" className="size-4 shrink-0" />
              Billing
            </Link>
            <Link
              href={`/org/${shell.organization.id}/settings/preferences`}
              className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm text-[var(--foreground-60)] hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
            >
              <Settings aria-hidden="true" className="size-4 shrink-0" />
              Settings
            </Link>
          </div>
        </nav>

        {/* Logout at bottom */}
        <div className="border-t border-[var(--border-10)] p-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-sm text-[var(--foreground-60)] hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            <LogOut aria-hidden="true" className="size-4 shrink-0" />
            Log out
          </button>
        </div>
      </div>

      {/* Main layout — no header */}
      <div className="flex h-full flex-col">
        {/* Back-to-canvas bar — settings and integrations pages (in flow, no overlap) */}
        {pathname.includes("/settings") || pathname.includes("/integrations") ? (
          <div className="shrink-0 border-b border-[var(--border-10)] px-4 py-2">
            <Link
              href={`/org/${shell.organization.id}/canvas`}
              className="inline-flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm text-[var(--foreground-60)] transition-colors hover:bg-[var(--foreground-8)] hover:text-[var(--foreground-80)]"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Canvas
            </Link>
          </div>
        ) : null}

        {/* Floating top-left controls — hidden on settings and integrations pages */}
        <div className={pathname.includes("/settings") || pathname.includes("/integrations") ? "hidden" : "pointer-events-none absolute left-4 top-4 z-30 flex items-center gap-2"}>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="pointer-events-auto grid size-9 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-10)]"
          >
            <Menu aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            className="pointer-events-auto relative grid size-9 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-10)]"
            aria-label="Open inbox"
            onClick={() => setInboxOpen(true)}
          >
            <Bell aria-hidden="true" className="size-4" />
            {unreadCount > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--alert)] px-1 text-[10px] text-[var(--foreground-inverse-80)]">{unreadCount}</span> : null}
          </button>
          <ThemeToggle />
          <button
            type="button"
            aria-label="Open roadmap"
            onClick={() => {
              if (isCanvas) {
                window.dispatchEvent(new CustomEvent("open-roadmap"));
              } else {
                router.push(`/org/${shell.organization.id}/canvas?open_tech_tree=1`);
              }
            }}
            className="pointer-events-auto grid size-9 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-10)]"
          >
            <Map aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            aria-label="Search"
            className="pointer-events-auto grid size-9 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground-80)] transition-colors hover:bg-[var(--foreground-10)]"
          >
            <Search aria-hidden="true" className="size-4" />
          </button>
          <a
            href="https://discord.gg/cofounder"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join Discord"
            title="Join Discord"
            className="pointer-events-auto grid size-9 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--background-l0)] text-[var(--foreground-80)] transition-colors hover:bg-[#5865F2]/10 hover:text-[#5865F2] hover:border-[#5865F2]/30"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.033.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </a>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className={cn("min-w-0 flex-1 pb-20 lg:pb-0", pathname.includes("/canvas") ? "overflow-hidden" : "overflow-y-auto")}>{children}</div>
          {pathname.includes("/canvas") || pathname.includes("/onboarding") ? null : <SidePanelTabs shell={shell} />}
        </div>
      </div>

      <MobileNav shell={shell} pathname={pathname} searchParams={searchParams} onInbox={() => setInboxOpen(true)} onNewTask={() => setTaskCreateOpen(true)} unreadCount={unreadCount} />
      <CommandPalette orgId={shell.organization.id} open={commandOpen} onOpenChange={setCommandOpen} />
      <TaskCreateDialog orgId={shell.organization.id} open={taskCreateOpen} onOpenChange={setTaskCreateOpen} />
      <InboxPanel orgId={shell.organization.id} open={inboxOpen} onOpenChange={setInboxOpen} onUnreadCountChange={setUnreadCount} />
      <UpgradeModal shell={shell} open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}

function MobileNav({
  shell,
  pathname,
  searchParams,
  onInbox,
  onNewTask,
  unreadCount
}: {
  shell: OrgShellData;
  pathname: string;
  searchParams: { get(name: string): string | null };
  onInbox: () => void;
  onNewTask: () => void;
  unreadCount: number;
}) {
  const primary = navItems.slice(0, 4);
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-6 gap-1 rounded-[14px] border border-[var(--border-10)] bg-[var(--background-l0-85)] p-1 shadow-[var(--tt-shadow-elevated-md)] backdrop-blur lg:hidden" aria-label="Mobile app navigation">
      {primary.map((item) => {
        const Icon = item.icon;
        const href = `/org/${shell.organization.id}/${item.href}`;
        const active = isNavActive({ itemHref: item.href, itemLabel: item.label, pathname, searchParams });
        return (
          <Link key={item.label} href={href} className={cn("grid min-h-12 place-items-center rounded-[10px] text-[var(--foreground-50)]", active && "bg-[var(--foreground-10)] text-[var(--foreground-80)]")} aria-label={item.label}>
            <Icon aria-hidden="true" className="size-5" />
          </Link>
        );
      })}
      <button type="button" className="relative grid min-h-12 place-items-center rounded-[10px] text-[var(--foreground-50)]" aria-label="Inbox" onClick={onInbox}>
        <Bell aria-hidden="true" className="size-5" />
        {unreadCount > 0 ? <Badge variant="warning" className="absolute right-1 top-1 px-1 text-[10px]">{unreadCount}</Badge> : null}
      </button>
      <button type="button" className="grid min-h-12 place-items-center rounded-[10px] bg-[var(--primary)] text-[var(--primary-foreground)]" aria-label="New task" onClick={onNewTask}>
        <Plus aria-hidden="true" className="size-5" />
      </button>
    </nav>
  );
}

function isNavActive({
  itemHref,
  itemLabel,
  pathname,
  searchParams
}: {
  itemHref: string;
  itemLabel: string;
  pathname: string;
  searchParams: { get(name: string): string | null };
}) {
  if (!pathname.includes("/canvas")) {
    return pathname.endsWith(itemHref);
  }

  if (itemHref.includes("open_tech_tree")) return searchParams.get("open_tech_tree") === "1";
  const tab = itemHref.match(/tab=([^&]+)/)?.[1];
  if (tab) return searchParams.get("tab") === tab;
  return itemLabel === "Canvas" && !searchParams.get("tab") && searchParams.get("open_tech_tree") !== "1";
}
