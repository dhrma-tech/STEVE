export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="h-4 w-40 animate-pulse rounded bg-black/10" />
        <div className="mt-6 h-10 w-full max-w-xl animate-pulse rounded bg-black/10" />
        <div className="mt-4 h-24 w-full animate-pulse rounded bg-black/10" />
      </div>
    </main>
  );
}

