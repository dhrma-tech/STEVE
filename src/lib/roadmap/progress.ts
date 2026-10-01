import { prisma } from "@/lib/db/client";
import type { RoadmapStatus } from "@/data/roadmap";

/**
 * Roadmap progress without the request layer (no auth), so background work such as a finished plan can complete
 * a roadmap item too.
 */

export function progressFor(items: Array<{ status: string }>) {
  const total = items.length;
  const complete = items.filter((item) => item.status === "complete").length;
  const available = items.filter((item) => item.status === "available").length;
  const locked = items.filter((item) => item.status === "locked").length;

  return {
    total,
    complete,
    available,
    locked,
    percent: total ? Math.round((complete / total) * 100) : 0
  };
}

/** Unlock items whose dependencies are complete and store the org's roadmap progress. */
export async function syncRoadmapUnlocks(orgId: string) {
  const items = await prisma.roadmapItem.findMany({
    where: { organizationId: orgId },
    include: { dependencies: { include: { dependsOn: true } } }
  });

  const updates: Array<Promise<unknown>> = [];
  for (const item of items) {
    if (item.status === "complete") {
      if (!item.completedAt) {
        updates.push(prisma.roadmapItem.update({ where: { id: item.id }, data: { completedAt: new Date() } }));
      }
      continue;
    }

    const nextStatus: RoadmapStatus = item.dependencies.every((dependency) => dependency.dependsOn.status === "complete") ? "available" : "locked";
    if (item.status !== nextStatus) {
      updates.push(prisma.roadmapItem.update({ where: { id: item.id }, data: { status: nextStatus } }));
    }
  }

  if (updates.length) {
    await Promise.all(updates);
  }

  const latest = await prisma.roadmapItem.findMany({ where: { organizationId: orgId } });
  const progress = progressFor(latest.map((item) => ({ status: item.status })));
  await prisma.organization.update({
    where: { id: orgId },
    data: { roadmapProgress: progress.percent }
  });
}

/** Mark an item complete, close its open tasks and unlock what depended on it. */
export async function markRoadmapItemComplete(orgId: string, itemId: string) {
  const item = await prisma.roadmapItem.findFirst({ where: { id: itemId, organizationId: orgId } });
  if (!item) return null;
  const updated = await prisma.roadmapItem.update({
    where: { id: item.id },
    data: { status: "complete", completedAt: item.completedAt ?? new Date() }
  });
  await prisma.task.updateMany({
    where: { organizationId: orgId, roadmapItemId: item.id, archivedAt: null, status: { notIn: ["completed", "canceled", "archived"] } },
    data: { status: "completed", completedAt: new Date() }
  });
  await syncRoadmapUnlocks(orgId);
  return updated;
}
