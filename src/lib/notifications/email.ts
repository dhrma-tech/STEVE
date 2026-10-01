import { prisma } from "@/lib/db/client";
import { getEmailConfig } from "@/lib/agents/tools/email";
import { appUrl, createOneTapToken, oneTapUrl } from "@/lib/agents/policy/one-tap";
import { ALWAYS_ASK_RISKS, type ToolRisk } from "@/lib/agents/policy/risk";
import { MANAGER_ROLES } from "@/lib/auth/roles";

/**
 * Emails STEVE sends the founder about agent work: approvals (with one-tap links) and briefings. Sent through the
 * org's email integration or RESEND_API_KEY; when neither is set, nothing is sent and the in-app inbox is the channel.
 * Sending never fails the work that triggered it.
 */

type Preference = "emailApprovals" | "emailBriefings";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Who gets agent emails: owners and admins with an email address who have not turned that email off. */
export async function emailRecipients(orgId: string, preference: Preference) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId: orgId, role: { in: [...MANAGER_ROLES] } },
    include: { user: { select: { id: true, email: true } } }
  });
  const prefs = await prisma.notificationPreference.findMany({
    where: { organizationId: orgId, userId: { in: memberships.map((m) => m.userId) } }
  });
  const optedOut = new Set(prefs.filter((p) => !p[preference]).map((p) => p.userId));
  return memberships
    .filter((m) => m.user.email && !optedOut.has(m.userId))
    .map((m) => ({ userId: m.user.id, email: m.user.email! }));
}

export async function sendEmail(params: { orgId: string; to: string; subject: string; html: string }): Promise<boolean> {
  const config = await getEmailConfig(params.orgId);
  if (!config) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.fromAddress, to: params.to, subject: params.subject, html: params.html })
    });
    if (!response.ok) throw new Error(`Resend ${response.status}`);
    return true;
  } catch (error) {
    console.error(`[email] could not send "${params.subject}":`, error);
    return false;
  }
}

/** Tell the managers an agent is waiting for an approval, with links to approve or deny in one tap. */
export async function notifyApprovalRequested(approval: {
  id: string;
  organizationId: string;
  toolName: string | null;
  description: string | null;
  riskLevel: string;
  payloadJson: string | null;
  requestedByAgentId: string | null;
}): Promise<number> {
  if (!(await getEmailConfig(approval.organizationId))) return 0;
  const [recipients, agent] = await Promise.all([
    emailRecipients(approval.organizationId, "emailApprovals"),
    approval.requestedByAgentId ? prisma.agent.findUnique({ where: { id: approval.requestedByAgentId }, select: { name: true } }) : null
  ]);
  const who = agent?.name ?? "An agent";
  const summary = approval.description ?? `Run ${approval.toolName ?? "a tool"}`;
  const risk = approval.riskLevel as ToolRisk;
  const payload = (approval.payloadJson ?? "{}").slice(0, 1500);

  let sent = 0;
  for (const recipient of recipients) {
    const approve = oneTapUrl(createOneTapToken({ approvalId: approval.id, decision: "approve", userId: recipient.userId }));
    const deny = oneTapUrl(createOneTapToken({ approvalId: approval.id, decision: "deny", userId: recipient.userId }));
    const html = [
      `<p><strong>${escapeHtml(who)}</strong> is waiting for your approval.</p>`,
      `<p>${escapeHtml(summary)}</p>`,
      `<p>Risk: ${escapeHtml(risk.replace("_", " "))}${ALWAYS_ASK_RISKS.has(risk) ? " (always needs a person)" : ""}</p>`,
      `<pre style="white-space:pre-wrap;font-size:12px">${escapeHtml(payload)}</pre>`,
      `<p><a href="${approve}">Approve</a> &nbsp;·&nbsp; <a href="${deny}">Deny</a> &nbsp;·&nbsp; <a href="${appUrl()}/org/${approval.organizationId}/mission?tab=approvals">Open the approvals inbox</a></p>`,
      `<p style="color:#888;font-size:12px">Each link opens a confirmation page, works once and expires in 24 hours.</p>`
    ].join("\n");
    if (await sendEmail({ orgId: approval.organizationId, to: recipient.email, subject: `Approval needed: ${summary}`.slice(0, 140), html })) sent += 1;
  }
  return sent;
}

/** Email a finished briefing to the managers. Returns how many emails went out. */
export async function emailBriefing(briefing: { id: string; organizationId: string; text: string | null; period: string }): Promise<number> {
  if (!briefing.text || !(await getEmailConfig(briefing.organizationId))) return 0;
  const recipients = await emailRecipients(briefing.organizationId, "emailBriefings");
  const html = [
    `<div style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${escapeHtml(briefing.text)}</div>`,
    `<p><a href="${appUrl()}/org/${briefing.organizationId}/mission?tab=briefings">Open Mission Control</a></p>`
  ].join("\n");
  let sent = 0;
  for (const recipient of recipients) {
    if (await sendEmail({ orgId: briefing.organizationId, to: recipient.email, subject: `Your ${briefing.period} briefing`, html })) sent += 1;
  }
  return sent;
}
