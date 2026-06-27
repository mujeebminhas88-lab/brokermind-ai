import { Link } from "@tanstack/react-router";

const TABS: { to: "/pipeline" | "/" | "/compliance"; label: string }[] = [
  { to: "/pipeline", label: "Pipeline" },
  { to: "/", label: "Underwriting Workspace" },
  { to: "/compliance", label: "Compliance" },
];

export function AppHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-6 py-3">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-display text-base font-bold tracking-tight">
            <span style={{ color: "var(--brand-cyan)" }}>Broker</span>
            <span style={{ color: "var(--brand-magenta)" }}>Mind</span>
            <span style={{ color: "var(--brand-purple)" }}>AI</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                activeOptions={{ exact: true }}
                className="rounded-sm px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
                activeProps={{
                  className:
                    "rounded-sm px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary-foreground",
                  style: { background: "var(--brand-cyan)" },
                }}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
        {right ? <div className="flex items-center gap-3 text-[11px] text-muted-foreground">{right}</div> : null}
      </div>
    </header>
  );
}
