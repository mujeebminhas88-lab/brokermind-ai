/**
 * Broker settings persistence — profile info used in communication templates
 * and PDF dossier signatures.
 */
import { create } from "zustand";
import { supabase } from "@/supabase/client";

export interface BrokerSettings {
  broker_name: string;
  broker_email: string;
  licence_number: string;
  brokerage_name: string;
  phone: string;
  signature: string;
}

interface State extends BrokerSettings {
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  save: (patch: Partial<BrokerSettings>) => Promise<void>;
  patchLocal: (p: Partial<BrokerSettings>) => void;
}

const EMPTY: BrokerSettings = {
  broker_name: "",
  broker_email: "",
  licence_number: "",
  brokerage_name: "",
  phone: "",
  signature: "",
};

export const useBrokerSettingsStore = create<State>((set, get) => ({
  ...EMPTY,
  loaded: false,
  loading: false,

  patchLocal: (p) => set((s) => ({ ...s, ...p })),

  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) {
      set({ loading: false, loaded: true });
      return;
    }
    const { data } = await supabase
      .from("broker_settings")
      .select("broker_name, broker_email, licence_number, brokerage_name, phone, signature")
      .eq("user_id", uid)
      .maybeSingle();
    if (data) set({ ...(data as BrokerSettings) });
    if (!data && userRes.user?.email) set({ broker_email: userRes.user.email });
    set({ loading: false, loaded: true });
  },

  save: async (patch) => {
    const merged = { ...get(), ...patch } as State;
    set(merged);
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    const row = {
      user_id: uid,
      broker_name: merged.broker_name,
      broker_email: merged.broker_email,
      licence_number: merged.licence_number,
      brokerage_name: merged.brokerage_name,
      phone: merged.phone,
      signature: merged.signature,
    };
    await supabase.from("broker_settings").upsert(row);
  },
}));
