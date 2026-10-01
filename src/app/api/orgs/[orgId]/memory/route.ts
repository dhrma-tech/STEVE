import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { isValidScope, listMemories, MAX_VALUE_LENGTH, remember } from "@/lib/memory/store";

const createSchema = z.object({
  scope: z.string().trim().min(1).max(120).default("org"),
  key: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(MAX_VALUE_LENGTH)
});

type RouteContext = { params: Promise<{ orgId: string }> };

/** The company's memory, for the founder: what agents know, and what is waiting for review. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    await requireOrgMember(orgId);
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const [memories, departments, agents] = await Promise.all([
      listMemories(orgId, {
        status: status === "active" || status === "proposed" ? status : undefined,
        scope: url.searchParams.get("scope") ?? undefined,
        q: url.searchParams.get("q")?.trim() || undefined
      }),
      prisma.department.findMany({ where: { organizationId: orgId }, select: { slug: true, name: true }, orderBy: { sortOrder: "asc" } }),
      prisma.agent.findMany({ where: { organizationId: orgId, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    ]);
    // The scopes a memory can be filed under, for the editor.
    const scopes = [
      { value: "org", label: "Company" },
      ...departments.map((d) => ({ value: `department:${d.slug}`, label: `${d.name} department` })),
      ...agents.map((a) => ({ value: `agent:${a.id}`, label: `${a.name} (own notes)` }))
    ];
    return dataResponse({ memories, scopes });
  } catch (error) {
    return routeError(error);
  }
}

/** The founder teaches the team a fact directly. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return errorResponse("VALIDATION_ERROR", "A key and a value are required.", 422, parsed.error.flatten());
    if (!isValidScope(parsed.data.scope)) return errorResponse("VALIDATION_ERROR", "Unknown scope.", 422);

    const result = await remember({ orgId, ...parsed.data, source: "founder", userId: user.id });
    if ("skipped" in result) return errorResponse("VALIDATION_ERROR", `Not saved: ${result.skipped}.`, 422);
    return dataResponse({ memory: result.memory, replaced: result.previous }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return routeError(error);
  }
}
