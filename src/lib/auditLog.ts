import { supabase } from "@/supabase/client";

export type AuditActionType =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "VIEW"
  | "EXPORT"
  | "LOGIN"
  | "LOGOUT"
  | "VERIFY"
  | "OVERRIDE"
  | "UNLOCK";

export async function logAuditEvent(input: {
  action_type: AuditActionType;
  table_name?: string;
  record_id?: string | null;
  application_id?: string | null;
  new_value?: unknown;
  old_value?: unknown;
  details?: Record<string, unknown>;
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    await supabase.from("audit_logs").insert({
      user_id: uid,
      application_id: input.application_id ?? null,
      action: input.action_type,
      action_type: input.action_type,
      entity_type: input.table_name ?? null,
      table_name: input.table_name ?? null,
      entity_id: input.record_id ?? null,
      record_id: input.record_id ?? null,
      old_value: (input.old_value ?? null) as never,
      new_value: (input.new_value ?? null) as never,
      details: (input.details ?? {}) as never,
    } as never);
  } catch (err) {
    console.warn("audit log write failed", err);
  }
}
