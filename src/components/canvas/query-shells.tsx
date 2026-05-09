"use client";
import { AgentWorkspaceDialog } from "@/components/agents/agent-workspace-dialog";
import { RoadmapModal } from "@/components/roadmap/roadmap-modal";
import type { CanvasData } from "@/lib/canvas/data";

export function QueryShells({
  data,
  roadmapVisible,
  onRoadmapVisibleChange,
  sessionVisible,
  onSessionVisibleChange,
  sessionId,
  onSessionLaunch
}: {
  data: CanvasData;
  roadmapVisible: boolean;
  onRoadmapVisibleChange: (visible: boolean) => void;
  sessionVisible: boolean;
  onSessionVisibleChange: (visible: boolean) => void;
  sessionId: string | null;
  onSessionLaunch: (sessionId: string) => void;
}) {
  return (
    <>
      <RoadmapModal
        orgId={data.organization.id}
        open={roadmapVisible}
        onOpenChange={onRoadmapVisibleChange}
        onLaunchSession={onSessionLaunch}
      />

      <AgentWorkspaceDialog
        orgId={data.organization.id}
        sessionId={sessionId}
        open={sessionVisible && Boolean(sessionId)}
        onOpenChange={onSessionVisibleChange}
      />
    </>
  );
}
