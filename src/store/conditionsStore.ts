/**
 * Conditions Tracking Board — Prompt 12.
 * Persists per-applicant conditions to public.conditions via Supabase.
 */
import { create } from "zustand";
import { supabase } from "@/supabase/client";
import { logAuditEvent } from "@/lib/auditLog";

export type ConditionStatus =
  | "Outstanding"
  | "Documents Received"
  | "Under Review"
  | "Satisfied"
  | "Waived";

export const CONDITION_COLUMNS: ConditionStatus[] = [
  "Outstanding",
  "Documents Received",
  "Under Review",
  "Satisfied",
  "Waived",
];

export interface ConditionRow {
  id: string;
  application_id: string;
  label: string;
  description: string | null;
  status: ConditionStatus;
  due_date: string | null;
  /** Encoded in description: assigned_to, source, doc_link (kept forward-compatible without a schema change). */
  assigned_to?: "Broker" | "Client" | null;
  source?: "AI" | "Manual" | "Template" | null;
  linked_document?: string | null;
}

interface State {
  conditions: ConditionRow[];
  load: (applicationId: string) => Promise<void>;
  save: (c: Partial<ConditionRow> & { application_id: string }) => Promise<void>;
  setStatus: (id: string, status: ConditionStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

interface DescMeta {
  description?: string | null;
  assigned_to?: "Broker" | "Client" | null;
  source?: "AI" | "Manual" | "Template" | null;
  linked_document?: string | null;
}

function packDescription(row: Partial<ConditionRow>): string {
  const meta: DescMeta = {
    description: row.description ?? null,
    assigned_to: row.assigned_to ?? null,
    source: row.source ?? "Manual",
    linked_document: row.linked_document ?? null,
  };
  return JSON.stringify(meta);
}

function unpackDescription(raw: string | null): DescMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { description: raw };
  }
}

export const useConditionsStore = create<State>((set, get) => ({
  conditions: [],
  load: async (applicationId) => {
    const { data, error } = await supabase
      .from("conditions")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("conditions load", error);
      return;
    }
    const conditions: ConditionRow[] = (data ?? []).map((r) => {
      const meta = unpackDescription(r.description);
      return {
        id: r.id,
        application_id: r.application_id,
        label: r.label ?? "",
        description: meta.description ?? null,
        status: (r.status ?? "Outstanding") as ConditionStatus,
        due_date: r.due_date ?? null,
        assigned_to: meta.assigned_to ?? null,
        source: meta.source ?? "Manual",
        linked_document: meta.linked_document ?? null,
      };
    });
    set({ conditions });
  },
  save: async (c) => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const payload = {
      ...(c.id ? { id: c.id } : {}),
      user_id: uid,
      application_id: c.application_id,
      label: c.label ?? "",
      description: packDescription(c),
      status: c.status ?? "Outstanding",
      due_date: c.due_date ?? null,
    };
    const { data, error } = await supabase
      .from("conditions")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();
    if (error) {
      console.warn("conditions save", error);
      return;
    }
    await logAuditEvent({
      action_type: c.id ? "UPDATE" : "INSERT",
      table_name: "conditions",
      record_id: data?.id ?? null,
      application_id: c.application_id,
      new_value: payload,
    });
    await get().load(c.application_id);
  },
  setStatus: async (id, status) => {
    const before = get().conditions.find((c) => c.id === id);
    if (!before) return;
    const { error } = await supabase.from("conditions").update({ status }).eq("id", id);
    if (error) return;
    await logAuditEvent({
      action_type: "UPDATE",
      table_name: "conditions",
      record_id: id,
      application_id: before.application_id,
      old_value: { status: before.status },
      new_value: { status },
    });
    await get().load(before.application_id);
  },
  remove: async (id) => {
    const target = get().conditions.find((c) => c.id === id);
    const { error } = await supabase.from("conditions").delete().eq("id", id);
    if (error) return;
    await logAuditEvent({
      action_type: "DELETE",
      table_name: "conditions",
      record_id: id,
      application_id: target?.application_id ?? null,
      old_value: target,
    });
    if (target?.application_id) await get().load(target.application_id);
  },
}));

export const CONDITION_TEMPLATES: { label: string; assigned_to: "Broker" | "Client" }[] = [
  { label: "90-day bank statements", assigned_to: "Client" },
  { label: "Confirmation of employment (letter + paystub)", assigned_to: "Client" },
  { label: "Void cheque", assigned_to: "Client" },
  { label: "Property appraisal", assigned_to: "Broker" },
  { label: "Proof of down payment (source of funds)", assigned_to: "Client" },
  { label: "Condo status certificate", assigned_to: "Broker" },
  { label: "Gift letter (signed)", assigned_to: "Client" },
  { label: "Property insurance binder", assigned_to: "Client" },
  { label: "MPAC / property tax verification", assigned_to: "Broker" },
];

export function daysOutstanding(dueDate: string | null): number | null {
  if (!dueDate) return null;
  return Math.ceil((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
}
