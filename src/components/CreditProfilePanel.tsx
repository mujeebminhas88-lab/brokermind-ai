/**
 * Credit Profile Panel — Prompt 7.
 * Beacon score input, tier visualization, trade line summary,
 * derogatory timeline countdowns, lender stream recommendation,
 * and Path to Prime rebuilding actions.
 */
import { useMemo } from "react";
import {
  useCreditProfileStore,
  beaconTier,
  derogatoryTimelines,
  recommendedStream,
  pathToPrime,
} from "@/store/creditProfileStore";
import { useUnderwritingConfigStore } from "@/store/underwritingConfigStore";
import { AlertTriangle, CheckCircle2, Clock, Gauge, Sparkles } from "lucide-react";

export function CreditProfilePanel() {
  const s = useCreditProfileStore();
  const patch = useCreditProfileStore((x) => x.patch);
  const cfg = useUnderwritingConfigStore();

  const tier = beaconTier(s.beacon);
  const timelines = useMemo(() => derogatoryTimelines(s), [s]);
  const recommended = useMemo(() => recommendedStream(s), [s]);
  const path = useMemo(() => pathToPrime(s), [s]);
  const misaligned = recommended !== cfg.stream;

  const beaconPct = s.beacon == null ? 0 : Math.min(100, Math.max(0, ((s.beacon - 300) / (900 - 300)) * 100));

  return (
    <section id="credit-profile" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            Beacon Score &amp; Credit Profile
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Third underwriting pillar — income · credit · equity
          </p>
        </div>
        <div className={`rounded-sm px-3 py-1.5 text-sm font-bold uppercase tracking-wider ${tier.bg} ${tier.color}`}>
          {tier.label}
        </div>
      </header>

      {/* Score input + tier bar */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">Beacon score</span>
          <input
            type="number"
            min={300}
            max={900}
            value={s.beacon ?? ""}
            onChange={(e) => patch({ beacon: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="e.g. 720"
            className="rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-[11px] text-muted-foreground">{tier.description}</span>
        </label>
        <div className="md:col-span-2 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>300</span>
            <span>760+ Excellent</span>
            <span>900</span>
          </div>
          <div className="relative h-3 rounded-sm bg-muted">
            <div className={`h-full rounded-sm ${tier.bar}`} style={{ width: `${beaconPct}%` }} />
            {[600, 650, 700, 760].map((n) => (
              <div
                key={n}
                className="absolute top-0 h-full w-px bg-border/70"
                style={{ left: `${((n - 300) / 600) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Private</span>
            <span>600 Weak</span>
            <span>650 Fair</span>
            <span>700 Good</span>
            <span>760 Excellent</span>
          </div>
        </div>
      </div>

      {/* Trade line summary */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <NumField
          label="Active trade lines"
          value={s.activeTrades}
          onChange={(v) => patch({ activeTrades: v })}
        />
        <NumField
          label="Oldest trade (years)"
          value={s.oldestTradeYears}
          step={0.5}
          onChange={(v) => patch({ oldestTradeYears: v })}
        />
        <NumField
          label="Revolving utilisation %"
          value={s.revolvingUtilisationPct}
          max={200}
          onChange={(v) => patch({ revolvingUtilisationPct: v })}
          suffix="%"
          flag={s.revolvingUtilisationPct > 65}
        />
      </div>

      {/* Derogatory items */}
      <div className="mt-5">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Derogatory items
        </h3>
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Check label="Collections" checked={s.hasCollections} onChange={(v) => patch({ hasCollections: v })} />
          <Check label="Judgement" checked={s.hasJudgement} onChange={(v) => patch({ hasJudgement: v })} />
          <Check
            label="Consumer Proposal"
            checked={s.hasConsumerProposal}
            onChange={(v) => patch({ hasConsumerProposal: v })}
          />
          <Check
            label="Bankruptcy"
            checked={s.hasBankruptcy}
            onChange={(v) => patch({ hasBankruptcy: v })}
          />
        </div>
        {(s.hasBankruptcy || s.hasConsumerProposal) && (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {s.hasBankruptcy && (
              <DateField
                label="Bankruptcy discharge date"
                value={s.bankruptcyDischargeDate}
                onChange={(v) => patch({ bankruptcyDischargeDate: v })}
              />
            )}
            {s.hasConsumerProposal && (
              <DateField
                label="Consumer Proposal completion date"
                value={s.consumerProposalCompletionDate}
                onChange={(v) => patch({ consumerProposalCompletionDate: v })}
              />
            )}
          </div>
        )}
      </div>

      {/* Timelines */}
      {timelines.length > 0 && (
        <div className="mt-5 space-y-2">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            A lender seasoning
          </h3>
          {timelines.map((t) => (
            <div
              key={t.type}
              className={`flex items-center justify-between rounded-sm border px-3 py-2 text-sm ${
                t.eligible
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-warning/40 bg-warning-bg text-warning-fg"
              }`}
            >
              <div className="flex items-center gap-2">
                {t.eligible ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                <span className="font-semibold">{t.label}</span>
              </div>
              <div className="text-xs font-mono">
                {t.eligible
                  ? `Eligible since ${t.eligibleAt.toLocaleDateString("en-CA")}`
                  : `A lender eligible in ${t.monthsUntilEligible} month${t.monthsUntilEligible === 1 ? "" : "s"} (${t.eligibleAt.toLocaleDateString("en-CA")})`}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lender stream recommendation */}
      <div className="mt-5 rounded-sm border border-border bg-background p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Recommended lender stream:
            <span className={misaligned ? "text-destructive" : "text-success"}>{recommended}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Currently selected: <span className="font-mono">{cfg.stream}</span>
          </div>
        </div>
        {misaligned && (
          <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
            <span>
              Current stream doesn&apos;t match credit profile. Consider switching to{" "}
              <button
                type="button"
                onClick={() => cfg.patch({ stream: recommended })}
                className="underline hover:no-underline"
              >
                {recommended}
              </button>
              .
            </span>
          </div>
        )}
      </div>

      {/* Path to Prime */}
      {path && (
        <div className="mt-5 rounded-sm border border-chart-2/40 bg-chart-2/5 p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-chart-2" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-chart-2">
              Path to Prime
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Score {s.beacon} · Actions to reach the next tier
          </p>
          <ol className="mt-3 space-y-2">
            {path.map((a, i) => (
              <li key={i} className="flex gap-3 rounded-sm bg-background p-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-chart-2/20 text-xs font-bold text-chart-2">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.detail}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

// -------- small controls --------

function NumField({
  label,
  value,
  onChange,
  step = 1,
  max,
  suffix,
  flag,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
  suffix?: string;
  flag?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="relative">
        <input
          type="number"
          min={0}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`w-full rounded-sm border bg-background px-2 py-1.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
            flag ? "border-destructive/50 text-destructive" : "border-border"
          }`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {flag && <span className="text-[11px] text-destructive">Above 65% — Beacon drag likely.</span>}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm ${
        checked ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-background text-foreground"
      }`}
    >
      <input
        type="checkbox"
        className="accent-destructive"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
