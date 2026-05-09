import type { Metadata } from "next";
import { CanvasWorkspace } from "@/components/canvas/canvas-workspace";
import { getCanvasData } from "@/lib/canvas/data";

export const metadata: Metadata = {
  title: "Canvas - Cofounder",
  description: "Company workspace canvas with departments, roadmap, tasks, and files."
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
