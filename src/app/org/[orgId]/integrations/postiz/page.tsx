import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostizIntegration } from "@/components/integrations/postiz-integration";
import { getPostizIntegration } from "@/lib/integrations/data";

export const metadata: Metadata = {
  title: "Postiz",
  description: "Connect your social publishing channels so agents can ship marketing without leaving your workspace."
};

type PostizPageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function PostizPage({ params }: PostizPageProps) {
  const { orgId } = await params;
  const data = await getPostizIntegration(orgId);
  if (!data) notFound();
  return <PostizIntegration orgId={orgId} initialData={data} />;
}
