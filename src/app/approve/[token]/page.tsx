import type { Metadata } from "next";
import { previewOneTap } from "@/lib/agents/policy/approval-inbox";
import { OneTapConfirm } from "./one-tap-confirm";

export const metadata: Metadata = {
  title: "Approve agent action",
  description: "Confirm an approval from your email.",
  robots: { index: false, follow: false }
};

type ApprovePageProps = { params: Promise<{ token: string }> };

/**
 * The page a one-tap email link opens. It only shows what would happen; the decision is made by the button, so
 * a mail scanner that follows the link changes nothing.
 */
export default async function ApprovePage({ params }: ApprovePageProps) {
  const { token } = await params;
  const preview = await previewOneTap(decodeURIComponent(token));

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4 text-[var(--foreground-80)]">
      <section className="grid w-full max-w-lg gap-4 rounded-[14px] border border-[var(--border-10)] bg-[var(--background-l0)] p-5 shadow-[var(--tt-shadow-elevated-md)]">
        {preview.kind === "invalid" ? (
          <>
            <h1 className="text-lg font-medium">This link cannot be used</h1>
            <p className="text-sm text-[var(--foreground-60)]">{preview.message}</p>
          </>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">
              {preview.agentName ?? "An agent"} asks
            </p>
            <h1 className="text-lg font-medium leading-7">{preview.summary}</h1>
            <p className="text-sm text-[var(--foreground-60)]">Risk: {preview.risk.replace("_", " ")}</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[8px] bg-[var(--foreground-5)] p-3 font-mono text-xs text-[var(--foreground-80)]">
              {JSON.stringify(preview.payload, null, 2)}
            </pre>
            {preview.status === "pending" ? (
              <OneTapConfirm token={decodeURIComponent(token)} decision={preview.decision} orgId={preview.orgId} />
            ) : (
              <p className="text-sm text-[var(--foreground-60)]">This was already {preview.status === "approved" ? "approved" : preview.status}. Nothing more to do.</p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
