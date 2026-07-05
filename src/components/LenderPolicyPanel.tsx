/**
 * LenderPolicyPanel — configure per-firm lender policies. Lives in Settings
 * under a new "Lender Policies" tab. Every change bumps `version` for
 * historical traceability; older policy versions remain in the table so
 * historical files can still show which policy version was applied.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/supabase/client";
import { useFirmContext } from "@/hooks/useFirmContext";
import { Plus, Save, ShieldCheck, X } from "lucide-react";
import type { LenderPolicy } from "@/utils/lenderPolicy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const INCOME_TYPES = ["salaried", "hourly", "self_employed", "commission", "contract", "pension", "rental", "investment"];
const PROVINCES = ["ON", "BC", "AB", "QC", "MB", "SK", "NS", "NB", "NL", "PE"];

export function LenderPolicyPanel() {
  const { firmId } = useFirmContext();
  const [policies, setPolicies] = useState<LenderPolicy[]>([]);
  const [editing, setEditing] = useState<LenderPolicy | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!firmId) return;
    setLoading(true);
    const { data } = await sb.from("lender_policies").select("*").eq("firm_id", firmId).order("updated_at", { ascending: false });
    setPolicies((data ?? []) as LenderPolicy[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [firmId]);

  async function save(p: LenderPolicy) {
    if (!firmId) return;
    const row = { ...p, firm_id: firmId, version: (p.version ?? 0) + 1 };
    if (p.id) {
      await sb.from("lender_policies").update(row).eq("id", p.id);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...insert } = row;
      await sb.from("lender_policies").insert(insert);
    }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this policy?")) return;
    await sb.from("lender_policies").delete().eq("id", id);
    await load();
  }

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-chart-2" />
          <h2 className="font-display text-base font-bold tracking-tight">Lender Policies</h2>
        </div>
        <button
          onClick={() =>
            setEditing({
              id: "",
              firm_id: firmId ?? "",
              name: "",
              version: 0,
              is_active: true,
              max_ltv_detached: 75,
              max_ltv_condo: 70,
              max_ltv_rural: 65,
              min_beacon: 550,
              max_tds: 50,
              max_gds: 39,
              acceptable_income_types: [],
              eligible_provinces: [],
              notes: null,
            })
          }
          className="inline-flex items-center gap-1.5 rounded-sm bg-chart-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-black"
        >
          <Plus className="h-3 w-3" /> New Policy
        </button>
      </header>
      <p className="mb-4 text-xs text-muted-foreground">
        Files are scored against your active policies. Breaches show as <strong className="text-destructive">POLICY BREACH</strong>, separate from generic compliance flags.
      </p>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : policies.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No policies yet. Create your first lender policy to enforce firm-specific thresholds.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {policies.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {p.name} <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">v{p.version}</span>
                  {p.is_active && <span className="ml-1 rounded-sm bg-success/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-success">Active</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  LTV det {p.max_ltv_detached ?? "—"}% · condo {p.max_ltv_condo ?? "—"}% · Beacon ≥ {p.min_beacon ?? "—"} · TDS ≤ {p.max_tds ?? "—"}%
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(p)} className="rounded-sm border border-border bg-card px-2.5 py-1 text-[10.5px] uppercase tracking-wider hover:bg-muted">
                  Edit
                </button>
                <button onClick={() => void remove(p.id)} className="rounded-sm border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[10.5px] uppercase tracking-wider text-destructive hover:bg-destructive/20">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <PolicyEditor policy={editing} onCancel={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function PolicyEditor({ policy, onCancel, onSave }: { policy: LenderPolicy; onCancel: () => void; onSave: (p: LenderPolicy) => void | Promise<void> }) {
  const [p, setP] = useState<LenderPolicy>(policy);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-2xl rounded-sm border border-border bg-card p-5">
        <header className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-bold">{p.id ? "Edit Policy" : "New Lender Policy"}</h3>
          <button onClick={onCancel}><X className="h-4 w-4" /></button>
        </header>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Name" value={p.name} onChange={(v) => setP({ ...p, name: v })} />
          <label className="flex items-center gap-2 pt-5">
            <input type="checkbox" checked={p.is_active} onChange={(e) => setP({ ...p, is_active: e.target.checked })} /> Active
          </label>
          <Num label="Max LTV — Detached %" value={p.max_ltv_detached} onChange={(v) => setP({ ...p, max_ltv_detached: v })} />
          <Num label="Max LTV — Condo %" value={p.max_ltv_condo} onChange={(v) => setP({ ...p, max_ltv_condo: v })} />
          <Num label="Max LTV — Rural %" value={p.max_ltv_rural} onChange={(v) => setP({ ...p, max_ltv_rural: v })} />
          <Num label="Min Beacon" value={p.min_beacon} onChange={(v) => setP({ ...p, min_beacon: v ? Math.round(v) : null })} />
          <Num label="Max TDS %" value={p.max_tds} onChange={(v) => setP({ ...p, max_tds: v })} />
          <Num label="Max GDS %" value={p.max_gds} onChange={(v) => setP({ ...p, max_gds: v })} />
        </div>

        <div className="mt-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Acceptable income types</div>
          <div className="flex flex-wrap gap-1.5">
            {INCOME_TYPES.map((t) => {
              const on = p.acceptable_income_types.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => setP({ ...p, acceptable_income_types: on ? p.acceptable_income_types.filter((x) => x !== t) : [...p.acceptable_income_types, t] })}
                  className={`rounded-sm border px-2 py-1 text-[10.5px] uppercase tracking-wider ${on ? "border-chart-2 bg-chart-2/10 text-chart-2" : "border-border text-muted-foreground"}`}
                >
                  {t.replace("_", " ")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Eligible provinces</div>
          <div className="flex flex-wrap gap-1.5">
            {PROVINCES.map((pv) => {
              const on = p.eligible_provinces.includes(pv);
              return (
                <button
                  key={pv}
                  onClick={() => setP({ ...p, eligible_provinces: on ? p.eligible_provinces.filter((x) => x !== pv) : [...p.eligible_provinces, pv] })}
                  className={`rounded-sm border px-2 py-1 text-[10.5px] font-mono ${on ? "border-chart-2 bg-chart-2/10 text-chart-2" : "border-border text-muted-foreground"}`}
                >
                  {pv}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-sm border border-border bg-card px-3 py-1.5 text-[11px] uppercase tracking-wider hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => onSave(p)}
            disabled={!p.name}
            className="inline-flex items-center gap-1.5 rounded-sm bg-chart-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-black disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> Save (v{(p.version ?? 0) + 1})
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs" />
    </label>
  );
}

function Num({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-mono"
      />
    </label>
  );
}
