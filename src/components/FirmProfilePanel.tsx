/**
 * Firm Profile & Branding — feeds dossier PDF header, email templates, and
 * compliance documents. Includes logo upload + completeness indicator.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, ImageIcon, Trash2, Upload } from "lucide-react";
import { supabase } from "@/supabase/client";
import { computeCompleteness, useBrokerSettingsStore } from "@/store/brokerSettingsStore";

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function FirmProfilePanel() {
  const s = useBrokerSettingsStore();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void s.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeness = useMemo(() => computeCompleteness(s), [s]);

  const save = async () => {
    setSaving(true);
    await s.save({});
    setSaving(false);
    toast.success("Firm profile saved.");
  };

  const toggleProvince = (p: string) => {
    const set = new Set(s.provinces);
    if (set.has(p)) set.delete(p);
    else set.add(p);
    s.patchLocal({ provinces: Array.from(set).sort() });
  };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "png";
      const key = `${uid}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brokerage-logos")
        .upload(key, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage
        .from("brokerage-logos")
        .createSignedUrl(key, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? key;
      await s.save({ logo_url: url });
      toast.success("Logo uploaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearLogo = async () => {
    await s.save({ logo_url: "" });
  };

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <header className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-foreground">
              Firm Profile & Branding
            </h2>
            <p className="text-xs text-muted-foreground">
              Appears on dossier cover page, email signatures, and client-facing PDFs.
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Completeness
          </div>
          <div className={`font-mono text-lg tabular-nums ${completeness < 60 ? "text-warning-fg" : completeness < 100 ? "text-chart-2" : "text-success"}`}>
            {completeness}%
          </div>
        </div>
      </header>

      {completeness < 100 && (
        <div className="mb-3 rounded-sm border border-warning/30 bg-warning-bg px-3 py-2 text-[11px] text-warning-fg">
          Profile incomplete — dossier will use default BrokerMind branding until firm fields are filled.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Brokerage Name">
          <input className={inputCls} value={s.brokerage_name} onChange={(e) => s.patchLocal({ brokerage_name: e.target.value })} />
        </Field>
        <Field label="Broker Full Name">
          <input className={inputCls} value={s.broker_name} onChange={(e) => s.patchLocal({ broker_name: e.target.value })} />
        </Field>
        <Field label="Licence # (FSRA / BCFSA / RECA)">
          <input className={inputCls} value={s.licence_number} onChange={(e) => s.patchLocal({ licence_number: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputCls} value={s.broker_email} onChange={(e) => s.patchLocal({ broker_email: e.target.value })} />
        </Field>
        <Field label="Office Phone">
          <input className={inputCls} value={s.phone} onChange={(e) => s.patchLocal({ phone: e.target.value })} />
        </Field>
        <Field label="Direct Phone">
          <input className={inputCls} value={s.direct_phone} onChange={(e) => s.patchLocal({ direct_phone: e.target.value })} />
        </Field>
      </div>

      <div className="mt-3">
        <Field label="Mailing Address (dossier cover page)">
          <textarea
            className="w-full rounded-sm border border-input bg-background p-2 text-sm"
            rows={2}
            value={s.mailing_address}
            onChange={(e) => s.patchLocal({ mailing_address: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Provinces of Operation
        </div>
        <div className="flex flex-wrap gap-1">
          {PROVINCES.map((p) => {
            const active = s.provinces.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggleProvince(p)}
                className={`rounded-sm border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                  active
                    ? "border-chart-2 bg-chart-2/10 text-chart-2"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Email Signature">
          <textarea
            className="w-full rounded-sm border border-input bg-background p-2 text-sm"
            rows={5}
            value={s.signature}
            onChange={(e) => s.patchLocal({ signature: e.target.value })}
            placeholder={"e.g.\nJohn Smith\nMortgage Broker · Example Brokerage\nLicence #M12345678\nDirect: 555-123-4567"}
          />
          <div className="mt-1 rounded-sm border border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
            <div className="mb-1 text-[9.5px] uppercase tracking-wider">Preview</div>
            <pre className="whitespace-pre-wrap font-sans text-xs text-foreground/80">{s.signature || "(no signature)"}</pre>
          </div>
        </Field>

        <Field label="Brokerage Logo (dossier header)">
          <div className="rounded-sm border border-dashed border-border bg-background p-4">
            {s.logo_url ? (
              <div className="space-y-2">
                <img src={s.logo_url} alt="Brokerage logo" className="max-h-24 rounded-sm bg-white p-2" />
                <button
                  onClick={clearLogo}
                  className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline"
                >
                  <Trash2 className="h-3 w-3" /> Remove logo
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center text-xs text-muted-foreground">
                <ImageIcon className="h-8 w-8 opacity-50" />
                <span>PNG · JPG · SVG · recommended 320×80 px</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLogo(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-muted disabled:opacity-40"
            >
              <Upload className="h-3 w-3" /> {uploading ? "Uploading…" : s.logo_url ? "Replace logo" : "Upload logo"}
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-sm border border-primary bg-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
