"use client";

import * as React from "react";
import type { DepartmentDetailData } from "@/lib/departments/data";

type DepartmentDetail = NonNullable<DepartmentDetailData>;

type DepartmentDetailState =
  | { status: "loading"; detail: null; error: null }
  | { status: "ready"; detail: DepartmentDetail; error: null }
  | { status: "error"; detail: null; error: string };

export function useDepartmentDetail(orgId: string, departmentId: string) {
  const [state, setState] = React.useState<DepartmentDetailState>({ status: "loading", detail: null, error: null });
  const [reloadToken, setReloadToken] = React.useState(0);

  const reload = React.useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  React.useEffect(() => {
    let active = true;
    setState({ status: "loading", detail: null, error: null });
    fetch(`/api/orgs/${orgId}/departments/${encodeURIComponent(departmentId)}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          throw new Error(payload?.error?.message ?? "Unable to load department");
        }
        return response.json() as Promise<{ data: DepartmentDetail }>;
      })
      .then((payload) => {
        if (active) setState({ status: "ready", detail: payload.data, error: null });
      })
      .catch((error: Error) => {
        if (active) setState({ status: "error", detail: null, error: error.message });
      });

    return () => {
      active = false;
    };
  }, [departmentId, orgId, reloadToken]);

  return { ...state, reload };
}
