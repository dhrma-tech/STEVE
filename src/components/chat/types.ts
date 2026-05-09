import type { ChatThreadDetailData, ChatWorkspaceData } from "@/lib/chat/data";

export type ChatWorkspacePayload = ChatWorkspaceData;
export type ChatThreadSummary = ChatWorkspaceData["threads"][number];
export type ChatThreadDetail = NonNullable<ChatThreadDetailData>;
export type ChatMessage = ChatThreadDetail["messages"][number];
export type ChatCatalog = ChatWorkspaceData["catalog"];
