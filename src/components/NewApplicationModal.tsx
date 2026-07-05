import { useState } from "react";
import { supabase } from "@/supabase/client";
import { useFirmContext } from "@/hooks/useFirmContext";
import { X } from "lucide-react";
import { toast } from "sonner";

type DealType = "Purchase" | "Refinance" | "Renewal" | "Switch";

const DEAL_TYPES: DealType[] = ["Purchase", "Refinance", "Renewal", "Switch"];

export function NewApplicationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [dealType, setDealType] = useState<DealType>("Purchase");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function submit() {
    if (!name.trim()) {
      toast.error("Applicant name is required");
      return;
    }
    setSubmitting(true);
    const appNumber = `APP-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase
      .from("underwriting_applications")
      .insert({
        application_number: appNumber,
        taxpayer_name: name.trim(),
        tax_year: new Date().getFullYear() - 1,
        property_address: address.trim() || null,
        loan_amount: Number(loanAmount) || 0,
        deal_type: dealType,
        review_status: "New",
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Application ${appNumber} created`);
    setName("");
    setAddress("");
    setLoanAmount("");
    setDealType("Purchase");
    onCreated?.(data!.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-sm border border-border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">New Application</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Applicant Name" value={name} onChange={setName} placeholder="Jane Doe" />
          <Field label="Property Address" value={address} onChange={setAddress} placeholder="123 Main St, Toronto ON" />
          <Field label="Loan Amount ($)" value={loanAmount} onChange={setLoanAmount} placeholder="500000" type="number" />
          <div>
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Deal Type
            </div>
            <div className="flex gap-1.5">
              {DEAL_TYPES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDealType(d)}
                  className={`flex-1 rounded-sm border px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${
                    dealType === d
                      ? "border-chart-2 bg-chart-2/10 text-chart-2"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-sm border border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-sm bg-chart-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-black disabled:opacity-40"
          >
            {submitting ? "Creating…" : "Create & Open"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
