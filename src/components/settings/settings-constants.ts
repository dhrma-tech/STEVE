import {
  Bell,
  Bot,
  Building2,
  CreditCard,
  Inbox,
  KeyRound,
  LifeBuoy,
  ShieldAlert,
  Settings,
  WalletCards
} from "lucide-react";

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
