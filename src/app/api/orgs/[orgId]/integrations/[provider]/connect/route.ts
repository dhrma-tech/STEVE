import { z } from "zod";
import { dataResponse } from "@/lib/api/responses";
import { routeError } from "@/lib/api/route-errors";
import { connectIntegration } from "@/lib/integrations/data";

const connectSchema = z.object({
  config: z.record(z.string(), z.unknown()).default({})
});

type RouteContext = { params: Promise<{ orgId: string; provider: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const parsed = connectSchema.parse(await request.json().catch(() => ({})));
    const { orgId, provider } = await context.params;
    return dataResponse(await connectIntegration({ orgId, provider, config: parsed.config }));
  } catch (error) {
    return routeError(error);
  }
}
