/**
 * Notifications store — in-app alerts for rate hold expiry, condition overdue,
 * renewal approaching, and new compliance flags. Rows live in public.notifications
 * (RLS scoped to auth.uid()). Duplicates are prevented by dedupe_key.
 */
import { create } from "zustand";
import { supabase } from "@/supabase/client";

export type NotificationType =
  | "rate_hold_expiry"
  | "condition_overdue"
  | "renewal_approaching"
  | "compliance_flag";

export interface NotificationRow {
  id: string;
  user_id: string;
  firm_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  severity: "info" | "warning" | "critical";
  read_at: string | null;
  email_sent_at: string | null;
  dedupe_key: string | null;
  created_at: string;
}

interface State {
  rows: NotificationRow[];
  loaded: boolean;
  load: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  unreadCount: () => number;
  create: (input: Omit<NotificationRow, "id" | "user_id" | "read_at" | "email_sent_at" | "created_at"> & { dedupe_key: string }) => Promise<void>;
}

export const useNotificationsStore = create<State>((set, get) => ({
  rows: [],
  loaded: false,

  load: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("notifications" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    set({ rows: (data ?? []) as unknown as NotificationRow[], loaded: true });
  },

  markRead: async (id) => {
    const now = new Date().toISOString();
    set({ rows: get().rows.map((r) => (r.id === id ? { ...r, read_at: now } : r)) });
    await supabase.from("notifications" as never).update({ read_at: now }).eq("id", id);
  },

  markAllRead: async () => {
    const now = new Date().toISOString();
    const ids = get().rows.filter((r) => !r.read_at).map((r) => r.id);
    if (!ids.length) return;
    set({ rows: get().rows.map((r) => (r.read_at ? r : { ...r, read_at: now })) });
    await supabase.from("notifications" as never).update({ read_at: now }).in("id", ids);
  },

  unreadCount: () => get().rows.filter((r) => !r.read_at).length,

  create: async (input) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const payload = {
      user_id: u.user.id,
      firm_id: input.firm_id,
      type: input.type,
      title: input.title,
      body: input.body,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      severity: input.severity,
      dedupe_key: input.dedupe_key,
    };
    const { data, error } = await supabase
      .from("notifications" as never)
      .insert(payload)
      .select()
      .maybeSingle();
    if (error) return; // typically dedupe_key unique violation — silently ignore
    if (data) {
      set({ rows: [data as unknown as NotificationRow, ...get().rows] });
    }
  },
}));
