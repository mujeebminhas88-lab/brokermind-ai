import { useEffect, useRef, useState } from "react";
import { Bell, Check, AlertTriangle, Clock, ShieldAlert, CalendarClock } from "lucide-react";
import { useNotificationsStore, type NotificationType } from "@/store/notificationsStore";

const ICONS: Record<NotificationType, React.ComponentType<{ size?: number }>> = {
  rate_hold_expiry: Clock,
  condition_overdue: AlertTriangle,
  renewal_approaching: CalendarClock,
  compliance_flag: ShieldAlert,
};

const SEV_COLORS: Record<string, string> = {
  info: "#00BCD4",
  warning: "#F5A524",
  critical: "#E91E8C",
};

export function NotificationBell() {
  const rows = useNotificationsStore((s) => s.rows);
  const load = useNotificationsStore((s) => s.load);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors hover:text-white"
        style={{
          color: "rgba(255,255,255,0.75)",
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(0,188,212,0.06)",
        }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell size={12} />
        Alerts
        {unread > 0 && (
          <span
            className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ background: "#E91E8C" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-[380px] max-h-[520px] overflow-hidden rounded-sm border shadow-xl"
          style={{ background: "#0b0b16", borderColor: "rgba(255,255,255,0.12)" }}
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white">
              Notifications {unread > 0 && <span style={{ color: "#00BCD4" }}>· {unread} new</span>}
            </div>
            {unread > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-white"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[460px] overflow-y-auto">
            {rows.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No notifications yet. Alerts appear here as events occur.
              </div>
            ) : (
              rows.slice(0, 50).map((r) => {
                const Icon = ICONS[r.type] ?? Bell;
                const color = SEV_COLORS[r.severity] ?? SEV_COLORS.info;
                return (
                  <button
                    key={r.id}
                    onClick={() => void markRead(r.id)}
                    className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-white/5"
                    style={{
                      borderColor: "rgba(255,255,255,0.05)",
                      background: r.read_at ? "transparent" : "rgba(0,188,212,0.04)",
                    }}
                  >
                    <div
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm"
                      style={{ background: `${color}22`, color }}
                    >
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-[12px] font-semibold text-white">{r.title}</div>
                        {!r.read_at && <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
                      </div>
                      {r.body && <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{r.body}</div>}
                      <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{new Date(r.created_at).toLocaleString()}</span>
                        {r.read_at && <Check size={10} />}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
