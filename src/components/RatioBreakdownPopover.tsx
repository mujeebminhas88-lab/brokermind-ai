import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

interface Row {
  label: string;
  value: string;
  emphasis?: boolean;
}

interface Props {
  title: string;
  formula: string;
  rows: Row[];
  result: string;
  accent?: "cyan" | "magenta";
  children: React.ReactNode;
}

export function RatioBreakdownPopover({
  title,
  formula,
  rows,
  result,
  accent = "cyan",
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const accentColor =
    accent === "magenta" ? "hsl(var(--brand-magenta, 328 82% 51%))" : "hsl(var(--brand-cyan, 187 100% 42%))";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        className="group block w-full cursor-help text-left"
      >
        {children}
        <Info className="pointer-events-none absolute right-2 top-2 h-3 w-3 text-muted-foreground opacity-60 group-hover:opacity-100" />
      </button>
      {open && (
        <div
          className="absolute left-1/2 top-full z-40 mt-2 w-80 -translate-x-1/2 rounded-sm border border-border bg-card p-4 shadow-2xl"
          style={{ borderTop: `3px solid ${accentColor}`, fontFamily: "Inter, sans-serif" }}
          onMouseLeave={() => setOpen(false)}
        >
          <div
            className="mb-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: accentColor }}
          >
            Formula Audit · {title}
          </div>
          <div className="mb-3 rounded-sm bg-muted/40 px-2 py-1 font-mono text-[11px] text-foreground">
            {formula}
          </div>
          <table className="w-full text-xs">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border/40 last:border-0">
                  <td className="py-1 text-muted-foreground">{r.label}</td>
                  <td
                    className={`py-1 text-right font-mono ${
                      r.emphasis ? "font-bold text-foreground" : "text-foreground"
                    }`}
                  >
                    {r.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            className="mt-3 flex items-center justify-between rounded-sm px-2 py-1.5"
            style={{ background: `${accentColor}18` }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
              Result
            </span>
            <span className="font-mono text-sm font-bold" style={{ color: accentColor }}>
              {result}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
