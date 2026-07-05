/**
 * SettingsAuditPanel — surfaces recent security & access events (role
 * assignments, team invites, integration tests) from audit_logs, above the
 * generic AuditLogViewer.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/supabase/client";
import { Users, Plug, ShieldCheck } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface Row {
  id: string;
  action_type: string | null;
  action: string;
  table_name: string | null;
  entity_type: string | null;
  user_id: string;
  details: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  old_value: Record<string, unknown> | null;
  created_at: string;
}

const CATEGORIES = [
  { key: "role", label: "Role Changes", tables: ["user_roles"], icon: ShieldCheck, color: "#00BCD4" },
  { key: "invite", label: "Team & Firm", tables: ["firm_members", "firms"], icon: Users, color: "#E91E8C" },
  { key: "integration", label: "Integration Events", tables: ["integration_status"], icon: Plug, color: "#7C4DFF" },
] as const;

function categorize(table: string | null): typeof CATEGORIES[number] | null {
  if (!table) return null;
  return CATEGORIES.find((c) => c.tables.includes(table as never)) ?? null;
}

export function SettingsAuditPanel() {
  const { isAdmin } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | "role" | "invite" | "integration">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const tables = CATEGORIES.flatMap((c) => c.tables);
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action_type, action, table_name, entity_type, user_id, details, new_value, old_value, created_at")
        .in("table_name", tables)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setRows((data ?? []) as unknown as Row[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered =
    filter === "all"
      ? rows
      : rows.filter((r) => {
          const c = categorize(r.table_name);
          return c?.key === filter;
        });

  const describe = (r: Row): string => {
    const cat = categorize(r.table_name);
    if (cat?.key === "role") {
      const role = (r.new_value?.role as string) ?? (r.old_value?.role as string) ?? "role";
      return `${r.action_type ?? r.action} role "${role}"`;
    }
    if (cat?.key === "invite") {
      if (r.table_name === "firms") return `${r.action_type ?? r.action} firm`;
      const owner = (r.new_value?.is_owner as boolean) ? " (owner)" : "";
      return `${r.action_type ?? r.action} member${owner}`;
    }
    if (cat?.key === "integration") {
      const provider = (r.new_value?.provider as string) ?? (r.old_value?.provider as string) ?? "integration";
      const status = (r.new_value?.status as string) ?? "";
      return `${provider}: ${status || r.action_type || r.action}`;
    }
    return r.action_type ?? r.action;
  };

  if (!isAdmin) {
    return (
      <section className="rounded-sm border border-border bg-card p-5">
        <h2 className="font-display text-base font-bold tracking-tight text-foreground">Security &amp; Access Events</h2>
        <p className="mt-2 text-xs text-muted-foreground">Admin role required to view security events.</p>
      </section>
    );
  }

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">Security &amp; Access Events</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Recent role changes, team invites, and integration test events (last 50).
          </p>
        </div>
        <div className="flex gap-1">
          {(["all", ...CATEGORIES.map((c) => c.key)] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-sm border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                filter === k ? "border-chart-2 bg-chart-2/10 text-chart-2" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {k === "all" ? "All" : CATEGORIES.find((c) => c.key === k)?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {loading ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No events yet.</div>
        ) : (
          filtered.map((r) => {
            const cat = categorize(r.table_name);
            const Icon = cat?.icon ?? ShieldCheck;
            const color = cat?.color ?? "#888";
            return (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-sm border border-border bg-background px-3 py-2"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm" style={{ background: `${color}22`, color }}>
                  <Icon size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-xs font-semibold text-foreground">{describe(r)}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    <span className="uppercase tracking-wider">{cat?.label ?? r.table_name}</span>
                    <span className="mx-1">·</span>
                    <span className="font-mono">actor {r.user_id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
