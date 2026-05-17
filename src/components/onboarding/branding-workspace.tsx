"use client";

import { BrandingPanel } from "@/components/onboarding/branding-panel";

export function BrandingWorkspace({ orgId, orgName }: { orgId: string; orgName: string }) {
  return (
    <main className="relative h-dvh overflow-hidden bg-black">
      {/* Looping background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/login-bg.mp4.mp4" type="video/mp4" />
      </video>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Floating branding panel — solid bg */}
      <div className="pointer-events-auto fixed bottom-5 right-5 top-16 z-50 flex w-[390px] flex-col overflow-hidden rounded-[16px] border border-[var(--border-10)] bg-[var(--background-sidepanel)] shadow-[var(--tt-shadow-elevated-md)] xl:w-[420px]">
        <BrandingPanel orgId={orgId} orgName={orgName} />
      </div>
    </main>
  );
}
