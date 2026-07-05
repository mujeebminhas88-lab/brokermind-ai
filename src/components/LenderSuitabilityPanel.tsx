/**
 * Lender Suitability Output — Prompt 14
 * Auto-classification + reasoning + rate range + manual override with audit log.
 */
import { useMemo, useState } from "react";
import { Building2, AlertTriangle, ShieldCheck, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { useDerivedFinancials } from "@/store/applicationStore";
import { useCreditProfileStore } from "@/store/creditProfileStore";
import { usePropertyStore, analyzeEligibility } from "@/store/propertyStore";
import { useApplicationStore } from "@/store/applicationStore";
import { computeSuitability, type SuitabilityTier } from "@/utils/lenderSuitability";
import { supabase } from "@/integrations/supabase/client";

const tierMeta: Record<SuitabilityTier, { color: string; border: string; bg: string; label: string }> = {
  Prime: { color: "text-success", border: "border-success/40", bg: "bg-success/10", label: "PRIME · A Lender" },
  Alt: { color: "text-warning-fg", border: "border-warning/40", bg: "bg-warning-bg", label: "ALT · B Lender" },
  Private: { color: "text-destructive", border: "border-destructive/40", bg: "bg-destructive/10", label: "PRIVATE / MIC" },
};

export function LenderSuitabilityPanel({
  applicationId,
  employmentType,
}: {
  applicationId?: string | null;
  employmentType?: "Salaried" | "Self-Employed" | "Incorporated" | null;
}) {
  const financials = useDerivedFinancials();
  const credit = useCreditProfileStore();
  const property = usePropertyStore();
  const loan = useApplicationStore((s) => s.loan);
  const setLenderStream = useApplicationStore((s) => s.setLenderStream);

  const elig = useMemo(
    () => analyzeEligibility(property, loan.propertyPrice, loan.amortizationYears),
    [property, loan.propertyPrice, loan.amortizationYears],
  );

  const rec = useMemo(
    () => computeSuitability(credit, financials, elig, employmentType ?? null),
    [credit, financials, elig, employmentType],
  );

  const [overrideTier, setOverrideTier] = useState<SuitabilityTier | null>(null);
  const [editing, setEditing] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [saving, setSaving] = useState(false);

  const finalTier = overrideTier ?? rec.tier;
  const meta = tierMeta[finalTier];

  const submitOverride = async () => {
    if (!overrideNote.trim()) {
      toast.error("Override requires a rationale note.");
      return;
    }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (uid) {
        await supabase.from("audit_logs").insert({
          user_id: uid,
          application_id: applicationId ?? null,
          action: "LENDER_SUITABILITY_OVERRIDE",
          action_type: "UPDATE",
          entity_type: "lender_suitability",
          entity_id: applicationId ?? null,
          table_name: "underwriting_applications",
          record_id: applicationId ?? null,
          details: {
            recommended: rec.tier,
            overrideTo: overrideTier,
            note: overrideNote,
            reasons: rec.reasons,
          },
        } as never);
      }
      // Sync to application lenderStream (A/B)
      setLenderStream(finalTier === "Prime" ? "A" : "B");
      toast.success("Override recorded and logged to audit trail.");
      setEditing(false);
    } catch (e) {
      toast.error("Failed to save override.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="lender-suitability" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Lender Suitability Recommendation
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Auto-derived from credit, ratios, property, and employment complexity.
          </p>
        </div>
        {!editing ? (
          <button
            onClick={() => {
              setEditing(true);
              setOverrideTier(rec.tier);
            }}
            className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-xs hover:bg-muted"
          >
            <Pencil className="h-3 w-3" /> Override
          </button>
        ) : (
          <button
            onClick={() => {
              setEditing(false);
              setOverrideTier(null);
              setOverrideNote("");
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        )}
      </header>

      <div className={`mt-4 rounded-sm border ${meta.border} ${meta.bg} p-4`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {overrideTier && overrideTier !== rec.tier ? "Override — Manual" : "Recommendation"}
            </div>
            <div className={`mt-1 text-2xl font-black uppercase tracking-tight ${meta.color}`}>{meta.label}</div>
          </div>
          <ShieldCheck className={`h-8 w-8 ${meta.color}`} />
        </div>
        <div className="mt-3 rounded-sm border border-border/60 bg-background/40 p-2 text-xs">
          <span className="font-semibold text-muted-foreground">Indicative Rate: </span>
          <span className="font-mono text-foreground">{rec.rateRange}</span>
        </div>
      </div>

      {rec.criticalFlags.length > 0 && (
        <div className="mt-3 space-y-1">
          {rec.criticalFlags.map((f, i) => (
            <div key={i} className="flex items-start gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span><strong>CRITICAL:</strong> {f}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Why this classification?
          </h3>
          <ul className="space-y-1 text-xs">
            {rec.reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground/60">•</span>
                <span className="text-foreground">{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tier-Specific Notes
          </h3>
          <ul className="space-y-1 text-xs">
            {rec.notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground/60">•</span>
                <span className="text-muted-foreground">{n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {editing && (
        <div className="mt-4 rounded-sm border border-primary/40 bg-primary/5 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Manual Override
          </div>
          <div className="flex flex-wrap gap-2">
            {(["Prime", "Alt", "Private"] as SuitabilityTier[]).map((t) => (
              <button
                key={t}
                onClick={() => setOverrideTier(t)}
                className={`rounded-sm border px-3 py-1 text-xs font-semibold ${
                  overrideTier === t ? `${tierMeta[t].border} ${tierMeta[t].bg} ${tierMeta[t].color}` : "border-border bg-background text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={overrideNote}
            onChange={(e) => setOverrideNote(e.target.value)}
            placeholder="Rationale for override (mandatory) — will be logged to audit trail."
            className="mt-3 w-full rounded-sm border border-input bg-background p-2 text-xs"
            rows={3}
          />
          <button
            onClick={submitOverride}
            disabled={saving}
            className="mt-2 inline-flex items-center gap-1 rounded-sm border border-primary bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Check className="h-3 w-3" /> {saving ? "Saving..." : "Save Override & Log"}
          </button>
        </div>
      )}
    </section>
  );
}
