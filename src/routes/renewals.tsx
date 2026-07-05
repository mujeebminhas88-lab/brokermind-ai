import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { RenewalPipelinePanel } from "@/components/RenewalPipelinePanel";

export const Route = createFileRoute("/renewals")({
  component: () => (
    <AuthGate>
      <RenewalsPage />
    </AuthGate>
  ),
  head: () => ({
    meta: [
      { title: "Renewals — BrokerMind AI" },
      { name: "description", content: "Track upcoming mortgage renewals, urgency, and outreach status." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Not found.</div>,
});

function RenewalsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[1800px] px-6 py-8">
        <h1 className="mb-4 font-display text-2xl font-bold tracking-tight text-foreground">
          Renewal Pipeline
        </h1>
        <RenewalPipelinePanel />
      </main>
    </div>
  );
}
