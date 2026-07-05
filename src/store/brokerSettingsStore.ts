/**
 * Broker settings persistence — profile info used in communication templates
 * and PDF dossier signatures. Extended in Tier 9 with firm profile fields.
 */
import { create } from "zustand";
import { supabase } from "@/supabase/client";

export interface BrokerSettings {
  broker_name: string;
  broker_email: string;
  licence_number: string;
  brokerage_name: string;
  phone: string;
  direct_phone: string;
  mailing_address: string;
  provinces: string[];
  logo_url: string;
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
  direct_phone: "",
  mailing_address: "",
  provinces: [],
  logo_url: "",
  signature: "",
};

const REQUIRED_KEYS: (keyof BrokerSettings)[] = [
  "broker_name",
  "broker_email",
  "licence_number",
  "brokerage_name",
  "phone",
  "mailing_address",
];

export function computeCompleteness(s: BrokerSettings): number {
  let done = 0;
  for (const k of REQUIRED_KEYS) {
    const v = s[k];
    if (Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0) done += 1;
  }
  if (s.provinces.length > 0) done += 1;
  return Math.round((done / (REQUIRED_KEYS.length + 1)) * 100);
}

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
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (data) {
      const row = data as unknown as Partial<BrokerSettings>;
      set({
        broker_name: row.broker_name ?? "",
        broker_email: row.broker_email ?? "",
        licence_number: row.licence_number ?? "",
        brokerage_name: row.brokerage_name ?? "",
        phone: row.phone ?? "",
        direct_phone: row.direct_phone ?? "",
        mailing_address: row.mailing_address ?? "",
        provinces: row.provinces ?? [],
        logo_url: row.logo_url ?? "",
        signature: row.signature ?? "",
      });
    }
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
      direct_phone: merged.direct_phone,
      mailing_address: merged.mailing_address,
      provinces: merged.provinces,
      logo_url: merged.logo_url,
      signature: merged.signature,
    };
    await supabase.from("broker_settings").upsert(row);
  },
}));
