import { z } from "zod";
import { API_SCOPES } from "./api-keys";
import { TRIGGER_SOURCES } from "./inbound";

/** Request bodies for the automation settings routes. */

export const scheduleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cron: z.string().trim().min(1).max(120),
  timezone: z.string().trim().max(64).optional(),
  target: z.enum(["goal", "agent"]),
  instruction: z.string().trim().min(3).max(4000),
  agentId: z.string().trim().min(1).nullable().optional(),
  autoApprove: z.boolean().optional(),
  enabled: z.boolean().optional()
});

export const triggerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  source: z.enum(TRIGGER_SOURCES),
  eventPattern: z.string().trim().max(200).optional(),
  target: z.enum(["goal", "agent"]),
  instruction: z.string().trim().min(3).max(4000),
  agentId: z.string().trim().min(1).nullable().optional(),
  signingSecret: z.string().trim().max(500).nullable().optional(),
  enabled: z.boolean().optional()
});

export const triggerPatchSchema = triggerSchema.omit({ source: true }).partial();

export const channelSchema = z.object({
  kind: z.enum(["slack", "webhook"]),
  name: z.string().trim().max(120).default(""),
  url: z.string().trim().min(8).max(2000),
  events: z.array(z.string()).min(1).max(20),
  enabled: z.boolean().optional()
});

export const channelPatchSchema = z.object({
  name: z.string().trim().max(120).optional(),
  url: z.string().trim().min(8).max(2000).optional(),
  events: z.array(z.string()).min(1).max(20).optional(),
  enabled: z.boolean().optional()
});

export const apiKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1).optional()
});
