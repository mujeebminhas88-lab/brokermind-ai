import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Lock } from "lucide-react";

type AuditRow = {
  id: string;
  user_id: string;
  action_type: string | null;
  action: string;
  table_name: string | null;
  entity_type: string | null;
  record_id: string | null;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  created_at: string;
};

const ACTIONS = [
  "ALL",
  "INSERT",
  "UPDATE",
  "DELETE",
  "VIEW",
  "EXPORT",
  "LOGIN",
  "LOGOUT",
  "VERIFY",
  "OVERRIDE",
  "UNLOCK",
];

const PAGE_SIZE = 25;

export function AuditLogViewer() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    action: "ALL",
    table: "",
    user: "",
    from: "",
    to: "",
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      let q = supabase
        .from("audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (filters.action !== "ALL") q = q.eq("action_type", filters.action);
      if (filters.table.trim()) q = q.ilike("table_name", `%${filters.table.trim()}%`);
      if (filters.user.trim()) q = q.eq("user_id", filters.user.trim());
      if (filters.from) q = q.gte("created_at", new Date(filters.from).toISOString());
      if (filters.to) q = q.lte("created_at", new Date(filters.to).toISOString());
      const { data, count: c } = await q;
      if (cancelled) return;
      setRows((data ?? []) as unknown as AuditRow[]);
      setCount(c ?? 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, page, filters]);

  const summary = useMemo(
    () => `${count} ${count === 1 ? "entry" : "entries"}`,
    [count],
  );

  if (roleLoading) {
    return (
      <div className="rounded-sm border border-border bg-card p-6 text-xs text-muted-foreground">
        Loading audit access…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-start gap-3 rounded-sm border border-border bg-card p-6">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <div>
          <div className="font-display text-sm font-semibold text-foreground">
            Audit Log — Admin Only
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            The global audit trail is restricted to admin users. Your own activity is still
            logged and available on request.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-slate-900 px-4 py-2.5 text-white">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
            Global Audit Trail
          </div>
          <div className="text-xs text-slate-400">
            Append-only · {summary}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-900">
          <select
            value={filters.action}
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({ ...f, action: e.target.value }));
            }}
            className="rounded-sm border border-slate-300 bg-white px-2 py-1"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            value={filters.table}
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({ ...f, table: e.target.value }));
            }}
            placeholder="Table"
            className="w-32 rounded-sm border border-slate-300 bg-white px-2 py-1"
          />
          <input
            value={filters.user}
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({ ...f, user: e.target.value }));
            }}
            placeholder="User UUID"
            className="w-56 rounded-sm border border-slate-300 bg-white px-2 py-1"
          />
          <input
            type="date"
            value={filters.from}
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({ ...f, from: e.target.value }));
            }}
            className="rounded-sm border border-slate-300 bg-white px-2 py-1"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => {
              setPage(0);
              setFilters((f) => ({ ...f, to: e.target.value }));
            }}
            className="rounded-sm border border-slate-300 bg-white px-2 py-1"
          />
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Timestamp</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Table</th>
              <th className="px-3 py-2 text-left">Record</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No audit entries match the filters.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const isOpen = expanded === r.id;
              const action = r.action_type ?? r.action;
              const table = r.table_name ?? r.entity_type ?? "—";
              const rec = r.record_id ?? r.entity_id ?? "—";
              return (
                <Fragment key={r.id}>
                  <tr
                    className="border-t border-border hover:bg-muted/40"
                  >

                    <td className="px-3 py-2 font-mono text-[11px]">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-sm bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {action}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px]">{table}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {rec === "—" ? rec : (rec as string).slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {r.user_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {r.ip_address ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setExpanded(isOpen ? null : r.id)}
                        className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--brand-cyan,187_100%_42%))] hover:underline"
                      >
                        {isOpen ? "Hide" : "Diff"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${r.id}-diff`} className="border-t border-border bg-muted/30">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              Old value
                            </div>
                            <pre className="max-h-64 overflow-auto rounded-sm bg-slate-950 p-2 text-[10px] text-slate-200">
{JSON.stringify(r.old_value, null, 2) ?? "null"}
                            </pre>
                          </div>
                          <div>
                            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                              New value
                            </div>
                            <pre className="max-h-64 overflow-auto rounded-sm bg-slate-950 p-2 text-[10px] text-slate-200">
{JSON.stringify(r.new_value, null, 2) ?? "null"}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        <span>
          Page {page + 1} of {pages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-sm border border-border px-2 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-sm border border-border px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  );
}
