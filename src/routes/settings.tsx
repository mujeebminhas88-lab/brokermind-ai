import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";
import { AuditLogViewer } from "@/components/AuditLogViewer";
import { SettingsAuditPanel } from "@/components/SettingsAuditPanel";
import { FirmProfilePanel } from "@/components/FirmProfilePanel";
import { IntegrationsPanel } from "@/components/IntegrationsPanel";
import { UserPreferencesPanel } from "@/components/UserPreferencesPanel";
import { TeamPanel } from "@/components/TeamPanel";
import { WhiteLabelPanel } from "@/components/WhiteLabelPanel";
import { LenderPolicyPanel } from "@/components/LenderPolicyPanel";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";
import { Building2, Cog, FileText, Palette, Plug, ShieldCheck, Users, RotateCcw } from "lucide-react";

type Tab = "firm" | "branding" | "integrations" | "team" | "policies" | "preferences" | "audit";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "firm", label: "Firm Profile", icon: Building2 },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "team", label: "Team & Access", icon: Users },
  { id: "policies", label: "Lender Policies", icon: ShieldCheck },
  { id: "preferences", label: "Preferences", icon: Cog },
  { id: "audit", label: "Audit Trail", icon: FileText },
];

export const Route = createFileRoute("/settings")({
  component: () => (
    <AuthGate>
      <SettingsPage />
    </AuthGate>
  ),
  head: () => ({
    meta: [
      { title: "Settings — BrokerMind AI" },
      { name: "description", content: "Firm profile, branding, integrations, lender policies, and preferences for BrokerMind AI." },
    ],
  }),
});

function SettingsPage() {
  const [tab, setTab] = useState<Tab>("firm");
  const prefs = useUserPreferencesStore();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Firm profile, branding, integrations, team access, and workspace preferences.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:space-y-1 lg:overflow-visible">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-sm border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider transition-colors lg:w-full ${
                    active
                      ? "border-chart-2 bg-chart-2/10 text-chart-2"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>

          <div>
            {tab === "firm" && <FirmProfilePanel />}
            {tab === "branding" && <WhiteLabelPanel />}
            {tab === "integrations" && <IntegrationsPanel />}
            {tab === "team" && <TeamPanel />}
            {tab === "policies" && <LenderPolicyPanel />}
            {tab === "preferences" && (
              <div className="space-y-6">
                <UserPreferencesPanel />
                <section className="rounded-sm border border-border bg-card p-5">
                  <h2 className="font-display text-base font-bold tracking-tight">Onboarding</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Replay the guided setup wizard from the beginning.
                  </p>
                  <button
                    onClick={() => void prefs.patch({ onboarding_completed: false })}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-muted"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset Onboarding
                  </button>
                </section>
              </div>
            )}
            {tab === "audit" && (
              <div className="space-y-6">
                <SettingsAuditPanel />
                <section className="rounded-sm border border-border bg-card p-5">
                  <h2 className="font-display text-base font-bold tracking-tight text-foreground">Full Audit Trail</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Immutable append-only log of every sensitive operation.
                  </p>
                  <div className="mt-4">
                    <AuditLogViewer />
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
