/**
 * WhiteLabelProvider — reads broker_settings and, when white_label_enabled is
 * true, applies primary_color / accent_color as CSS variables on the root and
 * exposes the branded label via context. Consumers read useBranding() to
 * decide what to display in the header/PDF/emails.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useBrokerSettingsStore } from "@/store/brokerSettingsStore";

interface Branding {
  enabled: boolean;
  brand_name: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  sender_name: string;
}

const DEFAULTS: Branding = {
  enabled: false,
  brand_name: "BrokerMind AI",
  logo_url: "",
  primary_color: "#00BCD4",
  accent_color: "#E91E8C",
  sender_name: "BrokerMind AI",
};

const Ctx = createContext<Branding>(DEFAULTS);

export function WhiteLabelProvider({ children }: { children: ReactNode }) {
  const s = useBrokerSettingsStore();
  useEffect(() => {
    void s.load();
  }, [s.load]);

  const branding = useMemo<Branding>(() => {
    // white_label fields aren't in the exported BrokerSettings type yet — read
    // permissively.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = s as any;
    const enabled = !!raw.white_label_enabled;
    if (!enabled) return DEFAULTS;
    return {
      enabled,
      brand_name: s.brokerage_name || DEFAULTS.brand_name,
      logo_url: s.logo_url || "",
      primary_color: raw.primary_color || DEFAULTS.primary_color,
      accent_color: raw.accent_color || DEFAULTS.accent_color,
      sender_name: raw.email_sender_name || s.brokerage_name || DEFAULTS.sender_name,
    };
  }, [s]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (branding.enabled) {
      root.style.setProperty("--brand-primary", branding.primary_color);
      root.style.setProperty("--brand-accent", branding.accent_color);
    } else {
      root.style.removeProperty("--brand-primary");
      root.style.removeProperty("--brand-accent");
    }
  }, [branding]);

  return <Ctx.Provider value={branding}>{children}</Ctx.Provider>;
}

export function useBranding(): Branding {
  return useContext(Ctx);
}
