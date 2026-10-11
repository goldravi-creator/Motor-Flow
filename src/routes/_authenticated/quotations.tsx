import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProduct } from "@/lib/product";
import type { Lead } from "@/lib/crm-types";
import { fmtDate, inr, label, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Quotation = {
  id: string;
  lead_id: string;
  product: string;
  provider: string | null;
  coverage: string | null;
  premium: number | null;
  idv: number | null;
  loan_amount: number | null;
  interest_rate: number | null;
  tenure_months: number | null;
  emi: number | null;
  status: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  leads: { full_name: string; lead_uid: string; product: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  accepted: "bg-success/15 text-success",
  expired: "bg-destructive/10 text-destructive",
};

function calcEmi(p: number, annualRate: number, months: number) {
  const r = annualRate / 1200;
  if (!p || !r || !months) return 0;
  const f = Math.pow(1 + r, months);
  return Math.round((p * r * f) / (f - 1));
}

export const Route = createFileRoute("/_authenticated/quotations")({
  head: () => ({
    meta: [
      { title: "Quotations — MotorFlow CRM" },
      { name: "description", content: "Insurance premium quotes and car loan offers generated for leads." },
      { property: "og:title", content: "Quotations — MotorFlow CRM" },
      { property: "og:description", content: "Insurance premium quotes and car loan offers generated for leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuotationsPage,
});

function QuotationsPage() {
  const { product } = useProduct();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("*, leads(full_name, lead_uid, product)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Quotation[];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-quote", product],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, lead_uid, full_name, product, status")
        .eq("product", product)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Pick<Lead, "id" | "lead_uid" | "full_name" | "product" | "status">[];
    },
  });

  const rows = useMemo(() => quotations.filter((q) => q.product === product), [quotations, product]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotations"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <FileText className="h-5 w-5" /> Quotations
          </h1>
          <p className="text-sm text-muted-foreground">
            {product === "insurance" ? "Car Insurance" : "Car Loan"} · {rows.length} quotations
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New quotation
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">{product === "insurance" ? "Insurer" : "Lender"}</th>
              {product === "insurance" ? (
                <>
                  <th className="px-4 py-3 font-medium">Coverage</th>
                  <th className="px-4 py-3 font-medium">Premium</th>
                  <th className="px-4 py-3 font-medium">IDV</th>
                </>
              ) : (
                <>
                  <th className="px-4 py-3 font-medium">Loan amount</th>
                  <th className="px-4 py-3 font-medium">Rate</th>
                  <th className="px-4 py-3 font-medium">EMI</th>
                </>
              )}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Valid until</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  No quotations yet — create the first one.
                </td>
              </tr>
            )}
            {rows.map((q) => (
              <tr key={q.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link to="/leads/$leadId" params={{ leadId: q.lead_id }} className="font-medium hover:underline">
                    {q.leads?.full_name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">{q.leads?.lead_uid}</p>
                </td>
                <td className="px-4 py-3">{q.provider ?? "—"}</td>
                {product === "insurance" ? (
                  <>
                    <td className="px-4 py-3">{q.coverage ?? "—"}</td>
                    <td className="px-4 py-3 font-medium tabular-nums">{q.premium ? inr(q.premium) : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{q.idv ? inr(q.idv) : "—"}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium tabular-nums">{q.loan_amount ? inr(q.loan_amount) : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{q.interest_rate ? `${q.interest_rate}%` : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {q.emi ? `${inr(q.emi)} × ${q.tenure_months}m` : "—"}
                    </td>
                  </>
                )}
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[q.status] ?? "bg-muted text-muted-foreground")}>
                    {label(q.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{q.valid_until ? fmtDate(q.valid_until) : "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(q.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {q.status === "draft" && (
                      <button
                        onClick={() => setStatus.mutate({ id: q.id, status: "sent" })}
                        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                      >
                        Mark sent
                      </button>
                    )}
                    {q.status === "sent" && (
                      <button
                        onClick={() => setStatus.mutate({ id: q.id, status: "accepted" })}
                        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-success hover:bg-muted"
                      >
                        Mark accepted
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <NewQuotationDialog product={product} leads={leads} onClose={() => setOpen(false)} />}
    </div>
  );
}

function NewQuotationDialog({
  product,
  leads,
  onClose,
}: {
  product: string;
  leads: Pick<Lead, "id" | "lead_uid" | "full_name" | "status">[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState("");
  const [provider, setProvider] = useState("");
  const [coverage, setCoverage] = useState("");
  const [premium, setPremium] = useState("");
  const [idv, setIdv] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [rate, setRate] = useState("");
  const [tenure, setTenure] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const emi = calcEmi(Number(loanAmount), Number(rate), Number(tenure));

  const create = useMutation({
    mutationFn: async () => {
      const isIns = product === "insurance";
      const payload = {
        lead_id: leadId,
        product: product as "insurance" | "loan",
        provider: provider || null,
        valid_until: validUntil || null,
        notes: notes || null,
        status: "draft",
        coverage: isIns ? coverage || null : null,
        premium: isIns && premium ? Number(premium) : null,
        idv: isIns && idv ? Number(idv) : null,
        loan_amount: !isIns && loanAmount ? Number(loanAmount) : null,
        interest_rate: !isIns && rate ? Number(rate) : null,
        tenure_months: !isIns && tenure ? Number(tenure) : null,
        emi: !isIns && emi ? emi : null,
      };
      const { error } = await supabase.from("quotations").insert(payload);
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "quotation",
        description: `Draft quotation created (${provider || "provider TBD"})`,
        actor: "agent",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      onClose();
    },
  });

  const input =
    "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            New {product === "insurance" ? "insurance" : "loan"} quotation
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lead</label>
            <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={input}>
              <option value="">Select lead…</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name} ({l.lead_uid})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {product === "insurance" ? "Insurer" : "Lender"}
            </label>
            <input value={provider} onChange={(e) => setProvider(e.target.value)} className={input} placeholder={product === "insurance" ? "HDFC Ergo" : "HDFC Bank"} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Valid until</label>
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={input} />
          </div>
          {product === "insurance" ? (
            <>
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Coverage</label>
                <input value={coverage} onChange={(e) => setCoverage(e.target.value)} className={input} placeholder="Comprehensive + Zero Dep" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Premium (₹/yr)</label>
                <input type="number" value={premium} onChange={(e) => setPremium(e.target.value)} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">IDV (₹)</label>
                <input type="number" value={idv} onChange={(e) => setIdv(e.target.value)} className={input} />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Loan amount (₹)</label>
                <input type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Interest rate (%)</label>
                <input type="number" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tenure (months)</label>
                <input type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">EMI (auto)</label>
                <p className="flex h-9 items-center rounded-lg bg-muted px-3 text-sm font-semibold tabular-nums">
                  {emi ? inr(emi) : "—"}
                </p>
              </div>
            </>
          )}
          <div className="col-span-2">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} placeholder="Optional" />
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
        {create.isError && <p className="mt-2 text-xs text-destructive">Could not create quotation. Try again.</p>}
      </div>
    </div>
  );
}
