/**
 * WhiteLabelPanel — admin-only controls to enable custom branding
 * (colors, brand name, email sender). Lives in Settings → Firm Profile.
 */
import { useEffect, useState } from "react";
import { useBrokerSettingsStore } from "@/store/brokerSettingsStore";
import { Palette } from "lucide-react";

export function WhiteLabelPanel() {
  const s = useBrokerSettingsStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = s as any;
  const [enabled, setEnabled] = useState<boolean>(!!raw.white_label_enabled);
  const [primary, setPrimary] = useState<string>(raw.primary_color || "#00BCD4");
  const [accent, setAccent] = useState<string>(raw.accent_color || "#E91E8C");
  const [sender, setSender] = useState<string>(raw.email_sender_name || "");

  useEffect(() => {
    void s.load();
  }, [s.load]);

  useEffect(() => {
    setEnabled(!!raw.white_label_enabled);
    setPrimary(raw.primary_color || "#00BCD4");
    setAccent(raw.accent_color || "#E91E8C");
    setSender(raw.email_sender_name || "");
  }, [raw.white_label_enabled, raw.primary_color, raw.accent_color, raw.email_sender_name]);

  async function save() {
    await s.save({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...( { white_label_enabled: enabled, primary_color: primary, accent_color: accent, email_sender_name: sender } as any),
    });
  }

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <header className="mb-4 flex items-center gap-2">
        <Palette className="h-4 w-4 text-chart-4" />
        <h2 className="font-display text-base font-bold tracking-tight">White Label Branding</h2>
      </header>
      <p className="mb-4 text-xs text-muted-foreground">
        Replace BrokerMind AI branding with your own across the header, dossier PDFs, and email notifications.
      </p>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enable white-label branding
      </label>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Primary color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-8 w-12 rounded-sm border border-border bg-background" />
            <input value={primary} onChange={(e) => setPrimary(e.target.value)} className="flex-1 rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-mono" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Accent color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 w-12 rounded-sm border border-border bg-background" />
            <input value={accent} onChange={(e) => setAccent(e.target.value)} className="flex-1 rounded-sm border border-border bg-background px-2 py-1.5 text-xs font-mono" />
          </div>
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Email sender name</label>
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="e.g. Acme Mortgages"
            className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button onClick={() => void save()} className="rounded-sm bg-chart-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-black">
          Save branding
        </button>
        <div className="flex items-center gap-2 rounded-sm border border-border bg-background px-3 py-1.5 text-[11px]">
          <div className="h-3 w-3 rounded-sm" style={{ background: primary }} />
          <div className="h-3 w-3 rounded-sm" style={{ background: accent }} />
          <span className="text-muted-foreground">Live preview</span>
        </div>
      </div>
    </section>
  );
}
