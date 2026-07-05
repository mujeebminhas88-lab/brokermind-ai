import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/brokermind-logo.png";
import { useUser } from "@/hooks/useUser";
import { LogOut, Menu, X } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotificationGenerator } from "@/hooks/useNotificationGenerator";
import { useBranding } from "@/components/WhiteLabelProvider";
import { useState } from "react";

const TABS: { to: "/dashboard" | "/pipeline" | "/" | "/compliance" | "/renewals" | "/lender" | "/settings"; label: string }[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/", label: "Workspace" },
  { to: "/renewals", label: "Renewals" },
  { to: "/compliance", label: "Compliance" },
  { to: "/lender", label: "Lender" },
  { to: "/settings", label: "Settings" },
];

export function AppHeader({ right }: { right?: React.ReactNode }) {
  const { user, signOut } = useUser();
  useNotificationGenerator();
  const branding = useBranding();
  const [mobileNav, setMobileNav] = useState(false);

  const primary = branding.primary_color;
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{
        background: "linear-gradient(90deg, #07070d 0%, #0b0b16 50%, #07070d 100%)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-3 px-3 py-2.5 sm:gap-6 sm:px-6">
        <div className="flex items-center gap-4 md:gap-10">
          <Link to="/" className="flex items-center gap-2" aria-label={branding.brand_name}>
            {branding.enabled && branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.brand_name} className="h-9 w-auto object-contain sm:h-11" />
            ) : (
              <img
                src={logoUrl}
                alt="BrokerMind AI"
                className="h-9 w-auto object-contain sm:h-12"
                style={{ filter: `drop-shadow(0 0 10px ${primary}40)` }}
              />
            )}
            {branding.enabled && (
              <span className="hidden font-display text-sm font-bold uppercase tracking-wider text-white sm:inline">
                {branding.brand_name}
              </span>
            )}
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: true }}
                className="relative rounded-sm px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors lg:text-[11.5px] lg:tracking-[0.14em] lg:px-3"
                style={{ color: "rgba(255,255,255,0.6)" }}
                activeProps={{
                  className:
                    "relative rounded-sm px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white lg:text-[11.5px] lg:tracking-[0.14em] lg:px-3",
                  style: {
                    color: "#ffffff",
                    background: "rgba(255,255,255,0.06)",
                    boxShadow: `inset 0 -2px 0 0 ${primary}`,
                  },
                }}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-[11px] sm:gap-3" style={{ color: "rgba(255,255,255,0.75)" }}>
          {right}
          {user ? (
            <>
              <NotificationBell />
              <span
                className="hidden max-w-[200px] truncate lg:inline"
                style={{ color: "rgba(255,255,255,0.55)" }}
                title={user.email ?? undefined}
              >
                {user.email}
              </span>
              <button
                onClick={() => void signOut()}
                className="hidden items-center gap-1.5 rounded-sm border px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] transition-colors hover:text-white sm:inline-flex"
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
              <button
                onClick={() => setMobileNav((v) => !v)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm border text-white md:hidden"
                style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}
                aria-label="Toggle navigation"
              >
                {mobileNav ? <X size={14} /> : <Menu size={14} />}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {mobileNav && user && (
        <nav
          className="border-t md:hidden"
          style={{ borderColor: "rgba(255,255,255,0.08)", background: "#0b0b16" }}
          aria-label="Mobile"
        >
          <div className="grid grid-cols-2 gap-1 p-2">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                onClick={() => setMobileNav(false)}
                activeOptions={{ exact: true }}
                className="rounded-sm px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.03)" }}
                activeProps={{
                  className: "rounded-sm px-3 py-2 text-[11.5px] font-semibold uppercase tracking-wider text-white",
                  style: { color: "#fff", background: `${primary}20`, boxShadow: `inset 0 -2px 0 0 ${primary}` },
                }}
              >
                {t.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobileNav(false);
                void signOut();
              }}
              className="col-span-2 mt-1 inline-flex items-center justify-center gap-1.5 rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "rgba(255,255,255,0.75)", borderColor: "rgba(255,255,255,0.12)", background: "rgba(233,30,140,0.08)" }}
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
