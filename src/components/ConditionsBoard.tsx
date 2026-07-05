/**
 * Conditions Tracking Board — Prompt 12.
 * Simple 5-column kanban with click-to-move status. Persists to public.conditions.
 */
import { useEffect, useState } from "react";
import {
  useConditionsStore,
  CONDITION_COLUMNS,
  CONDITION_TEMPLATES,
  daysOutstanding,
  type ConditionRow,
  type ConditionStatus,
} from "@/store/conditionsStore";
import { Plus, Trash2, ClipboardList, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Props {
  applicationId: string | null;
}

export function ConditionsBoard({ applicationId }: Props) {
  const { conditions, load, save, setStatus, remove } = useConditionsStore();
  const [draft, setDraft] = useState<Partial<ConditionRow> | null>(null);

  useEffect(() => {
    if (applicationId) load(applicationId);
  }, [applicationId, load]);

  if (!applicationId) {
    return (
      <section id="conditions" className="scroll-mt-24 rounded-sm border border-border bg-card p-5 text-xs text-muted-foreground">
        Select an applicant to manage conditions.
      </section>
    );
  }

  const commit = async () => {
    if (!draft?.label) {
      toast.error("Condition label is required");
      return;
    }
    await save({ ...draft, application_id: applicationId } as ConditionRow);
    setDraft(null);
    toast.success("Condition saved");
  };

  const outstanding = conditions.filter((c) => c.status !== "Satisfied" && c.status !== "Waived").length;

  return (
    <section id="conditions" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            Conditions Tracking Board
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {outstanding} outstanding · {conditions.length} total · feeds dossier readiness
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TemplatePicker
            onPick={(label, assigned) =>
              setDraft({
                application_id: applicationId,
                label,
                assigned_to: assigned,
                source: "Template",
                status: "Outstanding",
              })
            }
          />
          <button
            type="button"
            onClick={() => setDraft({ application_id: applicationId, status: "Outstanding", source: "Manual" })}
            className="inline-flex items-center gap-1 rounded-sm border border-primary bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </header>

      {draft && (
        <div className="mt-4 grid gap-2 rounded-sm border border-dashed border-border p-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs md:col-span-2">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Condition</span>
            <input
              value={draft.label ?? ""}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Assigned to</span>
            <select
              value={draft.assigned_to ?? "Broker"}
              onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value as "Broker" | "Client" })}
              className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option>Broker</option>
              <option>Client</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Due date</span>
            <input
              type="date"
              value={draft.due_date ?? ""}
              onChange={(e) => setDraft({ ...draft, due_date: e.target.value || null })}
              className="rounded-sm border border-input bg-background px-2 py-1.5 font-mono text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs md:col-span-2">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">Description / linked doc</span>
            <input
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Notes, or document kind (e.g. NOA, T4)"
              className="rounded-sm border border-input bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <div className="col-span-full flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-sm border border-border bg-background px-3 py-1 text-xs">Cancel</button>
            <button type="button" onClick={commit} className="rounded-sm bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground">Save</button>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
        {CONDITION_COLUMNS.map((col) => {
          const items = conditions.filter((c) => c.status === col);
          return (
            <div key={col} className="flex flex-col rounded-sm border border-border bg-background">
              <div className="border-b border-border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {col} · {items.length}
              </div>
              <div className="min-h-[80px] space-y-1.5 p-2">
                {items.map((c) => {
                  const days = daysOutstanding(c.due_date);
                  const overdue = days != null && days > 5 && col !== "Satisfied" && col !== "Waived";
                  return (
                    <div
                      key={c.id}
                      className={`rounded-sm border p-2 text-[11px] ${overdue ? "border-warning/50 bg-warning-bg" : "border-border bg-card"}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="font-semibold text-foreground">{c.label}</div>
                        <button
                          type="button"
                          onClick={() => remove(c.id)}
                          className="rounded-sm p-0.5 text-destructive hover:bg-destructive/10"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {c.description && <div className="mt-0.5 text-muted-foreground">{c.description}</div>}
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{c.assigned_to ?? "—"} · {c.source ?? "Manual"}</span>
                        {c.due_date && (
                          <span className={overdue ? "font-mono font-bold text-warning-fg" : "font-mono"}>
                            {c.due_date} {days != null && days > 0 && `(${days}d)`}
                          </span>
                        )}
                      </div>
                      <StatusMover id={c.id} current={c.status} onChange={(s) => setStatus(c.id, s)} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatusMover({ id, current, onChange }: { id: string; current: ConditionStatus; onChange: (s: ConditionStatus) => void }) {
  return (
    <div className="mt-1.5 flex items-center gap-1 border-t border-border/50 pt-1">
      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
      <select
        value={current}
        onChange={(e) => onChange(e.target.value as ConditionStatus)}
        className="w-full rounded-sm border border-input bg-background px-1 py-0.5 text-[10px]"
        aria-label={`Move condition ${id}`}
      >
        {CONDITION_COLUMNS.map((c) => <option key={c}>{c}</option>)}
      </select>
    </div>
  );
}

function TemplatePicker({ onPick }: { onPick: (label: string, assigned: "Broker" | "Client") => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-sm border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider hover:bg-muted"
      >
        <ClipboardList className="h-3 w-3" /> Templates
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-sm border border-border bg-card p-1 shadow-lg">
          {CONDITION_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => {
                onPick(t.label, t.assigned_to);
                setOpen(false);
              }}
              className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-muted"
            >
              {t.label} <span className="text-muted-foreground">· {t.assigned_to}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
