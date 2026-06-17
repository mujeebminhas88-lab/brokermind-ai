import { useEffect, useState } from "react";
import { FlaskConical, Zap, RotateCcw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  analyzeNoticeOfAssessment,
  type NoaAnalysis,
  type NoaPayload,
} from "@/utils/noaParser";

export type SandboxFields = {
  taxpayer_name: string;
  tax_year: number;
  line_15000_total_income: number;
  prior_year_line_15000: number;
  line_23600_net_income: number;
  balance_owing_at_assessment: number;
  has_unarranged_arrears: boolean;
};

const DEFAULTS: SandboxFields = {
  taxpayer_name: "Mujeeb Minhas",
  tax_year: 2025,
  line_15000_total_income: 94500,
  prior_year_line_15000: 93100,
  line_23600_net_income: 88940.12,
  balance_owing_at_assessment: 4250.31,
  has_unarranged_arrears: true,
};

export function SandboxToggleBar({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between border-b border-border bg-card px-6 py-2.5"
      style={
        enabled
          ? {
              background:
                "linear-gradient(90deg, color-mix(in oklab, var(--emerald) 10%, var(--card)) 0%, var(--card) 60%)",
              borderColor: "var(--emerald)",
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-7 w-7 items-center justify-center"
          style={{
            background: enabled ? "var(--emerald-deep)" : "var(--secondary)",
            color: enabled ? "var(--primary-foreground)" : "var(--muted-foreground)",
          }}
        >
          <FlaskConical className="h-3.5 w-3.5" strokeWidth={2.5} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
              UNDERWRITER OVERRIDE
            </span>
            <h2 className="text-[13px] font-bold tracking-tight">Developer Sandbox Mode</h2>
          </div>
          {enabled ? (
            <p
              className="flex items-center gap-1.5 text-[11px] font-semibold"
              style={{ color: "var(--emerald-deep)" }}
            >
              <Zap className="h-3 w-3" /> Sandbox Mode Active · Simulating Underwriting Payloads
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Bypass OCR pipeline · stress-test scoring with manual payloads
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="font-mono text-[10px] font-bold tracking-[0.18em]"
          style={{ color: enabled ? "var(--emerald-deep)" : "var(--muted-foreground)" }}
        >
          {enabled ? "ON" : "OFF"}
        </span>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label="Toggle sandbox mode" />
      </div>
    </div>
  );
}

export function SandboxPanel({
  onAnalyzed,
  onClear,
}: {
  onAnalyzed: (a: NoaAnalysis) => void;
  onClear: () => void;
}) {
  const [fields, setFields] = useState<SandboxFields>(DEFAULTS);

  // Reactive recompute on any field change
  useEffect(() => {
    try {
      const payload: NoaPayload = {
        taxpayer_name: fields.taxpayer_name || "Unnamed Applicant",
        tax_year: fields.tax_year,
        line_15000_total_income: Math.max(0, fields.line_15000_total_income),
        prior_year_line_15000: Math.max(0, fields.prior_year_line_15000),
        line_23600_net_income: Math.max(0, fields.line_23600_net_income),
        balance_owing_at_assessment: fields.balance_owing_at_assessment,
        has_unarranged_arrears: fields.has_unarranged_arrears,
        document_title_raw: "Sandbox Simulated Payload",
      };
      const result = analyzeNoticeOfAssessment(payload);
      onAnalyzed(result);
    } catch {
      // ignore transient invalid states (e.g. NaN while typing)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  function update<K extends keyof SandboxFields>(key: K, val: SandboxFields[K]) {
    setFields((f) => ({ ...f, [key]: val }));
  }

  function reset() {
    setFields(DEFAULTS);
  }

  const years = [2025, 2024, 2023, 2022, 2021];

  return (
    <div
      className="border-b border-border"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--emerald) 4%, var(--card)) 0%, var(--card) 100%)",
      }}
    >
      <div className="grid grid-cols-12 gap-px bg-border">
        <div className="col-span-12 bg-card px-6 py-2 flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
            MANUAL PAYLOAD INJECTOR · LIVE SCORING
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 border border-border bg-card px-2.5 py-1 text-[10.5px] font-semibold tracking-tight hover:bg-secondary"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
            <button
              onClick={onClear}
              className="border border-border bg-card px-2.5 py-1 text-[10.5px] font-semibold tracking-tight text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Clear Analysis
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
        <SandboxText
          label="Taxpayer Name"
          value={fields.taxpayer_name}
          onChange={(v) => update("taxpayer_name", v)}
        />
        <SandboxSelect
          label="Tax Year"
          value={fields.tax_year}
          options={years}
          onChange={(v) => update("tax_year", v)}
        />
        <SandboxCurrency
          label="Line 15000 · Total Income"
          value={fields.line_15000_total_income}
          onChange={(v) => update("line_15000_total_income", v)}
        />
        <SandboxCurrency
          label="Prior Year Line 15000"
          value={fields.prior_year_line_15000}
          onChange={(v) => update("prior_year_line_15000", v)}
          hint="Drop current below this to trigger TAX-DROP-YOY"
        />
        <SandboxCurrency
          label="Line 23600 · Net Income"
          value={fields.line_23600_net_income}
          onChange={(v) => update("line_23600_net_income", v)}
        />
        <SandboxCurrency
          label="Balance Owing at Assessment"
          value={fields.balance_owing_at_assessment}
          onChange={(v) => update("balance_owing_at_assessment", v)}
          hint="> $0 triggers TAX-CRA-ARREARS (+25 pts)"
        />
        <SandboxCheckbox
          label="Has Unarranged Arrears"
          value={fields.has_unarranged_arrears}
          onChange={(v) => update("has_unarranged_arrears", v)}
        />
        <div className="bg-card px-3 py-2.5 flex flex-col justify-center">
          <div className="font-mono text-[9.5px] font-bold tracking-[0.16em] text-muted-foreground">
            STATE
          </div>
          <div
            className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold"
            style={{ color: "var(--emerald-deep)" }}
          >
            <span
              className="h-1.5 w-1.5 animate-pulse"
              style={{ background: "var(--emerald)" }}
            />
            Streaming to scoring engine
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldShell({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card px-3 py-2.5">
      <label className="font-mono text-[9.5px] font-bold tracking-[0.16em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && (
        <div className="mt-1 font-mono text-[9.5px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

const inputCls =
  "h-7 w-full border border-border bg-background px-2 text-[12px] font-mono focus:outline-none focus:ring-1 focus:ring-ring";

function SandboxText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldShell label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </FieldShell>
  );
}

function SandboxSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <FieldShell label={label}>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputCls}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function SandboxCurrency({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <FieldShell label={label} hint={hint}>
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">
          $
        </span>
        <input
          type="number"
          step="0.01"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={`${inputCls} pl-5`}
        />
      </div>
    </FieldShell>
  );
}

function SandboxCheckbox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <FieldShell label={label}>
      <label className="flex h-7 items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--emerald-deep)]"
        />
        <span
          className="font-mono text-[11px] font-semibold"
          style={{ color: value ? "var(--warning-fg)" : "var(--muted-foreground)" }}
        >
          {value ? "TRUE · arrears flagged" : "FALSE · no arrears"}
        </span>
      </label>
    </FieldShell>
  );
}
