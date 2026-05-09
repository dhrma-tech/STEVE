import type { BadgeVariant, TaskStatus } from "@/components/ui/badge";

export const taskStatusOptions = [
  { value: "queued", label: "Queued", boardLabel: "Queue", variant: "neutral" },
  { value: "running", label: "Running", boardLabel: "Running", variant: "running" },
  { value: "finished_turn", label: "Finished turn", boardLabel: "Finished", variant: "running" },
  { value: "ready_to_review", label: "Ready to review", boardLabel: "Review", variant: "warning" },
  { value: "completed", label: "Completed", boardLabel: "Done", variant: "success" },
  { value: "blocked", label: "Blocked", boardLabel: "Blocked", variant: "danger" },
  { value: "canceled", label: "Canceled", boardLabel: "Canceled", variant: "neutral" }
] as const satisfies ReadonlyArray<{ value: TaskStatus; label: string; boardLabel: string; variant: BadgeVariant }>;

export type TaskStatusValue = (typeof taskStatusOptions)[number]["value"];

export const activeTaskStatuses: TaskStatusValue[] = ["queued", "running", "finished_turn", "ready_to_review", "blocked"];

export const taskTypeOptions = [
  { value: "agent_task", label: "Agent task" },
  { value: "user_task", label: "User task" },
  { value: "approval_task", label: "Agent requires approval" }
] as const;

export type TaskTypeValue = (typeof taskTypeOptions)[number]["value"];

export const executeModeOptions = [
  { value: "queue", label: "Queue" },
  { value: "now", label: "Execute now" },
  { value: "draft", label: "Save draft" }
] as const;

export type ExecuteModeValue = (typeof executeModeOptions)[number]["value"];

export const autoAssignOptions = [
  { value: "auto", label: "Auto assign" },
  { value: "manual", label: "Manual assignment" }
] as const;

export const appTargetOptions = [
  { value: "staging", label: "Staging app" },
  { value: "production", label: "Production app" },
  { value: "repository", label: "Repository" },
  { value: "integration", label: "Connected integration" }
] as const;

export const priorityOptions = [
  { value: "0", label: "Normal" },
  { value: "1", label: "Medium" },
  { value: "2", label: "High" },
  { value: "3", label: "Urgent" }
] as const;

export const taskViewOptions = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
  { value: "calendar", label: "Calendar" }
] as const;

export type TaskViewValue = (typeof taskViewOptions)[number]["value"];

export const taskStatusTransitions: Record<TaskStatusValue, TaskStatusValue[]> = {
  queued: ["running", "blocked", "canceled"],
  running: ["finished_turn", "ready_to_review", "blocked", "canceled"],
  finished_turn: ["running", "ready_to_review", "completed", "blocked", "canceled"],
  ready_to_review: ["completed", "running", "blocked", "canceled"],
  completed: ["queued"],
  blocked: ["queued", "running", "canceled"],
  canceled: ["queued"]
};

export function isTaskStatus(value: string): value is TaskStatusValue {
  return taskStatusOptions.some((status) => status.value === value);
}

export function isTaskType(value: string): value is TaskTypeValue {
  return taskTypeOptions.some((type) => type.value === value);
}

export function isTaskView(value: string): value is TaskViewValue {
  return taskViewOptions.some((view) => view.value === value);
}

export function taskStatusMeta(status: string) {
  return taskStatusOptions.find((option) => option.value === status) ?? taskStatusOptions[0];
}

export function taskTypeLabel(type: string) {
  return taskTypeOptions.find((option) => option.value === type)?.label ?? type;
}

