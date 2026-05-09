import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

const viewStateSchema = z.object({
  viewport: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    zoom: z.number().finite().min(0.1).max(4)
  }),
  selectedNodeId: z.string().trim().max(120).nullable().optional(),
  activeTab: z.enum(["home", "cofounder", "company", "tasks", "library"]).nullable().optional()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const state = await prisma.canvasViewState.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } }
    });

    return dataResponse({
      viewport: state ? JSON.parse(state.viewportJson) : { x: 0, y: 0, zoom: 1 },
      selectedNodeId: state?.selectedNodeId ?? null,
      activeTab: state?.activeTab ?? "home"
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const body = await request.json().catch(() => null);
    const parsed = viewStateSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Canvas view state is invalid.", 400, parsed.error.flatten());
    }

    const state = await prisma.canvasViewState.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
      update: {
        viewportJson: JSON.stringify(parsed.data.viewport),
        selectedNodeId: parsed.data.selectedNodeId ?? null,
        activeTab: parsed.data.activeTab ?? "home"
      },
      create: {
        userId: user.id,
        organizationId: orgId,
        viewportJson: JSON.stringify(parsed.data.viewport),
        selectedNodeId: parsed.data.selectedNodeId ?? null,
        activeTab: parsed.data.activeTab ?? "home"
      }
    });

    return dataResponse({
      viewport: JSON.parse(state.viewportJson),
      selectedNodeId: state.selectedNodeId,
      activeTab: state.activeTab
    });
  } catch (error) {
    return routeError(error);
  }
}
