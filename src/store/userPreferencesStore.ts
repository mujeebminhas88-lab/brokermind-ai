/**
 * User preferences store — theme, defaults, notification toggles, onboarding.
 * Backed by public.user_preferences (RLS scoped to auth.uid()).
 */
import { create } from "zustand";
import { supabase } from "@/supabase/client";

export interface UserPreferences {
  theme: "dark" | "light";
  default_export: "pdf" | "xlsx";
  email_notifications: boolean;
  in_app_notifications: boolean;
  notif_rate_hold: boolean;
  notif_condition_overdue: boolean;
  notif_renewal_approaching: boolean;
  notif_new_flag: boolean;
  default_amortization: number;
  default_term: number;
  default_heating_cost: number;
  onboarding_completed: boolean;
}

const DEFAULTS: UserPreferences = {
  theme: "dark",
  default_export: "pdf",
  email_notifications: true,
  in_app_notifications: true,
  notif_rate_hold: true,
  notif_condition_overdue: true,
  notif_renewal_approaching: true,
  notif_new_flag: true,
  default_amortization: 25,
  default_term: 5,
  default_heating_cost: 150,
  onboarding_completed: false,
};

interface State extends UserPreferences {
  loaded: boolean;
  load: () => Promise<void>;
  patch: (p: Partial<UserPreferences>) => Promise<void>;
}

export const useUserPreferencesStore = create<State>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (data) {
      set({ ...(data as unknown as UserPreferences), loaded: true });
    } else {
      set({ loaded: true });
    }
  },

  patch: async (p) => {
    const next = { ...get(), ...p };
    set(p);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const row = {
      user_id: uid,
      theme: next.theme,
      default_export: next.default_export,
      email_notifications: next.email_notifications,
      in_app_notifications: next.in_app_notifications,
      notif_rate_hold: next.notif_rate_hold,
      notif_condition_overdue: next.notif_condition_overdue,
      notif_renewal_approaching: next.notif_renewal_approaching,
      notif_new_flag: next.notif_new_flag,
      default_amortization: next.default_amortization,
      default_term: next.default_term,
      default_heating_cost: next.default_heating_cost,
      onboarding_completed: next.onboarding_completed,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("user_preferences") as any).upsert(row);
  },
}));
