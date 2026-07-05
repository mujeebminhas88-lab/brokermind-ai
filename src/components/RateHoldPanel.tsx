/**
 * Rate Hold & Commitment Tracker — Prompt 11.
 * Persists to public.rate_holds with RLS scoped by user_id.
 */
import { useEffect, useState } from "react";
import { useRateHoldStore, daysRemaining, type CommitmentStatus, type RateHold } from "@/store/rateHoldStore";
import { Timer, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  applicationId: string | null;
  lenderName?: string;
}

const emptyDraft = (application_id: string): RateHold => ({
  id: "",
  application_id,
  lender: "",
  rate: 0,
  product: "5-yr fixed",
  start_date: null,
  expiry_date: null,
  commitment_status: "Pending",
  commitment_expiry: null,
  instruction_deadline: null,
  notes: null,
});

const STATUS: CommitmentStatus[] = ["Pending", "Received", "Accepted", "Expired"];

export function RateHoldPanel({ applicationId, lenderName }: Props) {
  const { holds, load, save, remove } = useRateHoldStore();
  const [draft, setDraft] = useState<RateHold | null>(null);

  useEffect(() => {
    if (applicationId) load(applicationId);
  }, [applicationId, load]);

  if (!applicationId) {
    return (
      <section id="rate-holds" className="scroll-mt-24 rounded-sm border border-border bg-card p-5 text-xs text-muted-foreground">
        Select an applicant to track rate holds.
      </section>
    );
  }

  const commit = async () => {
    if (!draft) return;
    if (!draft.lender || !draft.expiry_date) {
      toast.error("Lender and expiry date are required");
      return;
    }
    await save(draft);
    setDraft(null);
    toast.success("Rate hold saved");
  };

  const genEmail = (h: RateHold) => {
    const subject = encodeURIComponent(`Rate Hold Extension Request — ${h.lender}`);
    const body = encodeURIComponent(
      `Hello ${h.lender} team,\n\nWe kindly request an extension of the rate hold for our shared client under application ${applicationId}.\n\nCurrent hold:\n- Lender: ${h.lender}\n- Product: ${h.product}\n- Rate: ${h.rate}%\n- Expiry: ${h.expiry_date}\n\nPlease confirm eligibility and any conditions.\n\nThank you.`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  return (
    <section id="rate-holds" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            Rate Hold &amp; Commitment Tracker
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Time-critical — missed expiries can kill the deal.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(emptyDraft(applicationId))}
          className="inline-flex items-center gap-1 rounded-sm border border-primary bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3 w-3" /> Add Rate Hold
        </button>
      </header>

      {draft && (
        <div className="mt-4 grid gap-2 rounded-sm border border-dashed border-border p-3 md:grid-cols-3">
          <TextField label="Lender" value={draft.lender} onChange={(v) => setDraft({ ...draft, lender: v })} placeholder={lenderName} />
          <TextField label="Product" value={draft.product} onChange={(v) => setDraft({ ...draft, product: v })} />
          <NumField label="Rate %" value={draft.rate} onChange={(v) => setDraft({ ...draft, rate: v })} step={0.01} />
          <DateField label="Start date" value={draft.start_date} onChange={(v) => setDraft({ ...draft, start_date: v })} />
          <DateField label="Expiry date" value={draft.expiry_date} onChange={(v) => setDraft({ ...draft, expiry_date: v })} />
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Commitment status</span>
            <select
              value={draft.commitment_status}
              onChange={(e) => setDraft({ ...draft, commitment_status: e.target.value as CommitmentStatus })}
              className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm"
            >
              {STATUS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <DateField label="Commitment expiry" value={draft.commitment_expiry} onChange={(v) => setDraft({ ...draft, commitment_expiry: v })} />
          <DateField label="Instruction deadline" value={draft.instruction_deadline} onChange={(v) => setDraft({ ...draft, instruction_deadline: v })} />
          <div className="col-span-full flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-sm border border-border bg-background px-3 py-1 text-xs">Cancel</button>
            <button type="button" onClick={commit} className="rounded-sm bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground">Save</button>
          </div>
        </div>
      )}

      {holds.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No rate holds tracked.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {holds.map((h) => {
            const days = daysRemaining(h.expiry_date);
            const tone =
              days == null ? "border-border" :
              days < 5 ? "border-destructive/60 bg-destructive/5" :
              days < 10 ? "border-warning/50 bg-warning-bg" :
              "border-success/40 bg-success/5";
            return (
              <div key={h.id} className={`rounded-sm border p-3 text-xs ${tone}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Timer className="h-3.5 w-3.5" />
                    {h.lender} · {h.product} · <span className="font-mono">{h.rate}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">
                      {days == null ? "no expiry" : `${days} day${days === 1 ? "" : "s"} left`}
                    </span>
                    <button
                      type="button"
                      onClick={() => genEmail(h)}
                      className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-0.5 text-[10px] uppercase tracking-wider hover:bg-muted"
                    >
                      <Mail className="h-3 w-3" /> Extension email
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(h.id)}
                      className="rounded-sm p-1 text-destructive hover:bg-destructive/10"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground md:grid-cols-4">
                  <div>Expiry: <span className="font-mono text-foreground">{h.expiry_date ?? "—"}</span></div>
                  <div>Commit: <span className="font-mono text-foreground">{h.commitment_status}</span></div>
                  <div>Commit expiry: <span className="font-mono text-foreground">{h.commitment_expiry ?? "—"}</span></div>
                  <div>Instructions due: <span className="font-mono text-foreground">{h.instruction_deadline ?? "—"}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm" />
    </label>
  );
}
function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="rounded-sm border border-input bg-background px-2 py-1.5 font-mono text-sm" />
    </label>
  );
}
function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        className="rounded-sm border border-input bg-background px-2 py-1.5 font-mono text-sm" />
    </label>
  );
}
