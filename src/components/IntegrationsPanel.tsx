/**
 * Integration Settings Panel — Mindee (document parsing), Flinks (bank),
 * Plaid (transactions). Keys are managed in secrets and never touch the
 * browser or database; this panel reflects current status.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { checkIntegrations } from "@/lib/integrations.functions";

type Provider = "mindee" | "flinks" | "plaid";

interface StatusRow {
  provider: Provider;
  status: "connected" | "not_configured" | "error";
  key_last4: string | null;
  last_tested_at: string | null;
}

const PROVIDERS: { id: Provider; label: string; description: string }[] = [
  { id: "mindee", label: "Document Parsing", description: "Mindee / Google Document AI — OCR & tax slip extraction." },
  { id: "flinks", label: "Bank Verification", description: "Flinks — connect and verify chequing / savings accounts." },
  { id: "plaid", label: "Transaction Verification", description: "Plaid — transaction history and income streams." },
];

export function IntegrationsPanel() {
  const check = useServerFn(checkIntegrations);
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("integration_status").select("*");
    setRows(((data ?? []) as unknown as StatusRow[]));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await check();
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      const now = new Date().toISOString();
      for (const r of results) {
        await supabase.from("integration_status").upsert(
          {
            user_id: uid,
            provider: r.provider,
            status: r.configured ? "connected" : "not_configured",
            key_last4: r.last4,
            last_tested_at: now,
            last_error: null,
          },
          { onConflict: "user_id,provider" },
        );
      }
      await load();
      toast.success("Integration status refreshed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setLoading(false);
    }
  }, [check, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const byProvider: Record<string, StatusRow | undefined> = Object.fromEntries(rows.map((r) => [r.provider, r]));

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight">Integrations</h2>
          <p className="text-xs text-muted-foreground">
            Third-party services powering document parsing, bank & transaction verification.
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-muted disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Test All
        </button>
      </header>

      <div className="mb-4 flex items-start gap-2 rounded-sm border border-chart-2/30 bg-chart-2/5 p-3 text-[11px] text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none text-chart-2" />
        <span>
          API keys are stored server-side and never exposed to the browser. Only the last 4 characters are shown for verification.
          To add or rotate a key, ask an admin to update it via the secrets manager.
        </span>
      </div>

      <ul className="space-y-3">
        {PROVIDERS.map((p) => {
          const r = byProvider[p.id];
          const status = r?.status ?? "not_configured";
          return (
            <li key={p.id} className="rounded-sm border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{p.label}</span>
                    <StatusBadge status={status} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{p.description}</p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {r?.key_last4 ? `•••• ${r.key_last4}` : "no key on file"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {r?.last_tested_at ? `Tested ${new Date(r.last_tested_at).toLocaleString()}` : "Not tested yet"}
                  </div>
                </div>
              </div>
            </li>
          );
        })}

        <li className="rounded-sm border border-dashed border-border bg-background/60 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            AI Engine
            <span className="rounded-sm border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-chart-2">
              Managed
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Anthropic Claude — provisioned and rotated by BrokerMind. Not user-configurable.
          </p>
        </li>
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: "connected" | "not_configured" | "error" }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
        <CheckCircle2 className="h-2.5 w-2.5" /> Connected
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
        <XCircle className="h-2.5 w-2.5" /> Error
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      Not configured
    </span>
  );
}
