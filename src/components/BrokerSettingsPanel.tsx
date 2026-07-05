/**
 * Broker Settings Panel — profile info used in email templates and PDF dossier.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { UserCog } from "lucide-react";
import { useBrokerSettingsStore } from "@/store/brokerSettingsStore";

const inputCls =
  "w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function BrokerSettingsPanel() {
  const s = useBrokerSettingsStore();
  useEffect(() => { s.load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = async () => {
    await s.save({});
    toast.success("Broker profile saved.");
  };

  return (
    <section className="rounded-sm border border-border bg-card p-5">
      <header className="mb-4 flex items-center gap-2 border-b border-border pb-3">
        <UserCog className="h-4 w-4 text-primary" />
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">
            Broker Profile
          </h2>
          <p className="text-xs text-muted-foreground">
            Used in generated emails and PDF dossier signatures.
          </p>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Full Name">
          <input className={inputCls} value={s.broker_name} onChange={(e) => s.patchLocal({ broker_name: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className={inputCls} value={s.broker_email} onChange={(e) => s.patchLocal({ broker_email: e.target.value })} />
        </Field>
        <Field label="Licence Number">
          <input className={inputCls} value={s.licence_number} onChange={(e) => s.patchLocal({ licence_number: e.target.value })} />
        </Field>
        <Field label="Brokerage">
          <input className={inputCls} value={s.brokerage_name} onChange={(e) => s.patchLocal({ brokerage_name: e.target.value })} />
        </Field>
        <Field label="Phone">
          <input className={inputCls} value={s.phone} onChange={(e) => s.patchLocal({ phone: e.target.value })} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Email Signature (overrides auto-signature)">
          <textarea className="w-full rounded-sm border border-input bg-background p-2 text-sm" rows={4}
            value={s.signature} onChange={(e) => s.patchLocal({ signature: e.target.value })}
            placeholder={"e.g.\nJohn Smith\nMortgage Broker · Example Brokerage\nLicence #M12345678"} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={save} className="rounded-sm border border-primary bg-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
          Save Profile
        </button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
