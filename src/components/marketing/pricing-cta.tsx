"use client";

import * as React from "react";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function PricingCta({ href, label, highlighted }: { href: string; label: string; highlighted: boolean }) {
  const ref = React.useRef<HTMLAnchorElement>(null);

  function handleClick() {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("animate-pricing-btn-press");
    void el.offsetWidth;
    el.classList.add("animate-pricing-btn-press");
  }

  return (
    <Link
      ref={ref}
      href={href}
      onClick={handleClick}
      className={cn(
        buttonClassName({ variant: "light", fullWidth: true }),
        "transition-transform duration-100",
        highlighted && "border-[var(--color-ink-ui-solid)] font-semibold"
      )}
    >
      {label}
    </Link>
  );
}
