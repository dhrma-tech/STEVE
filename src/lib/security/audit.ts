import { prisma } from "@/lib/db/client";
import { redactSecrets } from "@/lib/agents/policy/sanitize";
import { log } from "@/lib/observability/log";

/**
 * The audit log (orchestration plan, Phase 10): who did what, to what, when.
 *
 * Covered: every agent tool call (run, denied, skipped, failed), approval and question decisions, policy and budget
 * changes, credential and integration changes, automations (schedules, triggers, channels, API keys) and
 * retention settings. Metadata is redacted. Writing an audit row never fails the action it records.
 */

export type AuditEntry = {
  orgId: string;
  actorUserId?: string | null;
  actorAgentId?: string | null;
  /** dotted verb, e.g. "approval.approved", "tool.email_send", "schedule.created" */
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: entry.orgId,
        actorUserId: entry.actorUserId ?? null,
        actorAgentId: entry.actorAgentId ?? null,
        action: entry.action.slice(0, 120),
        targetType: entry.targetType.slice(0, 60),
        targetId: entry.targetId ?? null,
        metadataJson: entry.metadata ? redactSecrets(JSON.stringify(entry.metadata)).slice(0, 8000) : null
      }
    });
  } catch (error) {
    log.warn("audit write failed", { orgId: entry.orgId, action: entry.action, error });
  }
}

export async function listAudit(orgId: string, options: { limit?: number; before?: Date; action?: string } = {}) {
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId: orgId,
      ...(options.before ? { createdAt: { lt: options.before } } : {}),
      ...(options.action ? { action: { startsWith: options.action } } : {})
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, options.limit ?? 50)),
    include: { actorUser: { select: { name: true, email: true } }, actorAgent: { select: { name: true } } }
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    actor: row.actorUser?.name ?? row.actorUser?.email ?? row.actorAgent?.name ?? "system",
    actorKind: row.actorUserId ? "user" : row.actorAgentId ? "agent" : "system",
    metadata: row.metadataJson ? (JSON.parse(row.metadataJson) as Record<string, unknown>) : null,
    createdAt: row.createdAt.toISOString()
  }));
}
