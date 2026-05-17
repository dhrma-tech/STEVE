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
    };

    if (body.phase === "names") {
      const raw = await ollamaChat({
        system: `You are a brand strategist. Suggest 5 creative company names for a startup.
Rules:
- Each name: 1-2 words, unique, brandable, memorable, no generic terms like "AI" or "Hub"
- Return ONLY a raw JSON array of exactly 5 strings — no explanation, no markdown
- Example: ["Nexora","Buildly","Launchfold","Velo","Corista"]`,
        user: `Business idea: ${body.idea ?? body.orgName ?? "startup"}\nCurrent org name: ${body.orgName ?? "unknown"}`
      });
      const names = JSON.parse(extractJSON(raw)) as string[];
      return NextResponse.json({ data: { names: names.slice(0, 5) } });
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
        user: `Startup idea: ${body.idea ?? "tech startup"}\nBrand style: ${body.style ?? "modern"}`
      });
      const palettes = JSON.parse(extractJSON(raw)) as ColorPalette[];
      return NextResponse.json({ data: { palettes: palettes.slice(0, 3) } });
    }

    return NextResponse.json({ error: "Invalid phase." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
