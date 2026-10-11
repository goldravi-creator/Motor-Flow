import { cn } from "@/lib/utils";
import { label } from "@/lib/format";

const TONE: Record<string, string> = {
  // positive
  converted: "bg-success/10 text-success",
  policy_issued: "bg-success/10 text-success",
  disbursed: "bg-success/10 text-success",
  sanctioned: "bg-success/10 text-success",
  approved: "bg-success/10 text-success",
  // in progress
  new: "bg-primary/10 text-primary",
  ai_contacting: "bg-primary/10 text-primary",
  contacted: "bg-primary/10 text-primary",
  qualified: "bg-primary/10 text-primary",
  follow_up: "bg-chart-4/15 text-chart-4",
  quotation_required: "bg-chart-4/15 text-chart-4",
  quotation_sent: "bg-chart-4/15 text-chart-4",
  negotiation: "bg-chart-4/15 text-chart-4",
  documents_required: "bg-chart-4/15 text-chart-4",
  payment_pending: "bg-chart-4/15 text-chart-4",
  eligibility_check: "bg-chart-4/15 text-chart-4",
  application_created: "bg-chart-4/15 text-chart-4",
  application_submitted: "bg-chart-4/15 text-chart-4",
  bank_review: "bg-chart-4/15 text-chart-4",
  disbursement_pending: "bg-chart-4/15 text-chart-4",
  // closed / negative
  lost: "bg-destructive/10 text-destructive",
  not_interested: "bg-destructive/10 text-destructive",
  invalid: "bg-destructive/10 text-destructive",
  duplicate: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        TONE[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {label(status)}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone =
    priority === "high"
      ? "bg-destructive/10 text-destructive"
      : priority === "medium"
        ? "bg-chart-4/15 text-chart-4"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", tone)}>
      {label(priority)}
    </span>
  );
}
