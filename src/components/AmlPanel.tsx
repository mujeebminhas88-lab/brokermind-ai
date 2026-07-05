import { useAmlStore, computeAmlCompletion, type PrimaryIdType, type SecondaryIdType, type VerificationMethod } from "@/store/amlStore";
import { Upload, ShieldAlert, CheckCircle2 } from "lucide-react";

export function AmlPanel() {
  const s = useAmlStore();
  const { complete, missing } = computeAmlCompletion(s);

  return (
    <section id="aml-panel" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            AML / FINTRAC Compliance Checklist
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Identity verification, PEP screening, and reportable transaction determination.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            complete
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {complete ? "Complete" : `${missing.length} incomplete`}
        </span>
      </header>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* Identity Verification */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            1 · Identity Verification
          </h3>
          <Field label="Primary ID Type">
            <select
              value={s.primaryIdType}
              onChange={(e) => s.patch({ primaryIdType: e.target.value as PrimaryIdType })}
              className={selectCls}
            >
              <option value="">Select…</option>
              <option>Passport</option>
              <option>Driver's Licence</option>
              <option>PR Card</option>
            </select>
          </Field>
          <UploadRow
            label="Primary ID Document"
            uploaded={s.primaryIdUploaded}
            onChange={(v) => s.patch({ primaryIdUploaded: v })}
          />
          <Field label="Secondary ID Type">
            <select
              value={s.secondaryIdType}
              onChange={(e) => s.patch({ secondaryIdType: e.target.value as SecondaryIdType })}
              className={selectCls}
            >
              <option value="">Select…</option>
              <option>Passport</option>
              <option>Driver's Licence</option>
              <option>PR Card</option>
              <option>Health Card</option>
              <option>Bank Statement</option>
              <option>Utility Bill</option>
            </select>
          </Field>
          <UploadRow
            label="Secondary ID Document"
            uploaded={s.secondaryIdUploaded}
            onChange={(v) => s.patch({ secondaryIdUploaded: v })}
          />
          <Field label="Verification Method">
            <select
              value={s.verificationMethod}
              onChange={(e) => s.patch({ verificationMethod: e.target.value as VerificationMethod })}
              className={selectCls}
            >
              <option value="">Select…</option>
              <option>In-person</option>
              <option>Dual process</option>
              <option>Video</option>
            </select>
          </Field>
          <Field label="Verification Date">
            <input
              type="date"
              value={s.verificationDate}
              onChange={(e) => s.patch({ verificationDate: e.target.value })}
              className={selectCls}
            />
          </Field>
        </div>

        {/* Screening */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            2 · Screening & Determinations
          </h3>

          <YesNo
            label="Is the applicant a Politically Exposed Person or Head of International Organisation?"
            value={s.isPep}
            onChange={(v) => s.patch({ isPep: v })}
          />
          {s.isPep && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <strong>Enhanced Due Diligence required:</strong> document source of wealth, obtain senior management approval, and enable ongoing monitoring.
            </div>
          )}

          <YesNo
            label="Is someone acting on behalf of the applicant (third party)?"
            value={s.isThirdParty}
            onChange={(v) => s.patch({ isThirdParty: v })}
          />
          {s.isThirdParty && (
            <div className="space-y-2 rounded-sm border border-border bg-muted/30 p-3">
              <Field label="Third-Party Name">
                <input value={s.thirdPartyName} onChange={(e) => s.patch({ thirdPartyName: e.target.value })} className={selectCls} />
              </Field>
              <Field label="Relationship">
                <input value={s.thirdPartyRelationship} onChange={(e) => s.patch({ thirdPartyRelationship: e.target.value })} className={selectCls} />
              </Field>
              <Field label="Reason">
                <input value={s.thirdPartyReason} onChange={(e) => s.patch({ thirdPartyReason: e.target.value })} className={selectCls} />
              </Field>
            </div>
          )}

          <YesNo
            label="Does this transaction involve cash exceeding $10,000?"
            value={s.isLargeCash}
            onChange={(v) => s.patch({ isLargeCash: v })}
          />
          {s.isLargeCash && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <strong>FINTRAC Large Cash Transaction Report required</strong> within 15 days. File through FINTRAC's F2R portal.
            </div>
          )}

          <Field label="Suspicious Transaction Indicators (free text)">
            <textarea
              rows={3}
              value={s.suspiciousNotes}
              onChange={(e) => s.patch({ suspiciousNotes: e.target.value })}
              placeholder="Document any suspicious indicators. If populated, a CRITICAL FINTRAC-STR flag is raised."
              className={`${selectCls} resize-none`}
            />
          </Field>
        </div>
      </div>

      {!complete && (
        <div className="mt-4 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <strong>Blocks dossier generation.</strong> Missing: {missing.join(", ")}.
        </div>
      )}
    </section>
  );
}

const selectCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

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

function UploadRow({
  label,
  uploaded,
  onChange,
}: {
  label: string;
  uploaded: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-sm border border-dashed border-border px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-foreground">
        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={uploaded}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        <span className={uploaded ? "text-success" : "text-muted-foreground"}>
          {uploaded ? "Uploaded" : "Not uploaded"}
        </span>
      </label>
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-foreground">{label}</div>
      <div className="flex gap-2">
        {(["Yes", "No"] as const).map((opt) => {
          const v = opt === "Yes";
          const active = value === v;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(v)}
              className={`rounded-sm border px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
                active
                  ? v
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-success bg-success/10 text-success"
                  : "border-input bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
