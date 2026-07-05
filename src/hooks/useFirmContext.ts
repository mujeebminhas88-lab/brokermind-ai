/**
 * useFirmContext — resolves the current user's firm_id via firm_members.
 * Cached in memory for the session. Used to stamp firm_id on inserts.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/supabase/client";

let cachedFirmId: string | null = null;

export function useFirmContext() {
  const [firmId, setFirmId] = useState<string | null>(cachedFirmId);
  const [loading, setLoading] = useState(!cachedFirmId);

  useEffect(() => {
    if (cachedFirmId) return;
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("firm_members" as never)
        .select("firm_id, is_owner, created_at")
        .eq("user_id", u.user.id)
        .order("is_owner", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = data as { firm_id?: string } | null;
      if (row?.firm_id) {
        cachedFirmId = row.firm_id;
        if (!cancelled) setFirmId(row.firm_id);
      } else {
        // Auto-provision a solo firm for signed-in users who have none.
        const { data: newFirm } = await supabase
          .from("firms" as never)
          .insert({ name: "My Firm" })
          .select("id")
          .maybeSingle();
        const nfid = (newFirm as { id?: string } | null)?.id;
        if (nfid) {
          await supabase.from("firm_members" as never).insert({
            firm_id: nfid,
            user_id: u.user.id,
            is_owner: true,
          });
          cachedFirmId = nfid;
          if (!cancelled) setFirmId(nfid);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { firmId, loading };
}
