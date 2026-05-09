import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-border-card)] bg-[var(--color-surface-raised)] p-6">
        <p className="font-mono text-xs uppercase text-[var(--color-ink-faint)]">404</p>
        <h1 className="mt-3 text-2xl font-normal">This route is not built yet.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-ink-muted)]">
          The implementation is proceeding phase by phase from the source-note plan.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-[8px] border border-black/10 bg-[var(--background)] px-4 py-2 text-sm"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}

