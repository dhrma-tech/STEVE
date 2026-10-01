import type { Metadata } from "next";
import { getHealth, type ComponentStatus } from "@/lib/observability/health";

export const metadata: Metadata = {
  title: "System status",
  description: "Whether STEVE's database, agent workers and job queue are running normally."
};

export const dynamic = "force-dynamic";

const LABEL: Record<ComponentStatus, string> = { operational: "Operational", degraded: "Degraded", down: "Down" };
const TONE: Record<ComponentStatus, string> = {
  operational: "text-[var(--tt-color-text-green-contrast)]",
  degraded: "text-[var(--alert)]",
  down: "text-[var(--destructive)]"
};

function Row({ name, status, detail }: { name: string; status: ComponentStatus; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-4 border-t border-[var(--border-10)] py-3">
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-[var(--foreground-50)]">{detail}</p>
      </div>
      <span className={`text-sm font-medium ${TONE[status]}`}>{LABEL[status]}</span>
    </li>
  );
}

/** Public status page: the same checks as /api/health, for people. */
export default async function StatusPage() {
  const health = await getHealth();
  const { database, workers, queue } = health.components;
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-2xl content-start gap-6 bg-[var(--background)] px-4 py-12 text-[var(--foreground)]">
      <header className="grid gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">STEVE</p>
        <h1 className="text-2xl font-medium">System status</h1>
        <p className={`text-lg ${TONE[health.status]}`}>
          {health.status === "operational" ? "All systems operational" : health.status === "degraded" ? "Some systems are degraded" : "STEVE is down"}
        </p>
      </header>
      <ul className="grid">
        <Row name="Database" status={database.status} detail={database.latencyMs === null ? "Not reachable" : `Responding in ${database.latencyMs} ms`} />
        <Row
          name="Agent workers"
          status={workers.status}
          detail={workers.alive > 0 ? `${workers.alive} running` : workers.lastSeenAt ? `Last seen ${new Date(workers.lastSeenAt).toUTCString()}` : "No worker has reported in"}
        />
        <Row
          name="Job queue"
          status={queue.status}
          detail={queue.due === null ? "Managed by pg-boss" : queue.due === 0 ? "Nothing waiting" : `${queue.due} waiting, oldest ${queue.oldestDueSeconds}s`}
        />
      </ul>
      <p className="text-xs text-[var(--foreground-50)]">Checked {new Date(health.checkedAt).toUTCString()}. Machine-readable: /api/health</p>
    </main>
  );
}
