import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/auth/login-panel";
import { isSandboxLoginEnabled } from "@/lib/auth/policy";
import { destinationForSession, getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to Cofounder and run an entire company with agents."
};

export default async function LoginPage() {
  const session = await getSession();

  if (session.user) {
    redirect(destinationForSession(session));
  }

  return (
    <main className="grid min-h-dvh place-items-center overflow-hidden bg-[var(--background)] p-5">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#72b9ff_0%,#d7e8ff_46%,#fff3c9_74%,#f5f5f2_100%)] [image-rendering:pixelated]" />
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0),#f5f5f2)]" />
      <div className="absolute bottom-16 left-[8%] h-24 w-20 bg-[#315946]/70 shadow-[90px_-22px_0_#31594680,210px_18px_0_#31594670,690px_-34px_0_#31594660]" />
      <div className="relative z-10 w-full">
        <LoginPanel previewModeEnabled={isSandboxLoginEnabled()} />
      </div>
    </main>
  );
}

