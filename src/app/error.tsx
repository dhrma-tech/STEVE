"use client";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-border-card)] bg-[var(--color-surface-raised)] p-6">
        <p className="font-mono text-xs uppercase text-[var(--danger)]">Application error</p>
        <h1 className="mt-3 text-2xl font-normal">Something needs another pass.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-ink-muted)]">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-[8px] border border-black/10 bg-[var(--background)] px-4 py-2 text-sm"
        >
          Try again
        </button>
      </section>
    </main>
  );
}

