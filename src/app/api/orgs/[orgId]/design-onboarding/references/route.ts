import { z } from "zod";
import { dataResponse, errorResponse } from "@/lib/api/responses";
import { AuthError, ForbiddenError, requireOrgMember } from "@/lib/auth/session";
import { saveDesignReferences } from "@/lib/onboarding/company";

const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const jsonSchema = z.object({
  files: z.array(z.object({ name: z.string().min(1), type: z.string(), size: z.number().nonnegative() })).max(6),
  description: z.string().max(1000).optional().nullable()
});

type RouteContext = { params: Promise<{ orgId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { orgId } = await context.params;
    const { user } = await requireOrgMember(orgId);
    const contentType = request.headers.get("content-type") ?? "";
    let payload: z.infer<typeof jsonSchema>;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const files = formData
        .getAll("files")
        .filter((file): file is File => file instanceof File)
        .map((file) => ({ name: file.name, type: file.type, size: file.size }));
      payload = {
        files,
        description: String(formData.get("description") ?? "")
      };
    } else {
      const body = await request.json().catch(() => null);
      const parsed = jsonSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse("VALIDATION_ERROR", "Design references input is invalid.", 400, parsed.error.flatten());
      }
      payload = parsed.data;
    }

    if (payload.files.length > 6 || payload.files.some((file) => !allowedTypes.has(file.type))) {
      return errorResponse("VALIDATION_ERROR", "Upload up to 6 PNG, JPG, or WebP references.", 400);
    }

    return dataResponse(await saveDesignReferences({ organizationId: orgId, userId: user.id, ...payload }));
  } catch (error) {
    if (error instanceof AuthError) return errorResponse("UNAUTHENTICATED", error.message, 401);
    if (error instanceof ForbiddenError) return errorResponse("FORBIDDEN", error.message, 403);
    throw error;
  }
}

