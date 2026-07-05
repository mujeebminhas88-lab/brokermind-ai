/**
 * User Preferences — theme, default export format, notification preferences,
 * and default underwriting values.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { Bell, Settings2 } from "lucide-react";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";

export function UserPreferencesPanel() {
  const p = useUserPreferencesStore();

  useEffect(() => {
    void p.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light-theme", p.theme === "light");
  }, [p.theme]);

  const set = async (patch: Parameters<typeof p.patch>[0]) => {
    await p.patch(patch);
  };

  return (
    <section className="space-y-5">
      <div className="rounded-sm border border-border bg-card p-5">
        <header className="mb-4 flex items-center gap-2 border-b border-border pb-3">
          <Settings2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-bold tracking-tight">Appearance & Export</h2>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Theme</Label>
            <div className="flex gap-1.5">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => void set({ theme: t })}
                  className={pillCls(p.theme === t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Default Dossier Export</Label>
            <div className="flex gap-1.5">
              {(["pdf", "xlsx"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => void set({ default_export: t })}
                  className={pillCls(p.default_export === t)}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-border bg-card p-5">
        <header className="mb-4 flex items-center gap-2 border-b border-border pb-3">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-bold tracking-tight">Notifications</h2>
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle label="Email notifications" value={p.email_notifications} onChange={(v) => void set({ email_notifications: v })} />
          <Toggle label="In-app notifications" value={p.in_app_notifications} onChange={(v) => void set({ in_app_notifications: v })} />
        </div>
        <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
          In-app alerts stream to the bell icon in the header, scoped to your firm. Email delivery activates once your firm email domain is configured under Firm Profile → Branding.
        </p>

        <div className="mt-4 border-t border-border pt-3">
          <div className="mb-2 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">Trigger events</div>
          <div className="grid gap-2 md:grid-cols-2">
            <Toggle label="Rate hold expiring" value={p.notif_rate_hold} onChange={(v) => void set({ notif_rate_hold: v })} />
            <Toggle label="Condition overdue" value={p.notif_condition_overdue} onChange={(v) => void set({ notif_condition_overdue: v })} />
            <Toggle label="Renewal approaching" value={p.notif_renewal_approaching} onChange={(v) => void set({ notif_renewal_approaching: v })} />
            <Toggle label="New compliance flag" value={p.notif_new_flag} onChange={(v) => void set({ notif_new_flag: v })} />
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-border bg-card p-5">
        <header className="mb-4 border-b border-border pb-3">
          <h2 className="font-display text-base font-bold tracking-tight">Underwriting Defaults</h2>
          <p className="text-xs text-muted-foreground">Applied when a field is left blank on a new application.</p>
        </header>
        <div className="grid gap-3 md:grid-cols-3">
          <NumField label="Amortization (years)" value={p.default_amortization} onChange={(v) => void set({ default_amortization: v })} min={5} max={40} />
          <NumField label="Term (years)" value={p.default_term} onChange={(v) => void set({ default_term: v })} min={1} max={10} />
          <NumField label="Heating cost ($/mo)" value={p.default_heating_cost} onChange={(v) => void set({ default_heating_cost: v })} min={0} />
        </div>
        <p className="mt-2 rounded-sm border border-warning/30 bg-warning-bg px-3 py-2 text-[11px] text-warning-fg">
          Property tax is not auto-filled — always enter the actual figure per the tax bill.
        </p>
        <button
          onClick={() => toast.success("Preferences saved.")}
          className="mt-4 rounded-sm border border-primary bg-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground"
        >
          Done
        </button>
      </div>
    </section>
  );
}

function pillCls(active: boolean) {
  return `rounded-sm border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
    active ? "border-chart-2 bg-chart-2/10 text-chart-2" : "border-border text-muted-foreground hover:bg-muted"
  }`;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-sm border border-border bg-background px-3 py-2 text-sm">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-4 w-8 rounded-full transition-colors ${value ? "bg-chart-2" : "bg-muted"}`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${value ? "left-4" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground"
      />
    </label>
  );
}
