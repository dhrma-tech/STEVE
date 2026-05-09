import type { AgentDetailData, AgentWorkspaceData, SessionDetailData } from "@/lib/agents/data";

export type AgentWorkspacePayload = AgentWorkspaceData;
export type AgentSummary = AgentWorkspaceData["agents"][number];
export type AgentDetail = NonNullable<AgentDetailData>;
export type AgentSessionDetail = NonNullable<SessionDetailData>;

