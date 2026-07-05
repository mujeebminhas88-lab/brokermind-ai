/**
 * Communications Panel — Prompt 10
 * Template library + AI (variable-substitution) personalisation + mailto/copy + log to communications_log.
 */
import { useEffect, useMemo, useState } from "react";
import { Copy, Mail, MessageSquare, History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/supabase/client";
import { useBrokerSettingsStore } from "@/store/brokerSettingsStore";
import { useVerificationStore } from "@/store/verificationStore";
import { useConditionsStore } from "@/store/conditionsStore";
import { useApplicationStore } from "@/store/applicationStore";
import { usePropertyStore } from "@/store/propertyStore";
import { TEMPLATE_LIBRARY, renderTemplate, type TemplateKey, type TemplateContext } from "@/utils/communicationTemplates";

interface LogEntry {
  id: string;
  subject: string | null;
  body: string | null;
  created_at: string;
  channel: string;
}

export function CommunicationsPanel({
  applicantId,
  applicantName,
}: {
  applicantId?: string | null;
  applicantName?: string | null;
}) {
  const broker = useBrokerSettingsStore();
  const docs = useVerificationStore((s) => s.docs);
  const conditions = useConditionsStore((s) => s.conditions);
  const loan = useApplicationStore((s) => s.loan);
  const property = usePropertyStore();

  const [selected, setSelected] = useState<TemplateKey>("app-received");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  useEffect(() => { broker.load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const missingDocs = useMemo(
    () => docs.filter((d) => d.status !== "verified").map((d) => d.label ?? d.name),
    [docs],
  );
  const outstandingConditions = useMemo(
    () => conditions.filter((c) => c.status !== "Satisfied" && c.status !== "Waived").map((c) => c.label),
    [conditions],
  );
  );

  const context: TemplateContext = useMemo(() => {
    const addr = [property.street, property.city, property.province].filter(Boolean).join(", ");
    return {
      clientName: applicantName ?? "",
      propertyAddress: addr,
      brokerName: broker.broker_name,
      brokerageName: broker.brokerage_name,
      brokerEmail: broker.broker_email,
      brokerPhone: broker.phone,
      brokerLicence: broker.licence_number,
      signature: broker.signature,
      missingDocs,
      outstandingConditions,
      loanAmount: Math.max(0, loan.propertyPrice - loan.downPayment),
    };
  }, [applicantName, property, broker, missingDocs, outstandingConditions, loan]);

  const regenerate = (key: TemplateKey) => {
    const r = renderTemplate(key, context);
    setSubject(r.subject);
    setBody(r.body);
    setSelected(key);
  };

  useEffect(() => {
    regenerate(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, context.clientName, context.propertyAddress, broker.broker_name, broker.signature, missingDocs.join("|"), outstandingConditions.join("|")]);

  const fetchLog = async () => {
    if (!applicantId) return;
    setLoadingLog(true);
    const { data } = await supabase
      .from("communications_log")
      .select("id, subject, body, created_at, channel")
      .eq("application_id", applicantId)
      .order("created_at", { ascending: false })
      .limit(20);
    setLog((data ?? []) as LogEntry[]);
    setLoadingLog(false);
  };
  useEffect(() => { fetchLog(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [applicantId]);

  const logSend = async (channel: "clipboard" | "mailto") => {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;
    await supabase.from("communications_log").insert({
      user_id: uid,
      application_id: applicantId ?? null,
      channel,
      direction: "outbound",
      subject,
      body,
      contact: clientEmail || null,
    });
    fetchLog();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    await logSend("clipboard");
    toast.success("Copied to clipboard and logged.");
  };

  const mailto = async () => {
    const url = `mailto:${encodeURIComponent(clientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await logSend("mailto");
    window.location.href = url;
  };

  return (
    <section id="communications" className="scroll-mt-24 rounded-sm border border-border bg-card p-5">
      <header className="flex items-center gap-2 border-b border-border pb-3">
        <MessageSquare className="h-4 w-4 text-primary" />
        <div>
          <h2 className="font-display text-base font-bold tracking-tight text-foreground">Client Communications</h2>
          <p className="text-xs text-muted-foreground">Pre-built templates · Auto-personalised · Logs to file history.</p>
        </div>
      </header>

      <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
        {/* Template library */}
        <div className="rounded-sm border border-border/60 bg-muted/20 p-2">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Templates
          </div>
          <ul className="space-y-0.5">
            {TEMPLATE_LIBRARY.map((t) => (
              <li key={t.key}>
                <button
                  onClick={() => setSelected(t.key)}
                  className={`w-full rounded-sm px-2 py-1.5 text-left text-xs ${
                    selected === t.key
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="font-medium">{t.label}</div>
                  <div className={`text-[10px] ${selected === t.key ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {t.category}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Editor */}
        <div className="rounded-sm border border-border/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Personalised draft
            </div>
            <button
              onClick={() => regenerate(selected)}
              className="text-[11px] text-primary hover:underline"
            >
              ↻ Regenerate
            </button>
          </div>
          <div className="grid gap-2">
            <input
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="Client email address"
            />
            <input
              className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm font-semibold"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
            <textarea
              className="w-full rounded-sm border border-input bg-background p-2 font-mono text-xs"
              rows={14}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
              <Copy className="h-3.5 w-3.5" /> Copy to Clipboard
            </button>
            <button
              onClick={mailto}
              disabled={!clientEmail}
              className="inline-flex items-center gap-1.5 rounded-sm border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Mail className="h-3.5 w-3.5" /> Open in Email Client
            </button>
            <span className="ml-auto text-[10px] italic text-muted-foreground">
              Backend sending disabled in this phase — mailto only.
            </span>
          </div>
        </div>
      </div>

      {/* Log */}
      <div className="mt-4 rounded-sm border border-border/60">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Communication History
          </div>
          <button onClick={fetchLog} className="text-[10px] text-muted-foreground hover:text-foreground">
            {loadingLog ? "Loading..." : "Refresh"}
          </button>
        </div>
        {log.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No communications logged yet on this file.
          </div>
        ) : (
          <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto text-xs">
            {log.map((entry) => (
              <li key={entry.id} className="p-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-foreground">{entry.subject ?? "(no subject)"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("en-CA")} · {entry.channel}
                  </div>
                </div>
                <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
                  {entry.body}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
