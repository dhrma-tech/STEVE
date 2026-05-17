import type { Metadata } from "next";
import { IntegrationCenter } from "@/components/integrations/integration-center";
import { getIntegrationsData } from "@/lib/integrations/data";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect GitHub, Vercel, Supabase, Stripe, Postiz, and the other tools your company runs on."
};

type IntegrationsPageProps = {
  params: Promise<{ orgId: string }>;
};

export default async function IntegrationsPage({ params }: IntegrationsPageProps) {
  const { orgId } = await params;
  return (
    <main className="min-h-full bg-[var(--background)] p-6 text-[var(--foreground)] md:p-8">
      <div className="mx-auto max-w-[1100px]">
        <IntegrationCenter orgId={orgId} initialData={await getIntegrationsData(orgId)} />
      </div>
    </main>
  );
}

