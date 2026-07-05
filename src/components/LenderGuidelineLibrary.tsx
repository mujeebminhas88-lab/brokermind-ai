/**
 * Lender Guideline Library — NEW-I
 * Static reference with file-specific highlights.
 */
import { useMemo, useState } from "react";
import { BookOpen, Search, AlertTriangle } from "lucide-react";
import { LENDER_GUIDELINES, highlightsForFile, type FileFacts, type LenderCategory } from "@/utils/lenderGuidelines";
import { useDerivedFinancials, useApplicationStore } from "@/store/applicationStore";
import { useCreditProfileStore } from "@/store/creditProfileStore";
import { usePropertyStore } from "@/store/propertyStore";

const catStyles: Record<LenderCategory, string> = {
  A: "border-success/40 bg-success/10 text-success",
  B: "border-warning/40 bg-warning-bg text-warning-fg",
  Private: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function LenderGuidelineLibrary({
  employmentType,
  yearsSelfEmployed,
}: {
  employmentType?: "Salaried" | "Self-Employed" | "Incorporated" | null;
  yearsSelfEmployed?: number | null;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | LenderCategory>("all");

  const financials = useDerivedFinancials();
  const credit = useCreditProfileStore();
  const property = usePropertyStore();
  const loan = useApplicationStore((s) => s.loan);

  const facts: FileFacts = useMemo(
    () => ({
      beacon: credit.beacon,
      ltv: financials.ltv,
      employmentType: employmentType ?? null,
      yearsSelfEmployed: yearsSelfEmployed ?? null,
      propertyKind: property.kind,
      isRural: property.kind === "Rural",
      isLeasehold: property.tenure === "Leasehold" || property.tenure === "Condo Leasehold",
      hasCoOp: false,
      numUnits: property.numUnits,
      commercialPct: property.commercialPortionPct,
    }),
    [credit.beacon, financials.ltv, employmentType, yearsSelfEmployed, property, loan],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LENDER_GUIDELINES.filter((g) => {
      if (tab !== "all" && g.category !== tab) return false;
      if (!q) return true;
      return g.name.toLowerCase().includes(q) || g.notes.join(" ").toLowerCase().includes(q);
    });
  }, [query, tab]);

  return (
    <section id="lender-guidelines" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Lender Guideline Library
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Reference only — always confirm current guidelines with the lender or BDM.
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lender or rule..."
            className="w-full rounded-sm border border-input bg-background py-1.5 pl-7 pr-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "A", "B", "Private"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-sm border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                tab === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
              }`}
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((g) => {
          const hits = highlightsForFile(g, facts);
          return (
            <div key={g.id} className="rounded-sm border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{g.name}</h3>
                    <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-bold uppercase ${catStyles[g.category]}`}>
                      {g.category}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">Last updated: {g.updated}</div>
                </div>
              </div>

              {hits.length > 0 && (
                <div className="mt-2 space-y-1">
                  {hits.map((h, i) => (
                    <div key={i} className="flex items-start gap-1.5 rounded-sm border border-warning/40 bg-warning-bg/60 p-1.5 text-[11px] text-warning-fg">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-2 grid gap-1.5 text-xs md:grid-cols-2">
                <Row label="Max LTV">{g.maxLtv}</Row>
                <Row label="Min Beacon">{g.minBeacon}</Row>
                <Row label="Stress Test">{g.stressTest}</Row>
                <Row label="Income">{g.income}</Row>
                <Row label="Rental">{g.rental}</Row>
              </div>

              {g.notes.length > 0 && (
                <div className="mt-2 text-[11px]">
                  <span className="font-semibold text-muted-foreground">Notes: </span>
                  <span className="text-foreground">{g.notes.join(" · ")}</span>
                </div>
              )}
              {g.restrictions.length > 0 && (
                <div className="mt-1 text-[11px]">
                  <span className="font-semibold text-muted-foreground">Restrictions: </span>
                  <span className="text-foreground">{g.restrictions.join(" · ")}</span>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-sm border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            No lenders match the current filter.
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="min-w-[92px] font-semibold text-muted-foreground">{label}:</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}
