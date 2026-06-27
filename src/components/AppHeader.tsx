import { Link } from "@tanstack/react-router";
import logoAsset from "@/assets/brokermind-logo.png.asset.json";

const TABS: { to: "/pipeline" | "/" | "/compliance" | "/settings"; label: string }[] = [
  { to: "/pipeline", label: "Pipeline" },
  { to: "/", label: "Underwriting Workspace" },
  { to: "/compliance", label: "Compliance" },
  { to: "/settings", label: "Settings" },
];

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{
        background: "linear-gradient(90deg, #07070d 0%, #0b0b16 50%, #07070d 100%)",
        borderColor: "rgba(255,255,255,0.08)",
      }}
    >
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-6 py-3">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="BrokerMind AI"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              style={{ filter: "drop-shadow(0 0 8px rgba(0,188,212,0.35))" }}
            />
            <span className="font-display text-[15px] font-bold tracking-tight leading-none">
              <span style={{ color: "#FFFFFF" }}>Broker</span>
              <span style={{ color: "#00BCD4" }}>Mind</span>
              <span style={{ color: "#E91E8C" }}>AI</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: true }}
                className="rounded-sm px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] transition"
                style={{ color: "rgba(255,255,255,0.55)" }}
                activeProps={{
                  className:
                    "rounded-sm px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white",
                  style: {
                    background:
                      "linear-gradient(90deg, #00BCD4 0%, #9C27B0 60%, #E91E8C 100%)",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 6px 18px -8px #E91E8C",
                  },
                }}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        {right ? (
          <div className="flex items-center gap-3 text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
            {right}
          </div>
        ) : null}
      </div>
    </header>
  );
}
