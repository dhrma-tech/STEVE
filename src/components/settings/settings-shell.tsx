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
    <main className="min-h-full bg-[var(--app-canvas)] p-4 text-[var(--app-text)] md:p-6">
      <div className="mx-auto grid max-w-[1320px] gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3 rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-3">
          <div className="flex items-center gap-3 px-1 py-2">
            <span className="grid size-9 place-items-center rounded-[9px] border border-[var(--app-border)] bg-[rgba(255,255,255,0.06)] text-[var(--app-primary-light)]">
              <Database aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">Admin</p>
              <h1 className="text-lg font-medium tracking-[0px]">Settings</h1>
            </div>
          </div>
          <nav className="grid gap-1" aria-label="Settings sections">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const active = item.section === activeSection;
              return (
                <Link
                  key={item.section}
                  href={`/org/${orgId}/settings/${item.section}`}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-[9px] px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]",
                    active
                      ? "bg-[rgba(216,255,122,0.13)] text-[var(--app-text)]"
                      : "text-[var(--app-text-50)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--app-text)]"
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
            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-[9px] border border-[var(--app-border)] px-3 text-sm text-[var(--app-text)] outline-none transition-colors hover:bg-[rgba(255,255,255,0.06)] focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Integrations
          </Link>
        </aside>
        <section className="grid content-start gap-5">
          <div className="rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--app-text-50)]">Settings</p>
            <h2 className="mt-1 text-2xl font-medium tracking-[0px]">{title}</h2>
            <p className="mt-2 max-w-[82ch] text-sm leading-6 text-[var(--app-text-50)]">{description}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}

