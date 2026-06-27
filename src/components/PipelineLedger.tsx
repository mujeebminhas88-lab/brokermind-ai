import { useEffect, useMemo, useState } from "react";
import { Database, Save, Search, History, RefreshCw, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { analyzeNoticeOfAssessment, type NoaAnalysis } from "@/utils/noaParser";

export type LedgerRow = {
  id: string;
  application_number: string;
  taxpayer_name: string;
  tax_year: number;
  line_15000_total_income: number;
  line_23600_net_income: number;
  balance_owing: number;
  has_arrears: boolean;
  aggregate_risk_score: number;
  gds: number;
  tds: number;
  created_at: string;
};

const REFRESH_EVENT = "brokermind:ledger-refresh";

export function SaveApplicationButton({
  analysis,
  applicationNumber,
  gds,
  tds,
  aggregateRiskScore,
}: {
  analysis: NoaAnalysis | null;
  applicationNumber: string;
  gds: number;
  tds: number;
  aggregateRiskScore: number;
}) {
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const p = analysis?.payload;
      const row = {
        application_number: applicationNumber,
        taxpayer_name: p?.taxpayer_name ?? "Mujeeb Minhas",
        tax_year: p?.tax_year ?? 2025,
        line_15000_total_income: p?.line_15000_total_income ?? 94500,
        line_23600_net_income: p?.line_23600_net_income ?? 88940.12,
        balance_owing: p?.balance_owing_at_assessment ?? 4250.31,
        has_arrears: p?.has_unarranged_arrears ?? true,
        aggregate_risk_score: aggregateRiskScore,
        gds,
        tds,
      };
      const { error } = await supabase
        .from("underwriting_applications")
        .insert(row as never);
      if (error) throw error;
      toast.success("Application saved to permanent ledger.", {
        description: `${row.application_number} · ${row.taxpayer_name}`,
      });
      window.dispatchEvent(new Event(REFRESH_EVENT));
    } catch (e: any) {
      toast.error("Failed to commit to ledger", {
        description: e?.message ?? "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={save}
      disabled={saving}
      className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] font-bold tracking-tight text-primary-foreground disabled:opacity-60"
      style={{ background: "var(--emerald-deep)" }}
    >
      <Save className="h-3.5 w-3.5" strokeWidth={2.5} />
      {saving ? "Committing…" : "Commit to Underwriting Log"}
    </button>
  );
}

export function PipelineLedger({
  onLoadRecord,
}: {
  onLoadRecord: (args: {
    analysis: NoaAnalysis;
    applicationNumber: string;
    rowId: string;
  }) => void;
}) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("underwriting_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data ?? []) as unknown as LedgerRow[]);
    } catch (e: any) {
      toast.error("Ledger fetch failed", { description: e?.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener(REFRESH_EVENT, h);
    return () => window.removeEventListener(REFRESH_EVENT, h);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.taxpayer_name.toLowerCase().includes(q) ||
        r.application_number.toLowerCase().includes(q),
    );
  }, [rows, query]);

  function handleRowClick(r: LedgerRow) {
    try {
      const analysis = analyzeNoticeOfAssessment({
        taxpayer_name: r.taxpayer_name,
        tax_year: r.tax_year,
        line_15000_total_income: Number(r.line_15000_total_income),
        line_23600_net_income: Number(r.line_23600_net_income),
        balance_owing_at_assessment: Number(r.balance_owing),
        has_unarranged_arrears: r.has_arrears,
        document_title_raw: "Replayed from Pipeline Ledger",
      });
      setActiveId(r.id);
      onLoadRecord({
        analysis,
        applicationNumber: r.application_number,
        rowId: r.id,
      });
      toast.success("Ledger record re-fed to workspace", {
        description: `${r.application_number} · ${r.taxpayer_name}`,
      });
    } catch (e: any) {
      toast.error("Could not replay record", { description: e?.message });
    }
  }

  return (
    <section className="border-t border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-6 py-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center"
            style={{ background: "var(--emerald-deep)" }}
          >
            <History className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
              ARCHIVE · IMMUTABLE
            </div>
            <h2 className="text-[13px] font-bold tracking-tight">Pipeline Ledger History</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by taxpayer or app #"
              className="h-8 w-72 border border-border bg-background pl-8 pr-3 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <button
            onClick={load}
            className="flex h-8 items-center gap-1.5 border border-border bg-card px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            {filtered.length} / {rows.length} ROWS
          </span>
        </div>
      </div>

      <div className="max-h-[360px] overflow-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border bg-secondary/30 text-left">
              <Th>App ID</Th>
              <Th>Taxpayer</Th>
              <Th className="text-center">Tax Year</Th>
              <Th className="text-right">Income (L.15000)</Th>
              <Th className="text-center">Risk Score</Th>
              <Th>Date Logged</Th>
              <Th className="w-8"></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[12px] text-muted-foreground">
                  {rows.length === 0
                    ? "No applications committed yet. Use 'Commit to Underwriting Log' above."
                    : "No matches for current filter."}
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const active = r.id === activeId;
              const tone =
                r.aggregate_risk_score >= 25
                  ? { bg: "var(--warning-bg)", fg: "var(--warning-fg)" }
                  : r.aggregate_risk_score > 0
                    ? { bg: "color-mix(in oklab, var(--emerald) 12%, transparent)", fg: "var(--emerald-deep)" }
                    : { bg: "color-mix(in oklab, var(--success) 14%, transparent)", fg: "var(--success)" };
              return (
                <tr
                  key={r.id}
                  onClick={() => handleRowClick(r)}
                  className={`cursor-pointer border-b border-border transition-colors hover:bg-secondary/60 ${
                    active ? "bg-secondary/70" : ""
                  }`}
                  style={
                    active
                      ? { boxShadow: "inset 3px 0 0 0 var(--emerald)" }
                      : undefined
                  }
                >
                  <Td>
                    <span className="font-mono text-[11.5px] font-semibold">
                      #{r.application_number}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-medium">{r.taxpayer_name}</span>
                  </Td>
                  <Td className="text-center font-mono">{r.tax_year}</Td>
                  <Td className="text-right font-mono">
                    {Number(r.line_15000_total_income).toLocaleString("en-CA", {
                      style: "currency",
                      currency: "CAD",
                      maximumFractionDigits: 0,
                    })}
                  </Td>
                  <Td className="text-center">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10.5px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {r.aggregate_risk_score}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("en-CA", {
                        hour12: false,
                      })}
                    </span>
                  </Td>
                  <Td>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 text-muted-foreground"
                      strokeWidth={2.5}
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>;
}
