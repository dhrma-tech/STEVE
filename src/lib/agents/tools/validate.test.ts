import { describe, expect, it } from "vitest";
import { validateToolInput } from "./validate";
import { buildToolset } from "./registry";
import type { ToolDefinition } from "./types";

const email: ToolDefinition = {
  name: "email_send",
  description: "Send an email",
  input_schema: {
    type: "object",
    properties: {
      to: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
      cc: { type: "array", items: { type: "string" } },
      priority: { type: "string", enum: ["low", "high"] },
      retries: { type: "integer", minimum: 0, maximum: 3 }
    },
    required: ["to", "subject", "body"]
  }
};

describe("validateToolInput", () => {
  it("accepts a call that matches the schema", () => {
    expect(validateToolInput(email, { to: "a@b.co", subject: "Hi", body: "Hello" })).toEqual({ ok: true });
  });

  it("names every missing or mistyped field so the model can fix the call", () => {
    const check = validateToolInput(email, { subject: 5, body: "x" });
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.error).toMatch(/^Invalid input for email_send:/);
      expect(check.error).toContain("to:");
      expect(check.error).toContain("subject:");
    }
  });

  it("rejects blank required strings", () => {
    const check = validateToolInput(email, { to: "  ", subject: "Hi", body: "x" });
    expect(check).toMatchObject({ ok: false });
    if (!check.ok) expect(check.error).toContain("to: must not be empty");
  });

  it("checks arrays, enums and integer bounds", () => {
    expect(validateToolInput(email, { to: "a", subject: "b", body: "c", cc: "x@y.z" }).ok).toBe(false);
    expect(validateToolInput(email, { to: "a", subject: "b", body: "c", priority: "urgent" }).ok).toBe(false);
    expect(validateToolInput(email, { to: "a", subject: "b", body: "c", retries: 9 }).ok).toBe(false);
    expect(validateToolInput(email, { to: "a", subject: "b", body: "c", retries: 1.5 }).ok).toBe(false);
  });

  it("is lenient where models commonly are: numeric strings, nulls for optional fields, extra fields", () => {
    expect(validateToolInput(email, { to: "a", subject: "b", body: "c", retries: "2" }).ok).toBe(true);
    expect(validateToolInput(email, { to: "a", subject: "b", body: "c", cc: null }).ok).toBe(true);
    expect(validateToolInput(email, { to: "a", subject: "b", body: "c", legacyField: true }).ok).toBe(true);
  });

  it("rejects a non-object input", () => {
    expect(validateToolInput(email, "send it").ok).toBe(false);
    expect(validateToolInput(email, null).ok).toBe(false);
  });

  it("builds a validator for every registered tool", () => {
    const toolset = buildToolset([
      "github-repository", "vercel-preview", "postiz-social", "email-outbound", "stripe-billing", "apify-scraping", "monitoring-ops", "supabase-database", "support-inbox"
    ]);
    expect(toolset.length).toBeGreaterThan(40);
    for (const tool of toolset) {
      expect(() => validateToolInput(tool.definition, {})).not.toThrow();
    }
  });
});
