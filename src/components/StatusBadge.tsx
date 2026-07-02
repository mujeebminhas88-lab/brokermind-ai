import type { DocStatus } from "@/store/verificationStore";
import { CheckCircle2, Clock, AlertTriangle, Upload } from "lucide-react";

const MAP: Record<DocStatus, { label: string; icon: React.ElementType; cls: string }> = {
  uploaded: {
    label: "Uploaded",
    icon: Upload,
    cls: "border-border bg-muted text-muted-foreground",
  },
  pending: {
    label: "Pending Parsing",
    icon: Clock,
    cls: "border-warning/50 bg-warning-bg text-warning-fg animate-pulse",
  },
  review: {
    label: "Review Required",
    icon: AlertTriangle,
    cls: "border-orange-400/60 bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  },
  verified: {
    label: "Verified",
    icon: CheckCircle2,
    cls: "border-emerald-500/60 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

export function StatusBadge({ status, className = "" }: { status: DocStatus; className?: string }) {
  const cfg = MAP[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cfg.cls} ${className}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}
