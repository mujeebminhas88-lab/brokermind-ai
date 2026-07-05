/**
 * OnboardingWizard — 4-step first-run experience.
 * Trigger: mounts on Dashboard when user_preferences.onboarding_completed = false.
 * Steps: Firm Profile → First Applicant → First Document → First AI Action.
 * Completion writes onboarding_completed = true; never shows again unless reset
 * from Settings > Preferences.
 */
import { useEffect, useState } from "react";
import { Building2, FileUp, Sparkles, UserPlus, Check, X, ArrowRight } from "lucide-react";
import { useUserPreferencesStore } from "@/store/userPreferencesStore";
import { useBrokerSettingsStore } from "@/store/brokerSettingsStore";

type Step = 0 | 1 | 2 | 3 | 4;

const STEPS = [
  { icon: Building2, title: "Firm Profile", desc: "Brokerage details for your dossier headers." },
  { icon: UserPlus, title: "First Applicant", desc: "Create your first underwriting file." },
  { icon: FileUp, title: "First Document", desc: "Upload a NOA or T4 to see auto-parsing." },
  { icon: Sparkles, title: "First AI Action", desc: "See how confidence scoring works." },
];

const TIPS = [
  "★ Use the Pipeline tab to track every file from intake to funding.",
  "★ The Compliance Health sidebar flags issues before submission.",
  "★ Rate holds within 7 days appear in your notification bell automatically.",
  "★ Generate a PDF dossier from any file — it embeds your firm branding.",
  "★ Reset onboarding anytime from Settings → Preferences.",
];

export function OnboardingWizard() {
  const prefs = useUserPreferencesStore();
  const broker = useBrokerSettingsStore();
  const [step, setStep] = useState<Step>(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void prefs.load();
    void broker.load();
  }, [prefs.load, broker.load]);

  useEffect(() => {
    if (prefs.loaded && !prefs.onboarding_completed) setVisible(true);
  }, [prefs.loaded, prefs.onboarding_completed]);

  if (!visible) return null;

  async function finish() {
    await prefs.patch({ onboarding_completed: true });
    setVisible(false);
  }

  async function skip() {
    await prefs.patch({ onboarding_completed: true });
    setVisible(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
      <div className="relative w-full max-w-2xl rounded-sm border bg-card p-6" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
        <button onClick={() => void skip()} aria-label="Skip" className="absolute right-4 top-4 text-muted-foreground hover:text-white">
          <X className="h-4 w-4" />
        </button>

        {step < 4 ? (
          <>
            <div className="mb-6 flex items-center gap-4">
              {STEPS.map((s, i) => {
                const active = i === step;
                const done = i < step;
                return (
                  <div key={i} className="flex flex-1 items-center gap-2">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border text-[11px] font-bold ${
                        done ? "border-success bg-success/20 text-success" : active ? "border-chart-2 bg-chart-2/20 text-chart-2" : "border-border text-muted-foreground"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    {i < STEPS.length - 1 && <div className={`h-px flex-1 ${done ? "bg-success" : "bg-border"}`} />}
                  </div>
                );
              })}
            </div>

            <StepContent step={step} broker={broker} />

            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => void skip()} className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-white">
                Skip for now
              </button>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={() => setStep((step - 1) as Step)}
                    className="rounded-sm border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-muted"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => setStep((step + 1) as Step)}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-chart-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-black"
                >
                  {step === 3 ? "Finish" : "Continue"} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-sm bg-success/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-success">
              <Check className="h-3 w-3" /> Setup Complete
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">You're ready.</h2>
            <p className="mt-1 text-sm text-muted-foreground">Five tips to get the most out of BrokerMind AI:</p>
            <ul className="mt-4 space-y-2">
              {TIPS.map((t, i) => (
                <li key={i} className="rounded-sm border border-border bg-background/40 px-3 py-2 text-xs">
                  {t}
                </li>
              ))}
            </ul>
            <button
              onClick={() => void finish()}
              className="mt-5 w-full rounded-sm bg-chart-2 py-2.5 text-xs font-bold uppercase tracking-[0.18em] text-black"
            >
              Enter Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepContent({ step, broker }: { step: Step; broker: ReturnType<typeof useBrokerSettingsStore.getState> }) {
  const Icon = STEPS[step].icon;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-chart-2/15 text-chart-2">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">{STEPS[step].title}</h2>
          <p className="text-xs text-muted-foreground">{STEPS[step].desc}</p>
        </div>
      </div>
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter core firm details now — they appear on every dossier PDF header and email signature. You can refine everything later in Settings → Firm Profile.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <MiniField label="Brokerage" value={broker.brokerage_name} onChange={(v) => broker.patchLocal({ brokerage_name: v })} />
            <MiniField label="Broker Name" value={broker.broker_name} onChange={(v) => broker.patchLocal({ broker_name: v })} />
            <MiniField label="Licence #" value={broker.licence_number} onChange={(v) => broker.patchLocal({ licence_number: v })} />
            <MiniField label="Phone" value={broker.phone} onChange={(v) => broker.patchLocal({ phone: v })} />
          </div>
          <button
            onClick={() => void broker.save({})}
            className="mt-1 rounded-sm border border-border bg-card px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-wider hover:bg-muted"
          >
            Save profile
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Head to <span className="font-semibold text-chart-2">Pipeline → New Application</span> to create your first file. Guided tooltips will point out required fields as you go.
          </p>
          <div className="rounded-sm border border-chart-2/30 bg-chart-2/5 p-3 text-xs">
            <strong className="text-chart-2">Tip:</strong> Every applicant needs a taxpayer name, employment type, and property price at minimum before the workspace calculates ratios.
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Inside a file's Underwriting Workspace, drag a NOA, T4, T1 General, or bank statement into any document panel. BrokerMind runs OCR + AI parsing and fills fields automatically.
          </p>
          <div className="rounded-sm border border-chart-4/30 bg-chart-4/5 p-3 text-xs">
            <strong className="text-chart-4">Parsing time:</strong> ~5-15 seconds per document. Confidence scores appear on every extracted field.
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            When parsing finishes, review the extracted values against the <strong>confidence score</strong>:
          </p>
          <ul className="space-y-1.5 text-xs">
            <li className="rounded-sm border border-success/30 bg-success/5 px-3 py-1.5"><strong className="text-success">≥ 90%</strong> — auto-accepted, no review needed.</li>
            <li className="rounded-sm border border-warning/30 bg-warning-bg px-3 py-1.5"><strong className="text-warning-fg">70-89%</strong> — flagged for broker verification.</li>
            <li className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-1.5"><strong className="text-destructive">&lt; 70%</strong> — manual entry required.</li>
          </ul>
        </div>
      )}
    </div>
  );
}

function MiniField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-sm border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-chart-2"
      />
    </label>
  );
}
