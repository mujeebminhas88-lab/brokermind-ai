/**
 * Renewal Pipeline Tracker — Prompt 9
 * Table view with urgency color coding, status workflow, AI outreach email,
 * summary bar, and persistence to renewals table.
 */
import { useEffect, useMemo, useState } from "react";
import { Calendar, Plus, Mail, Trash2, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { renderTemplate } from "@/utils/communicationTemplates";
import { useBrokerSettingsStore } from "@/store/brokerSettingsStore";

interface RenewalRow {
  id: string;
  client_name: string | null;
  property_address: string | null;
  lender: string;
  current_rate: number | null;
  current_balance: number | null;
  maturity_date: string | null;
  renewal_status: string;
  last_contact_at: string | null;
  notes: string | null;
}

const STATUS_FLOW = ["Not Contacted", "Contacted", "In Progress", "Renewed", "Lost"] as const;
type Status = (typeof STATUS_FLOW)[number];

const money = (n: number | null | undefined) =>
  n == null
    ? "—"
    : n.toLocaleString("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((t - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number | null): string {
  if (days == null) return "";
  if (days < 0) return "bg-destructive/20 border-l-4 border-destructive animate-pulse";
  if (days < 30) return "bg-destructive/10 border-l-4 border-destructive";
  if (days < 60) return "bg-orange-500/10 border-l-4 border-orange-500";
  if (days < 90) return "bg-yellow-500/10 border-l-4 border-yellow-500";
  return "";
}

function urgencyBadge(days: number | null): string {
  if (days == null) return "text-muted-foreground";
  if (days < 0) return "text-destructive font-bold";
  if (days < 30) return "text-destructive font-bold";
  if (days < 60) return "text-orange-600 font-semibold";
  if (days < 90) return "text-yellow-700 dark:text-yellow-500 font-semibold";
  return "text-muted-foreground";
}

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring";

export function RenewalPipelinePanel() {
  const broker = useBrokerSettingsStore();
  const [rows, setRows] = useState<RenewalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string; row: RenewalRow } | null>(null);

  useEffect(() => { broker.load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("renewals")
      .select("id, client_name, property_address, lender, current_rate, current_balance, maturity_date, renewal_status, last_contact_at, notes")
      .order("maturity_date", { ascending: true, nullsFirst: false });
    if (error) toast.error("Failed to load renewals");
    setRows((data ?? []) as RenewalRow[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const dueIn30 = rows.filter((r) => {
      const d = daysUntil(r.maturity_date);
      return d != null && d >= 0 && d < 30;
    });
    const atRisk = dueIn30.reduce((s, r) => s + (r.current_balance ?? 0), 0);
    const contacted = rows.filter((r) => r.renewal_status !== "Not Contacted").length;
    const pct = rows.length ? Math.round((contacted / rows.length) * 100) : 0;
    return { dueIn30: dueIn30.length, atRisk, pct };
  }, [rows]);

  const addRow = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return toast.error("Not signed in");
    const { data, error } = await supabase
      .from("renewals")
      .insert({ user_id: uid, lender: "New Lender", renewal_status: "Not Contacted" })
      .select()
      .single();
    if (error) return toast.error("Insert failed");
    setRows((r) => [...r, data as RenewalRow]);
  };

  const updateRow = async (id: string, patch: Partial<RenewalRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("renewals").update(patch).eq("id", id);
    if (error) toast.error("Save failed");
  };

  const deleteRow = async (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    await supabase.from("renewals").delete().eq("id", id);
  };

  const generateOutreach = (row: RenewalRow) => {
    const days = daysUntil(row.maturity_date);
    const key = days == null || days > 60 ? "renewal-90" : days > 30 ? "renewal-60" : "renewal-30";
    const rendered = renderTemplate(key, {
      clientName: row.client_name ?? "",
      propertyAddress: row.property_address ?? "",
      brokerName: broker.broker_name,
      brokerageName: broker.brokerage_name,
      brokerEmail: broker.broker_email,
      brokerPhone: broker.phone,
      brokerLicence: broker.licence_number,
      signature: broker.signature,
      currentRate: row.current_rate ?? undefined,
      maturityDate: row.maturity_date ?? undefined,
      loanAmount: row.current_balance ?? undefined,
    });
    setEmailDraft({ ...rendered, row });
    updateRow(row.id, { last_contact_at: new Date().toISOString() });
  };

  const sortedRows = useMemo(() => rows.slice(), [rows]);

  return (
    <section id="renewals" className="rounded-sm border border-border bg-card p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Renewal Pipeline
          </h2>
          <p className="text-xs text-muted-foreground">
            Client renewals, urgency tracking, AI outreach.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1.5 text-xs hover:bg-muted">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={addRow} className="inline-flex items-center gap-1 rounded-sm border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Add Renewal
          </button>
        </div>
      </header>

      {/* Summary bar */}
      <div className="mb-4 grid gap-2 rounded-sm border border-primary/30 bg-primary/5 p-3 text-xs md:grid-cols-3">
        <Stat label="Due in 30 days" value={String(summary.dueIn30)} accent={summary.dueIn30 > 0} />
        <Stat label="Balance at Risk (30d)" value={money(summary.atRisk)} accent={summary.atRisk > 0} />
        <Stat label="% Contacted" value={`${summary.pct}%`} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Client</th>
              <th className="p-2 text-left">Property</th>
              <th className="p-2 text-left">Lender</th>
              <th className="p-2 text-left">Rate</th>
              <th className="p-2 text-left">Balance</th>
              <th className="p-2 text-left">Maturity</th>
              <th className="p-2 text-left">Days</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left w-40">Action</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const days = daysUntil(r.maturity_date);
              return (
                <tr key={r.id} className={`border-t border-border ${urgencyClass(days)}`}>
                  <td className="p-1.5">
                    <input className={inputCls} value={r.client_name ?? ""} onChange={(e) => updateRow(r.id, { client_name: e.target.value })} placeholder="Client name" />
                  </td>
                  <td className="p-1.5">
                    <input className={inputCls} value={r.property_address ?? ""} onChange={(e) => updateRow(r.id, { property_address: e.target.value })} placeholder="Address" />
                  </td>
                  <td className="p-1.5">
                    <input className={inputCls} value={r.lender} onChange={(e) => updateRow(r.id, { lender: e.target.value })} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" step="0.01" className={inputCls} value={r.current_rate ?? ""} onChange={(e) => updateRow(r.id, { current_rate: e.target.value ? Number(e.target.value) : null })} />
                  </td>
                  <td className="p-1.5">
                    <input type="number" className={inputCls} value={r.current_balance ?? ""} onChange={(e) => updateRow(r.id, { current_balance: e.target.value ? Number(e.target.value) : null })} />
                  </td>
                  <td className="p-1.5">
                    <input type="date" className={inputCls} value={r.maturity_date ?? ""} onChange={(e) => updateRow(r.id, { maturity_date: e.target.value || null })} />
                  </td>
                  <td className={`p-1.5 font-mono ${urgencyBadge(days)}`}>
                    {days == null ? "—" : days < 0 ? `${Math.abs(days)}d past` : `${days}d`}
                  </td>
                  <td className="p-1.5">
                    <select className={inputCls} value={r.renewal_status as Status} onChange={(e) => updateRow(r.id, { renewal_status: e.target.value })}>
                      {STATUS_FLOW.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <button
                      onClick={() => generateOutreach(r)}
                      className="inline-flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
                    >
                      <Mail className="h-3 w-3" /> Generate Email
                    </button>
                  </td>
                  <td className="p-1.5">
                    <button onClick={() => deleteRow(r.id)} className="rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-xs text-muted-foreground">
                  {loading ? "Loading renewals..." : "No renewals yet. Click Add Renewal to start tracking."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {emailDraft && (
        <EmailPreviewModal
          subject={emailDraft.subject}
          body={emailDraft.body}
          onClose={() => setEmailDraft(null)}
        />
      )}
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-sm border p-2 ${accent ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-bold ${accent ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function EmailPreviewModal({ subject, body, onClose }: { subject: string; body: string; onClose: () => void }) {
  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast.success("Copied to clipboard");
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-sm border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border bg-slate-900 px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <div className="text-sm font-semibold">Renewal Outreach Draft</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-4 w-4" /></button>
        </header>
        <div className="p-4">
          <div className="mb-2 rounded-sm border border-border bg-muted/40 p-2 text-sm font-semibold">{subject}</div>
          <pre className="whitespace-pre-wrap font-mono text-xs">{body}</pre>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border p-3">
          <button onClick={onClose} className="rounded-sm border border-border bg-card px-3 py-1.5 text-xs">Close</button>
          <button onClick={copy} className="rounded-sm border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Copy</button>
        </footer>
      </div>
    </div>
  );
}
