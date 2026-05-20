import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { ollamaChat } from "@/lib/ai/ollama";

type ColorPalette = { name: string; description: string; primary: string; secondary: string; accent: string };

function extractJSON(raw: string): string {
  const match = raw.match(/[\[{][\s\S]*[\]}]/);
  return match ? match[0] : raw;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId);

    const body = (await request.json()) as {
      phase: "names" | "colors";
      orgName?: string;
      idea?: string;
      theme?: string;
      style?: string;
      businessPlan?: string;
    };
    const planContext = body.businessPlan
      ? `\n\nFull business plan for deeper context:\n${body.businessPlan.slice(0, 3000)}`
      : "";

    if (body.phase === "names") {
      const raw = await ollamaChat({
        system: `You are a brand strategist. Suggest 5 creative company names that are directly inspired by the founder's business idea — the names must reflect the industry, audience, or core problem being solved.
Rules:
- Each name: 1-2 words, unique, brandable, memorable
- Names must feel specific to the idea, NOT generic tech names like "QuantumFlux", "NexaHub", or "EonSpark"
- No generic terms like "AI", "Hub", "Tech", "Spark", "Flux", or "Sphere" unless they naturally fit the domain
- Return ONLY a raw JSON array of exactly 5 strings — no explanation, no markdown
- Example for a tutoring startup: ["ScholarPath","GradeUp","MentorBridge","StudyNest","PassMate"]`,
        user: `Business idea: ${body.idea ?? body.orgName ?? "startup"}${planContext}\nGenerate names that a customer in this exact industry would immediately recognise as relevant.`
      });
      const parsed = JSON.parse(extractJSON(raw)) as unknown[];
      const names = parsed
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            return String(obj.name ?? obj.label ?? obj.company ?? Object.values(obj).find((v) => typeof v === "string") ?? "");
          }
          return String(item);
        })
        .filter(Boolean)
        .slice(0, 5);
      return NextResponse.json({ data: { names } });
    }

    if (body.phase === "colors") {
      const raw = await ollamaChat({
        system: `You are a brand designer. Create 3 distinct color palettes for a startup brand.
Return ONLY a raw JSON array of exactly 3 objects — no explanation, no markdown:
[{"name":"Palette Name","description":"one short sentence about the mood","primary":"#hexcode","secondary":"#hexcode","accent":"#hexcode"}]
Rules:
- Use valid 6-digit hex color codes only (e.g. #1E40AF)
- Palettes should each have a distinctly different feel
- Colors should work well on a ${body.theme ?? "dark"} themed interface`,
        user: `Startup idea: ${body.idea ?? "tech startup"}\nBrand style: ${body.style ?? "modern"}${planContext}`
      });
      const rawPalettes = JSON.parse(extractJSON(raw)) as Record<string, unknown>[];
      const palettes: ColorPalette[] = rawPalettes
        .slice(0, 3)
        .map((p) => ({
          name:        String(p.name ?? "Palette"),
          description: String(p.description ?? ""),
          primary:     String(p.primary ?? "#6366f1"),
          secondary:   String(p.secondary ?? "#a5b4fc"),
          accent:      String(p.accent ?? "#f59e0b"),
        }))
        .filter((p) => /^#[0-9a-fA-F]{6}$/.test(p.primary));
      return NextResponse.json({ data: { palettes } });
    }

    return NextResponse.json({ error: "Invalid phase." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
