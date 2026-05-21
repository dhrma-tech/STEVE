import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MarketingNav />
      {children}
    </>
  );
}

