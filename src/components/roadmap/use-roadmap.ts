"use client";

import * as React from "react";
import type { RoadmapData } from "@/lib/roadmap/data";

type RoadmapState =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: RoadmapData | null; error: null }
  | { status: "ready"; data: RoadmapData; error: null }
  | { status: "error"; data: null; error: string };

export function useRoadmap(orgId: string, open: boolean) {
  const [reloadToken, setReloadToken] = React.useState(0);
  const [state, setState] = React.useState<RoadmapState>({ status: "idle", data: null, error: null });

  const reload = React.useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setState((current) => ({ status: "loading", data: current.data, error: null }));
    });

    fetch(`/api/orgs/${orgId}/roadmap`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(payload?.error?.message ?? "Unable to load roadmap");
        }
        return response.json() as Promise<{ data: RoadmapData }>;
      })
      .then((payload) => {
        if (active) setState({ status: "ready", data: payload.data, error: null });
      })
      .catch((error: Error) => {
        if (active) setState({ status: "error", data: null, error: error.message });
      });

    return () => {
      active = false;
    };
  }, [open, orgId, reloadToken]);

  return { ...state, reload };
}
