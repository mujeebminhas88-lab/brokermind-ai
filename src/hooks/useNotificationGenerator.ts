/**
 * useNotificationGenerator — scans rate_holds, conditions, renewals, and
 * compliance_flags for the current firm and inserts notification rows for
 * matching events, respecting the user's notification preferences.
 *
 * Deduped by dedupe_key so the same event only notifies once per bucket.
 * Runs on mount and every 5 minutes while the app is open.
 */
import { useEffect } from "react";
import { supabase } from "@/supabase/client";
import { useNotificationsStore } from "@/store/notificationsStore";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";
import { useFirmContext } from "@/hooks/useFirmContext";

const SCAN_MS = 5 * 60_000;

type RateHoldRow = { id: string; lender: string | null; expiry_date: string; application_id: string | null };
type ConditionRow = { id: string; label: string | null; description: string | null; due_date: string | null; status: string; application_id: string | null };
type RenewalRow = { id: string; client_name: string | null; maturity_date: string | null };
type ComplianceRow = { id: string; code: string | null; severity: string | null; message: string | null; status: string | null };

export function useNotificationGenerator() {
  const { firmId } = useFirmContext();
  const prefs = useUserPreferencesStore();
  const create = useNotificationsStore((s) => s.create);
  const load = useNotificationsStore((s) => s.load);

  useEffect(() => {
    if (!firmId) return;
    if (!prefs.in_app_notifications) return;
    let cancelled = false;

    const dayKey = () => new Date().toISOString().slice(0, 10);

    const scan = async () => {
      const today = new Date();
      const in7 = new Date(today.getTime() + 7 * 86400_000).toISOString();
      const in30 = new Date(today.getTime() + 30 * 86400_000).toISOString();
      const nowIso = today.toISOString();

      // 1. Rate hold expiry (<=7 days)
      if (prefs.notif_rate_hold) {
        const { data } = await supabase
          .from("rate_holds")
          .select("id, lender, expiry_date, application_id")
          .lte("expiry_date", in7)
          .gte("expiry_date", nowIso);
        for (const r of ((data ?? []) as unknown as RateHoldRow[])) {
          const daysLeft = Math.max(0, Math.ceil((new Date(r.expiry_date).getTime() - today.getTime()) / 86400_000));
          void create({
            firm_id: firmId,
            type: "rate_hold_expiry",
            title: `Rate hold expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
            body: `${r.lender ?? "Unknown lender"} — expires ${r.expiry_date.slice(0, 10)}`,
            entity_type: "rate_hold",
            entity_id: r.id,
            severity: daysLeft <= 2 ? "critical" : "warning",
            dedupe_key: `rate_hold_expiry:${r.id}:${dayKey()}`,
          });
        }
      }

      // 2. Overdue conditions
      if (prefs.notif_condition_overdue) {
        const { data } = await supabase
          .from("conditions")
          .select("id, label, description, due_date, status, application_id")
          .lt("due_date", nowIso.slice(0, 10))
          .neq("status", "satisfied");
        for (const r of ((data ?? []) as unknown as ConditionRow[])) {
          if (!r.due_date) continue;
          void create({
            firm_id: firmId,
            type: "condition_overdue",
            title: "Condition overdue",
            body: `${r.label ?? r.description ?? "Condition"} was due ${r.due_date}`,
            entity_type: "condition",
            entity_id: r.id,
            severity: "critical",
            dedupe_key: `condition_overdue:${r.id}:${dayKey()}`,
          });
        }
      }

      // 3. Renewals approaching (<=30 days)
      if (prefs.notif_renewal_approaching) {
        const { data } = await supabase
          .from("renewals")
          .select("id, client_name, maturity_date")
          .lte("maturity_date", in30.slice(0, 10))
          .gte("maturity_date", nowIso.slice(0, 10));
        for (const r of ((data ?? []) as unknown as RenewalRow[])) {
          if (!r.maturity_date) continue;
          const daysLeft = Math.max(0, Math.ceil((new Date(r.maturity_date).getTime() - today.getTime()) / 86400_000));
          void create({
            firm_id: firmId,
            type: "renewal_approaching",
            title: `Renewal in ${daysLeft} days`,
            body: `${r.client_name ?? "Client"} — matures ${r.maturity_date}`,
            entity_type: "renewal",
            entity_id: r.id,
            severity: daysLeft <= 14 ? "warning" : "info",
            dedupe_key: `renewal_approaching:${r.id}:${dayKey()}`,
          });
        }
      }

      // 4. New compliance flags (last 24h, open)
      if (prefs.notif_new_flag) {
        const since = new Date(today.getTime() - 24 * 3600_000).toISOString();
        const { data } = await supabase
          .from("compliance_flags")
          .select("id, code, severity, message, status")
          .gte("created_at", since)
          .eq("status", "open");
        for (const r of ((data ?? []) as unknown as ComplianceRow[])) {
          void create({
            firm_id: firmId,
            type: "compliance_flag",
            title: `New compliance flag: ${r.code ?? "Issue"}`,
            body: r.message,
            entity_type: "compliance_flag",
            entity_id: r.id,
            severity:
              r.severity === "CRITICAL" || r.severity === "high"
                ? "critical"
                : r.severity === "WARN" || r.severity === "medium"
                  ? "warning"
                  : "info",
            dedupe_key: `compliance_flag:${r.id}`,
          });
        }
      }

      if (!cancelled) await load();
    };

    void scan();
    const t = setInterval(() => void scan(), SCAN_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [
    firmId,
    prefs.in_app_notifications,
    prefs.notif_rate_hold,
    prefs.notif_condition_overdue,
    prefs.notif_renewal_approaching,
    prefs.notif_new_flag,
    create,
    load,
  ]);
}
