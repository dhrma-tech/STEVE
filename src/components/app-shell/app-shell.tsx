"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bell,
  Bot,
  Boxes,
  CreditCard,
  Files,
  LayoutDashboard,
  ListTodo,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  Workflow
} from "lucide-react";
import { AppBreadcrumb } from "@/components/app-shell/breadcrumb";
import { CompanySwitcher } from "@/components/app-shell/company-switcher";
import { SidePanelTabs } from "@/components/app-shell/side-panel-tabs";
import { UpgradeModal } from "@/components/app-shell/upgrade-modal";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { InboxPanel } from "@/components/notifications/inbox-panel";
import { TaskCreateDialog } from "@/components/tasks/task-create-dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";
import type { OrgShellData } from "@/lib/orgs/shell";

const navItems = [
  { label: "Canvas", href: "canvas", icon: LayoutDashboard },
  { label: "Roadmap", href: "canvas?open_tech_tree=1", icon: Workflow },
  { label: "Tasks", href: "canvas?tab=tasks", icon: ListTodo },
  { label: "Agents", href: "canvas?tab=company", icon: Bot },
  { label: "Files", href: "canvas?tab=library", icon: Files },
  { label: "Settings", href: "settings/preferences", icon: Settings }
] as const;

export function AppShell({ shell, children }: { shell: OrgShellData; children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = React.useState(false);
  const [inboxOpen, setInboxOpen] = React.useState(false);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(shell.unreadInboxCount);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground-80)]">
      <div className="flex min-h-dvh">
        <aside className="hidden w-[76px] shrink-0 border-r border-[var(--border-10)] bg-[var(--card)] p-3 lg:flex lg:flex-col lg:items-center lg:gap-3">
          <Link href={`/org/${shell.organization.id}/canvas`} className="grid size-11 place-items-center rounded-[12px] border border-[var(--border-10)] bg-[var(--foreground-8)] text-[var(--foreground-80)]" aria-label={shell.organization.name}>
            <Boxes aria-hidden="true" className="size-5" />
          </Link>
          <nav className="mt-2 grid gap-2" aria-label="App navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const href = `/org/${shell.organization.id}/${item.href}`;
              const active = isNavActive({ itemHref: item.href, itemLabel: item.label, pathname, searchParams });
              return (
                <Link
                  key={item.label}
                  href={href}
                  aria-label={item.label}
                  className={cn(
                    "grid size-10 place-items-center rounded-[10px] border text-[var(--foreground-50)] outline-none transition-colors hover:border-[var(--border-10)] hover:bg-[var(--foreground-8)] hover:text-[var(--foreground-80)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]",
                    active ? "border-[var(--foreground-80)] bg-[var(--foreground-10)] text-[var(--foreground-80)]" : "border-transparent"
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto grid gap-2">
            <IconButton icon={<Bell aria-hidden="true" />} label="Open inbox" tooltip="Inbox" onClick={() => setInboxOpen(true)} />
            <IconButton icon={<Plus aria-hidden="true" />} label="New task" tooltip="New task" onClick={() => setTaskCreateOpen(true)} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-[68px] items-center gap-3 border-b border-[var(--border-10)] bg-[var(--background-l0-85)] px-3 backdrop-blur md:px-4">
            <CompanySwitcher shell={shell} />
            <AppBreadcrumb shell={shell} />
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="hidden h-10 min-w-[220px] items-center gap-2 rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] px-3 text-left text-sm text-[var(--foreground-50)] outline-none transition-colors hover:bg-[var(--foreground-10)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] md:flex"
                onClick={() => setCommandOpen(true)}
              >
                <Search aria-hidden="true" className="size-4" />
                <span className="min-w-0 flex-1 truncate">Search or run command</span>
                <span className="rounded-[6px] border border-[var(--border-10)] px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</span>
              </button>
              <IconButton icon={<Search aria-hidden="true" />} label="Search" className="md:hidden" onClick={() => setCommandOpen(true)} />
              <button
                type="button"
                className="relative grid size-10 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)] outline-none transition-colors hover:bg-[var(--foreground-10)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
                aria-label="Open inbox"
                onClick={() => setInboxOpen(true)}
              >
                <Bell aria-hidden="true" className="size-4" />
                {unreadCount > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--alert)] px-1 text-[10px] text-[var(--foreground-inverse-80)]">{unreadCount}</span> : null}
              </button>
              <ActionMenu shell={shell} onUpgrade={() => setUpgradeOpen(true)} />
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</div>
            {pathname.includes("/canvas") ? null : <SidePanelTabs shell={shell} />}
          </div>
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

function ActionMenu({ shell, onUpgrade }: { shell: OrgShellData; onUpgrade: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="grid size-10 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)] outline-none transition-colors hover:bg-[var(--foreground-10)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]" aria-label="Open action menu">
        <Menu aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{shell.user.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onUpgrade}>
          <Sparkles aria-hidden="true" className="mr-2 size-4" />
          Upgrade plan
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/org/${shell.organization.id}/settings/billing`}>
            <CreditCard aria-hidden="true" className="mr-2 size-4" />
            Billing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/org/${shell.organization.id}/settings/preferences`}>
            <Settings aria-hidden="true" className="mr-2 size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/api/auth/logout">Log out</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
