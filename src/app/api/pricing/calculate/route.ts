import { NextResponse } from "next/server";
import { z } from "zod";
import { calculatePricing } from "@/lib/pricing/calculator";

const pricingQuerySchema = z.object({
  plan: z.enum(["trial", "pro", "team"]).default("pro"),
  businessSize: z.coerce.number().min(1).max(10).default(3)
});

export function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = pricingQuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PRICING_INPUT",
          message: "Pricing calculator input is invalid.",
          details: parsed.error.flatten()
        }
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    data: calculatePricing(parsed.data)
  });
}

