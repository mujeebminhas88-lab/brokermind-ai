import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/brokermind-logo.png";
import { useUser } from "@/hooks/useUser";
import { LogOut } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotificationGenerator } from "@/hooks/useNotificationGenerator";

const TABS: { to: "/dashboard" | "/pipeline" | "/" | "/compliance" | "/renewals" | "/settings"; label: string }[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/", label: "Workspace" },
  { to: "/renewals", label: "Renewals" },
  { to: "/compliance", label: "Compliance" },
  { to: "/settings", label: "Settings" },
];

export function AppHeader({ right }: { right?: React.ReactNode }) {
  const { user, signOut } = useUser();
  useNotificationGenerator();
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{
        background: "linear-gradient(90deg, #07070d 0%, #0b0b16 50%, #07070d 100%)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-6 py-2.5">
        <div className="flex items-center gap-10">
          <Link to="/" className="flex items-center" aria-label="BrokerMind AI">
            <img
              src={logoUrl}
              alt="BrokerMind AI"
              className="h-12 w-auto object-contain"
              style={{ filter: "drop-shadow(0 0 10px rgba(0,188,212,0.25))" }}
            />
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: true }}
                className="relative rounded-sm px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] transition-colors"
                style={{ color: "rgba(255,255,255,0.6)" }}
                activeProps={{
                  className:
                    "relative rounded-sm px-3 py-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white",
                  style: {
                    color: "#ffffff",
                    background: "rgba(255,255,255,0.06)",
                    boxShadow: "inset 0 -2px 0 0 #00BCD4",
                  },
                }}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <div
          className="flex items-center gap-3 text-[11px]"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          {right}
          {user ? (
            <>
              <span
                className="hidden max-w-[200px] truncate md:inline"
                style={{ color: "rgba(255,255,255,0.55)" }}
                title={user.email ?? undefined}
              >
                {user.email}
              </span>
              <button
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors hover:text-white"
                style={{
                  color: "rgba(255,255,255,0.75)",
                  borderColor: "rgba(255,255,255,0.12)",
                  background: "rgba(233,30,140,0.08)",
                }}
                aria-label="Sign out"
              >
                <LogOut size={12} />
                Sign Out
              </button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
