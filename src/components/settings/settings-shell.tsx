"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bell,
  Bot,
  Building2,
  CreditCard,
  Database,
  Inbox,
  KeyRound,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldAlert,
  Sparkles,
  WalletCards
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

export const settingsNavItems = [
  { section: "preferences", label: "Preferences", icon: Settings },
  { section: "ai", label: "AI Settings", icon: Bot },
  { section: "env-files", label: "Env & Secrets", icon: KeyRound },
  { section: "notifications", label: "Notifications", icon: Bell },
  { section: "organization", label: "Organization", icon: Building2 },
  { section: "inbox", label: "Inbox", icon: Inbox },
  { section: "support", label: "Support", icon: LifeBuoy },
  { section: "payments", label: "Stripe/Payments", icon: CreditCard },
  { section: "billing", label: "Billing", icon: WalletCards },
  { section: "advanced", label: "Advanced", icon: ShieldAlert }
] as const;

export type SettingsSection = (typeof settingsNavItems)[number]["section"];

export function SettingsShell({
  orgId,
  activeSection,
  title,
  description,
  children
}: {
  orgId: string;
  activeSection: SettingsSection;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-full bg-[var(--background)] p-4 text-[var(--foreground-80)] md:p-6">
      <div className="mx-auto grid max-w-[1320px] gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 xl:rounded-[12px] xl:border xl:border-[var(--border-10)] xl:bg-[var(--background-sidepanel)] xl:p-3">
          <div className="hidden items-center gap-3 px-1 py-2 xl:flex">
            <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
              <Database aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Admin</p>
              <h1 className="text-lg font-medium tracking-[0px]">Settings</h1>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-2 scrollbar-none xl:grid xl:overflow-visible xl:pb-0" aria-label="Settings sections">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const active = item.section === activeSection;
              return (
                <Link
                  key={item.section}
                  href={`/org/${orgId}/settings/${item.section}`}
                  className={cn(
                    "flex min-h-10 shrink-0 items-center gap-2 rounded-[9px] px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focused)] xl:shrink",
                    active
                      ? "bg-[var(--foreground-5)] text-[var(--foreground-80)]"
                      : "text-[var(--foreground-50)] hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <Link
            href={`/org/${orgId}/integrations`}
            className="hidden min-h-10 items-center gap-2 rounded-[9px] border border-[var(--border-10)] px-3 text-sm text-[var(--foreground-80)] outline-none transition-colors hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] xl:mt-2 xl:inline-flex"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Integrations
          </Link>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="hidden min-h-10 items-center gap-2 rounded-[9px] px-3 text-sm text-[var(--foreground-50)] outline-none transition-colors hover:bg-[var(--foreground-5)] hover:text-[var(--destructive)] focus-visible:ring-2 focus-visible:ring-[var(--focused)] xl:mt-1 xl:inline-flex"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </aside>
        <section className="grid content-start gap-5">
          <div className="rounded-[12px] border border-[var(--border-10)] bg-[var(--background-sidepanel)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">Settings</p>
            <h2 className="mt-1 text-2xl font-medium tracking-[0px]">{title}</h2>
            <p className="mt-2 max-w-[82ch] text-sm leading-6 text-[var(--foreground-50)]">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

