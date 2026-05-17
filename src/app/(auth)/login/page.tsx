import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginPanel } from "@/components/auth/login-panel";
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
      {/* Background video */}
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
      {/* Overlay to keep card readable */}
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex w-full justify-center">
        <LoginPanel />
      </div>
    </main>
  );
}

