import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardList, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/lib/crm-types";
import { inr, label, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Application = {
  id: string;
  lead_id: string;
  lender: string | null;
  loan_amount: number | null;
  status: string;
  created_at: string;
  leads: { full_name: string; lead_uid: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/10 text-primary",
  under_review: "bg-amber-500/15 text-amber-600",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const NEXT_STATUS: Record<string, string> = {
  draft: "submitted",
  submitted: "under_review",
  under_review: "approved",
};

export const Route = createFileRoute("/_authenticated/applications")({
  head: () => ({
    meta: [
      { title: "Loan Applications — MotorFlow CRM" },
      { name: "description", content: "Car loan applications submitted to lenders and their approval status." },
      { property: "og:title", content: "Loan Applications — MotorFlow CRM" },
      { property: "og:description", content: "Car loan applications submitted to lenders and their approval status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, leads(full_name, lead_uid)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Application[];
    },
  });

  const { data: loanLeads = [] } = useQuery({
    queryKey: ["leads-for-application"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, lead_uid, full_name, loan_amount")
        .eq("product", "loan")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Pick<Lead, "id" | "lead_uid" | "full_name" | "loan_amount">[];
    },
  });

  const advance = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("applications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <ClipboardList className="h-5 w-5" /> Loan Applications
          </h1>
          <p className="text-sm text-muted-foreground">{applications.length} applications across lenders</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New application
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Lender</th>
              <th className="px-4 py-3 font-medium">Loan amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && applications.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No applications yet — create the first one.
                </td>
              </tr>
            )}
            {applications.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link to="/leads/$leadId" params={{ leadId: a.lead_id }} className="font-medium hover:underline">
                    {a.leads?.full_name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">{a.leads?.lead_uid}</p>
                </td>
                <td className="px-4 py-3">{a.lender ?? "—"}</td>
                <td className="px-4 py-3 font-medium tabular-nums">{a.loan_amount ? inr(a.loan_amount) : "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[a.status] ?? "bg-muted text-muted-foreground")}>
                    {label(a.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(a.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {NEXT_STATUS[a.status] && (
                      <button
                        onClick={() => advance.mutate({ id: a.id, status: NEXT_STATUS[a.status]! })}
                        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                      >
                        Move to {label(NEXT_STATUS[a.status]!)}
                      </button>
                    )}
                    {(a.status === "submitted" || a.status === "under_review") && (
                      <button
                        onClick={() => advance.mutate({ id: a.id, status: "rejected" })}
                        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-destructive hover:bg-muted"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <NewApplicationDialog leads={loanLeads} onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewApplicationDialog({
  leads,
  onClose,
}: {
  leads: Pick<Lead, "id" | "lead_uid" | "full_name" | "loan_amount">[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState("");
  const [lender, setLender] = useState("");
  const [amount, setAmount] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("applications").insert({
        lead_id: leadId,
        lender: lender || null,
        loan_amount: amount ? Number(amount) : null,
        status: "draft",
      });
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "application",
        description: `Loan application created${lender ? ` with ${lender}` : ""}`,
        actor: "agent",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      onClose();
    },
  });

  const input =
    "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">New loan application</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lead</label>
            <select
              value={leadId}
              onChange={(e) => {
                setLeadId(e.target.value);
                const l = leads.find((x) => x.id === e.target.value);
                if (l?.loan_amount) setAmount(String(l.loan_amount));
              }}
              className={input}
            >
              <option value="">Select loan lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name} ({l.lead_uid})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lender</label>
            <input value={lender} onChange={(e) => setLender(e.target.value)} className={input} placeholder="HDFC Bank" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Loan amount (₹)</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!leadId || create.isPending}
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create draft"}
          </button>
        </div>
        {create.isError && <p className="mt-2 text-xs text-destructive">Could not create application. Try again.</p>}
      </div>
    </div>
  );
}
