/**
 * TermSheetGenerator — one-click commitment letter generator. Populates a
 * lender-branded template from application data + conditions, saves the
 * result to `term_sheets`, and provides a print-to-PDF layout.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/supabase/client";
import { useFirmContext } from "@/hooks/useFirmContext";
import { useBranding } from "@/components/WhiteLabelProvider";
import { FileText, Printer, Save } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface AppData {
  id: string;
  taxpayer_name: string;
  property_address: string | null;
  loan_amount: number | null;
}

interface Condition {
  id: string;
  label: string | null;
  description: string | null;
}

export function TermSheetGenerator({ applicationId }: { applicationId: string }) {
  const { firmId } = useFirmContext();
  const branding = useBranding();
  const [app, setApp] = useState<AppData | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [rate, setRate] = useState<number>(6.99);
  const [termMonths, setTermMonths] = useState<number>(12);
  const [fees, setFees] = useState<number>(0);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [a, c] = await Promise.all([
        supabase.from("underwriting_applications").select("id, taxpayer_name, property_address, loan_amount").eq("id", applicationId).maybeSingle(),
        supabase.from("conditions").select("id, label, description").eq("application_id", applicationId),
      ]);
      if (a.data) setApp(a.data as unknown as AppData);
      if (c.data) setConditions(c.data as unknown as Condition[]);
    })();
  }, [applicationId]);

  async function saveTermSheet() {
    if (!firmId || !app) return;
    const { data } = await sb
      .from("term_sheets")
      .insert({
        firm_id: firmId,
        application_id: applicationId,
        borrower_name: app.taxpayer_name,
        property_address: app.property_address,
        loan_amount: app.loan_amount,
        rate,
        term_months: termMonths,
        fees,
        conditions: conditions.map((c) => ({ label: c.label, description: c.description })),
        status: "generated",
      })
      .select()
      .maybeSingle();
    if (data) setSaved(data.id);
  }

  if (!app) return <div className="text-xs text-muted-foreground">Loading term sheet data…</div>;

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-chart-4" />
          <h2 className="font-display text-base font-bold tracking-tight">Term Sheet / Commitment Letter</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void saveTermSheet()} className="inline-flex items-center gap-1.5 rounded-sm bg-chart-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-black">
            <Save className="h-3 w-3" /> Save
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-muted">
            <Printer className="h-3 w-3" /> Print / PDF
          </button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
        <label>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rate %</div>
          <input type="number" step="0.01" value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 font-mono" />
        </label>
        <label>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Term (months)</div>
          <input type="number" value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 font-mono" />
        </label>
        <label>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Fees $</div>
          <input type="number" value={fees} onChange={(e) => setFees(Number(e.target.value))} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 font-mono" />
        </label>
      </div>

      {/* Print preview area */}
      <div id="term-sheet-print" className="rounded-sm border border-border bg-background p-6 text-foreground">
        <div className="mb-6 border-b border-border pb-4">
          <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: branding.primary_color }}>
            {branding.brand_name}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold">Commitment Letter</h1>
          <p className="text-xs text-muted-foreground">Issued {new Date().toLocaleDateString()}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Borrower</dt><dd className="font-semibold">{app.taxpayer_name}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Property</dt><dd>{app.property_address ?? "—"}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Loan Amount</dt><dd className="font-mono">${(app.loan_amount ?? 0).toLocaleString()}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Interest Rate</dt><dd className="font-mono">{rate.toFixed(2)}%</dd></div>
          <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Term</dt><dd>{termMonths} months</dd></div>
          <div><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Fees</dt><dd className="font-mono">${fees.toLocaleString()}</dd></div>
        </dl>

        <h2 className="mt-6 mb-2 font-display text-sm font-bold uppercase tracking-wider" style={{ color: branding.accent_color }}>
          Conditions
        </h2>
        {conditions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No outstanding conditions.</p>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-xs">
            {conditions.map((c) => (
              <li key={c.id}>
                <strong>{c.label ?? "Condition"}</strong>
                {c.description ? ` — ${c.description}` : ""}
              </li>
            ))}
          </ol>
        )}

        <p className="mt-8 text-[10px] text-muted-foreground">
          This commitment letter is issued by {branding.brand_name} subject to satisfaction of the conditions above. Generated by BrokerMind AI underwriting workspace.
        </p>
      </div>

      {saved && <div className="mt-3 text-[11px] text-success">Term sheet saved (id: {saved.slice(0, 8)}).</div>}
    </section>
  );
}
