/**
 * Rate Hold & Commitment tracker — Prompt 11.
 * Persists per-applicant to public.rate_holds via Supabase.
 */
import { create } from "zustand";
import { supabase } from "@/supabase/client";
import { logAuditEvent } from "@/lib/auditLog";

export type CommitmentStatus = "Pending" | "Received" | "Accepted" | "Expired";

export interface RateHold {
  id: string;
  application_id: string | null;
  lender: string;
  rate: number;
  product: string;
  start_date: string | null;
  expiry_date: string | null;
  commitment_status: CommitmentStatus;
  commitment_expiry: string | null;
  instruction_deadline: string | null;
  notes: string | null;
}

interface State {
  holds: RateHold[];
  loading: boolean;
  load: (applicationId: string) => Promise<void>;
  save: (h: Partial<RateHold> & { application_id: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useRateHoldStore = create<State>((set, get) => ({
  holds: [],
  loading: false,
  load: async (applicationId) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("rate_holds")
      .select("*")
      .eq("application_id", applicationId)
      .order("expiry_date", { ascending: true });
    if (error) {
      console.warn("rate_holds load", error);
      set({ loading: false });
      return;
    }
    const holds = (data ?? []).map((r) => {
      const notes = (r.notes ?? "") as string;
      // notes may encode extra fields as JSON
      let extras: Partial<RateHold> = {};
      try {
        if (notes.startsWith("{")) extras = JSON.parse(notes);
      } catch {
        /* ignore */
      }
      return {
        id: r.id,
        application_id: r.application_id,
        lender: r.lender ?? "",
        rate: Number(r.rate ?? 0),
        product: r.product ?? "",
        start_date: extras.start_date ?? null,
        expiry_date: r.expiry_date ?? null,
        commitment_status: (extras.commitment_status ?? "Pending") as CommitmentStatus,
        commitment_expiry: extras.commitment_expiry ?? null,
        instruction_deadline: extras.instruction_deadline ?? null,
        notes: (extras.notes as string) ?? null,
      } satisfies RateHold;
    });
    set({ holds, loading: false });
  },
  save: async (h) => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) return;
    const extras = JSON.stringify({
      start_date: h.start_date ?? null,
      commitment_status: h.commitment_status ?? "Pending",
      commitment_expiry: h.commitment_expiry ?? null,
      instruction_deadline: h.instruction_deadline ?? null,
      notes: h.notes ?? null,
    });
    const payload = {
      ...(h.id ? { id: h.id } : {}),
      user_id: uid,
      application_id: h.application_id,
      lender: h.lender ?? "",
      rate: h.rate ?? 0,
      product: h.product ?? "",
      expiry_date: h.expiry_date ?? new Date().toISOString().slice(0, 10),
      notes: extras,
    };
    const { data, error } = await supabase
      .from("rate_holds")
      .upsert(payload as never, { onConflict: "id" })
      .select()
      .single();
    if (error) {
      console.warn("rate_holds save", error);
      return;
    }
    await logAuditEvent({
      action_type: h.id ? "UPDATE" : "INSERT",
      table_name: "rate_holds",
      record_id: data?.id ?? null,
      application_id: h.application_id,
      new_value: payload,
    });
    await get().load(h.application_id);
  },
  remove: async (id) => {
    const target = get().holds.find((h) => h.id === id);
    const { error } = await supabase.from("rate_holds").delete().eq("id", id);
    if (error) return;
    await logAuditEvent({
      action_type: "DELETE",
      table_name: "rate_holds",
      record_id: id,
      application_id: target?.application_id ?? null,
      old_value: target,
    });
    if (target?.application_id) await get().load(target.application_id);
  },
}));

export function daysRemaining(expiry: string | null): number | null {
  if (!expiry) return null;
  const d = new Date(expiry).getTime();
  const now = Date.now();
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
}
