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
    <main className="min-h-full bg-[var(--app-canvas)] p-4 text-[var(--app-text)] md:p-6">
      <div className="mx-auto max-w-[1320px]">
        <IntegrationCenter orgId={orgId} initialData={await getIntegrationsData(orgId)} />
      </div>
    </main>
  );
}

