import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface HeroNotificationPillProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  detail?: string;
  status?: string;
}

export function HeroNotificationPill({ icon, title, detail, status, className, ...props }: HeroNotificationPillProps) {
  return (
    <div
      className={cn(
        "grid h-[41px] w-[240px] grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[8px] border border-transparent bg-[linear-gradient(rgba(255,255,255,0.16),rgba(255,255,255,0.08))] px-3 text-white shadow-[rgba(255,255,255,0.22)_0_1px_0_inset,rgba(0,0,0,0.12)_0_12px_28px] backdrop-blur-[16px] md:h-[48px] md:w-[276px]",
        className
      )}
      {...props}
    >
      {icon ? <span className="grid size-7 place-items-center rounded-[6px] bg-white/14 [&_svg]:size-4">{icon}</span> : null}
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-4 tracking-[0px]">{title}</span>
        {detail ? <span className="block truncate text-[11px] leading-4 text-white/70">{detail}</span> : null}
      </span>
      {status ? <span className="rounded-full bg-white/14 px-2 py-1 text-[10px] font-medium uppercase leading-none text-white/80">{status}</span> : null}
    </div>
  );
}

