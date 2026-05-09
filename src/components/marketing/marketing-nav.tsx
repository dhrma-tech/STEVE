"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { marketingNav } from "@/data/marketing-content";
import { buttonClassName } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { MarketingNavContainer } from "@/components/ui/container";
import { cn } from "@/lib/utils/cn";

export function MarketingNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [howToOpen, setHowToOpen] = React.useState(false);

  React.useEffect(() => {
    const update = () => setScrolled(window.scrollY > 12);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[201] h-[90.8px] transition-colors",
        scrolled ? "border-b-[0.8px] border-[#e8e7e6] bg-[var(--background)]" : "bg-transparent"
      )}
    >
      <MarketingNavContainer className="h-full justify-between">
        <Link href="/" className="text-[18px] font-medium tracking-[0px] text-[var(--foreground)]" aria-label="Cofounder home">
          Cofounder
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-black/5 bg-white/35 px-2 py-1 text-[15px] font-[410] leading-[22.5px] tracking-[0.15px] backdrop-blur-md lg:flex">
          <DropdownMenu open={howToOpen} onOpenChange={setHowToOpen}>
            <DropdownMenuTrigger
              onPointerEnter={() => setHowToOpen(true)}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-full px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]",
                pathname.startsWith("/how-to") ? "bg-[var(--foreground)] text-white" : "text-[var(--color-ink-strong)] hover:bg-white/55"
              )}
            >
              How To
              <ChevronDown aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent onPointerLeave={() => setHowToOpen(false)} align="center">
              {marketingNav.howTo.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {marketingNav.howTo.map((item) => (
            <React.Fragment key={item.href}>
              <span className="text-[var(--color-ink-faint)]">|</span>
              <Link
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]",
                  isActive(item.href) ? "bg-[var(--foreground)] text-white" : "hover:bg-white/55"
                )}
              >
                {item.label}
              </Link>
            </React.Fragment>
          ))}

          {marketingNav.primary.map((item) => (
            <React.Fragment key={item.href}>
              <span className="text-[var(--color-ink-faint)]">|</span>
              <Link
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]",
                  isActive(item.href) ? "bg-[var(--foreground)] text-white" : "hover:bg-white/55"
                )}
              >
                {item.label}
              </Link>
            </React.Fragment>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/login" className="rounded-[8px] px-3 py-2 text-[15px] text-[var(--color-ink-strong)] outline-none hover:bg-white/45 focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]">
            Log in
          </Link>
          <Link href="/login" aria-label="Run a company" className={buttonClassName({ variant: "light" })}>
            Run a company
          </Link>
        </div>

        <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogTrigger asChild>
            <IconButton className="lg:hidden" variant="light" label="Open menu" icon={<Menu aria-hidden="true" />} />
          </DialogTrigger>
          <DialogContent className="inset-0 h-dvh w-dvw max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-[var(--background)] p-6 text-[var(--foreground)] data-[state=open]:animate-[mm-bg-in_220ms_ease-out]" showClose={false}>
            <DialogTitle className="sr-only">Mobile menu</DialogTitle>
            <div className="flex items-center justify-between">
              <Link href="/" className="text-lg font-medium" onClick={() => setMobileOpen(false)}>
                Cofounder
              </Link>
              <IconButton variant="light" label="Close menu" icon={<X aria-hidden="true" />} onClick={() => setMobileOpen(false)} />
            </div>
            <nav className="mt-12 grid gap-4 text-3xl font-normal">
              {[...marketingNav.howTo, ...marketingNav.primary].map((item) => (
                <Link key={item.href} href={item.href} className="animate-[mm-link-in_260ms_ease-out] rounded-[8px] py-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-300)]" onClick={() => setMobileOpen(false)}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto grid gap-3 animate-[mm-footer-in_260ms_ease-out]">
              <Link href="/login" className={buttonClassName({ variant: "dark", fullWidth: true })} onClick={() => setMobileOpen(false)}>
                Run a company
              </Link>
              <Link href="/resources/introducing-cofounder-2" className="text-center text-sm text-[var(--color-ink-muted)]" onClick={() => setMobileOpen(false)}>
                Check out the launch
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      </MarketingNavContainer>
    </header>
  );
}
