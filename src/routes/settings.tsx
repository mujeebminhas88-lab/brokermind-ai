import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/settings")({
  component: () => (
    <AuthGate>
      <SettingsPage />
    </AuthGate>
  ),
  head: () => ({
    meta: [
      { title: "Settings — BrokerMind AI" },
      { name: "description", content: "Workspace configuration for BrokerMind AI underwriting workspace." },
    ],
  }),
});

function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[1800px] px-6 py-10">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Workspace preferences, integrations, and theme controls.
        </p>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { title: "Brand Identity", body: "BrokerMind AI · Neon prestige palette" },
            { title: "Underwriting Stream", body: "Standard · Alt/Private BFS · Corporate" },
            { title: "Compliance Engine", body: "OSFI B-20 · Super Priority detection" },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-sm border border-border bg-card p-5"
            >
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {c.title}
              </div>
              <div className="mt-2 font-display text-sm font-semibold text-foreground">{c.body}</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
