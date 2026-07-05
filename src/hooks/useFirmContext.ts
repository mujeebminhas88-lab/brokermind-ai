/**
 * useFirmContext — resolves the current user's firm_id via firm_members.
 * Cached per session. Auto-provisions a solo firm if none exists.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

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
      const { data } = await sb
        .from("firm_members")
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
        const { data: newFirm } = await sb.from("firms").insert({ name: "My Firm" }).select("id").maybeSingle();
        const nfid = (newFirm as { id?: string } | null)?.id;
        if (nfid) {
          await sb.from("firm_members").insert({ firm_id: nfid, user_id: u.user.id, is_owner: true });
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
