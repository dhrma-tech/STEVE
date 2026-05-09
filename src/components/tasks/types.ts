import type { TaskDetailData, TaskWorkspaceData } from "@/lib/tasks/data";

export type TaskWorkspacePayload = TaskWorkspaceData;
export type TaskCatalog = TaskWorkspaceData["catalog"];
export type TaskSummary = TaskWorkspaceData["tasks"][number];
export type TaskDetail = NonNullable<TaskDetailData>;

