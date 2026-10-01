import { getOrgCredential, integrationSettings } from "@/lib/security/vault";

import type { AgentTool, ToolContext } from "./types";

interface EmailConfig { apiKey: string; fromAddress: string }

export async function getEmailConfig(orgId: string): Promise<EmailConfig | null> {
  const apiKey = await getOrgCredential(orgId, "email", "apiKey", "RESEND_API_KEY");
  if (!apiKey) return null;
  const settings = await integrationSettings(orgId, "email");
  const fromAddress = typeof settings.fromAddress === "string" && settings.fromAddress ? settings.fromAddress : process.env.EMAIL_FROM_ADDRESS ?? "noreply@example.com";
  return { apiKey, fromAddress };
}

function noConfig() {
  return "Email not configured. Add an API key to the Email integration or set RESEND_API_KEY.";
}

export const emailSendTool: AgentTool = {
  definition: {
    name: "email_send",
    description: "Send an email via Resend. Use for transactional emails, outreach, or test sends.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject line" },
        body: { type: "string", description: "Email body — plain text or HTML" },
        from: { type: "string", description: "Sender address (overrides default from address)" }
      },
      required: ["to", "subject", "body"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const config = await getEmailConfig(ctx.orgId);
    if (!config) return noConfig();
    const to = typeof input.to === "string" ? input.to.trim() : "";
    const subject = typeof input.subject === "string" ? input.subject.trim() : "";
    const body = typeof input.body === "string" ? input.body : "";
    const from = typeof input.from === "string" ? input.from.trim() : config.fromAddress;
    if (!to || !subject) return "Error: to and subject are required";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, html: body.includes("<") ? body : `<p>${body.replace(/\n/g, "<br>")}</p>` })
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Resend ${res.status}: ${err.slice(0, 200)}`);
      }
      const data = await res.json() as { id?: string };
      return `Email sent (ID: ${data.id ?? "?"}) to ${to}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const emailListSentTool: AgentTool = {
  definition: {
    name: "email_list_sent",
    description: "List recently sent emails from this account.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of emails to return (default 10, max 50)" }
      }
    }
  },
  async execute(input, ctx: ToolContext) {
    const config = await getEmailConfig(ctx.orgId);
    if (!config) return noConfig();
    const limit = typeof input.limit === "number" ? Math.min(50, Math.max(1, input.limit)) : 10;
    try {
      const res = await fetch(`https://api.resend.com/emails?limit=${limit}`, {
        headers: { "Authorization": `Bearer ${config.apiKey}` }
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`Resend ${res.status}: ${err.slice(0, 200)}`);
      }
      const data = await res.json() as { data?: Array<{ id: string; to: string[]; subject: string; created_at: string }> };
      const emails = data.data ?? [];
      if (!emails.length) return "No emails sent yet.";
      return emails
        .map(e => `${e.id} → ${e.to.join(", ")} | "${e.subject}" | ${e.created_at}`)
        .join("\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};
