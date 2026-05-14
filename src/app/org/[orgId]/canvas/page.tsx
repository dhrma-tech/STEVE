import type { Metadata } from "next";
import { CanvasWorkspace } from "@/components/canvas/canvas-workspace";
import { getCanvasData } from "@/lib/canvas/data";

export const metadata: Metadata = {
  title: "Canvas",
  description: "Your company workspace — departments, roadmap, tasks, files, and chat in one canvas."
};

type CanvasPageProps = {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CanvasPage({ params, searchParams }: CanvasPageProps) {
  const { orgId } = await params;
  const query = await searchParams;
  const data = await getCanvasData(orgId);

  return <CanvasWorkspace data={data} query={query} />;
}
