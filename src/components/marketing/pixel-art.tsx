import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function GrassStrip({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-[92px] w-full bg-[linear-gradient(180deg,rgba(216,249,153,0)_0%,rgba(216,249,153,0.65)_18%,#8fcf62_18%,#8fcf62_34%,#5aa846_34%,#5aa846_64%,#356f35_64%)] [image-rendering:pixelated]",
        className
      )}
    />
  );
}

export function HeroPixelScene({ className }: { className?: string }) {
  return (
    <div
      aria-label="Original pixel-art landscape with a company command tower and department lights"
      className={cn(
        "relative min-h-[720px] overflow-hidden bg-[linear-gradient(180deg,#72b9ff_0%,#a7d7ff_38%,#fff3c9_64%,#c2e88f_100%)] [image-rendering:pixelated]",
        className
      )}
    >
      {/* Clouds - only on desktop to avoid headline overlap */}
      <div className="absolute left-[6%] top-[18%] size-20 animate-[logo-slide_22s_linear_infinite] bg-white/45 shadow-[140px_30px_0_12px_rgba(255,255,255,0.35),320px_-10px_0_8px_rgba(255,255,255,0.4),720px_45px_0_14px_rgba(255,255,255,0.32)] hidden lg:block" />
      
      {/* Tower - only on desktop */}
      <div className="absolute bottom-[20%] right-[12%] h-[320px] w-[320px] rounded-[18px] border-[10px] border-[#315946] bg-[linear-gradient(180deg,#d9f7ff,#85bfe2_62%,#55768d)] shadow-[0_28px_0_#315946,0_50px_0_rgba(0,0,0,0.08)] hidden lg:block" />
      
      {/* Antenna - only on desktop */}
      <div className="absolute bottom-[23%] right-[20%] h-[220px] w-[68px] bg-[#253d37] shadow-[80px_30px_0_#253d37,-78px_42px_0_#253d37] hidden lg:block" />
      
      {/* Lights */}
      <div className="absolute bottom-[31%] right-[19%] hidden grid-cols-3 gap-3 lg:grid">
        {Array.from({ length: 15 }).map((_, index) => (
          <span key={index} className="size-4 bg-[#f8ffbe] shadow-[0_0_16px_rgba(248,255,190,0.75)]" />
        ))}
      </div>

      <div className="absolute bottom-[13%] left-[48%] h-[170px] w-[270px] rounded-[10px] bg-[#314c59] shadow-[0_24px_0_#1f343d] hidden lg:block" />
      <div className="absolute bottom-[18%] left-[52%] h-[70px] w-[150px] bg-[#f7fbff] shadow-[0_0_0_8px_#223642,0_20px_0_#223642] hidden lg:block" />
      <div className="absolute bottom-[13%] left-0 right-0 h-[130px] bg-[linear-gradient(180deg,rgba(54,111,53,0),#6dbb4b_48%,#3a7737_48%)]" />
      <GrassStrip className="absolute bottom-0" />
    </div>
  );
}

export function ChapterArt({ tone = "green", className }: { tone?: "green" | "blue" | "pink" | "gold"; className?: string }) {
  const toneClass = {
    green: "from-[#d8f999] via-[#95d96e] to-[#315946]",
    blue: "from-[#d7e8ff] via-[#72b9ff] to-[#1a6fd1]",
    pink: "from-[#ffe4f7] via-[#f0abfc] to-[#a76451]",
    gold: "from-[#fff3c9] via-[#fde68a] to-[#9a6a28]"
  }[tone];

  return (
    <div className={cn("relative h-[180px] overflow-hidden rounded-[8px] bg-gradient-to-br [image-rendering:pixelated]", toneClass, className)}>
      <div className="absolute bottom-0 left-0 h-12 w-full bg-black/20" />
      <div className="absolute bottom-10 left-8 h-16 w-20 bg-white/70 shadow-[96px_-24px_0_#ffffff80,168px_18px_0_#ffffff70]" />
      <div className="absolute bottom-12 right-10 h-24 w-16 bg-black/45 shadow-[-38px_28px_0_#00000040,34px_18px_0_#00000035]" />
      <div className="absolute bottom-24 right-14 size-4 bg-[#f8ffbe] shadow-[0_0_16px_#f8ffbe]" />
    </div>
  );
}

export function FooterPixelCard() {
  return (
    <div className="relative h-[220px] overflow-hidden rounded-[16px] border border-[var(--color-border-card)] bg-[linear-gradient(135deg,#fbfbf8,#d7e8ff_52%,#d8f999)] [image-rendering:pixelated]">
      <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(52,168,83,0.65))]" />
      <div className="absolute bottom-14 left-12 h-28 w-24 bg-[#262323] shadow-[84px_22px_0_#3c5a48,170px_-12px_0_#262323]" />
      <div className="absolute bottom-28 left-16 size-5 bg-[#d8f999] shadow-[86px_22px_0_#d8f999,170px_-12px_0_#d8f999]" />
      <div className="absolute right-10 top-10 rounded-[8px] bg-white/60 px-4 py-3 font-mono text-xs text-[var(--color-ink)] shadow-[rgba(0,0,0,0.08)_0_14px_34px]">
        SOC 2 security copy
      </div>
    </div>
  );
}

