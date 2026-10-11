import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Wallet, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProduct, type Product } from "@/lib/product";
import { inr, label, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  lead_id: string | null;
  amount: number;
  method: string | null;
  transaction_ref: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  leads: { full_name: string; lead_uid: string; product: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

const METHODS = ["upi", "card", "net_banking", "cash", "cheque"];

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — MotorFlow CRM" },
      { name: "description", content: "Premium and fee collections from insurance and loan customers." },
      { property: "og:title", content: "Payments — MotorFlow CRM" },
      { property: "og:description", content: "Premium and fee collections from insurance and loan customers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { product } = useProduct();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, leads(full_name, lead_uid, product)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as PaymentRow[];
    },
  });

  const visible = useMemo(() => payments.filter((p) => p.leads?.product === product), [payments, product]);
  const collected = visible.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);
  const pending = visible.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const failed = visible.filter((p) => p.status === "failed").length;

  const mark = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("payments")
        .update(status === "completed" ? { status, paid_at: new Date().toISOString() } : { status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payments"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Wallet className="h-5 w-5" /> Payments
          </h1>
          <p className="text-sm text-muted-foreground">
            {product === "insurance" ? "Car Insurance" : "Car Loan"} · {visible.length} payments
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Record payment
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Collected</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-success">{inr(collected)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-600">{inr(pending)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Failed</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">{failed}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No payments yet — record the first one.
                </td>
              </tr>
            )}
            {visible.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  {p.lead_id ? (
                    <Link to="/leads/$leadId" params={{ leadId: p.lead_id }} className="font-medium hover:underline">
                      {p.leads?.full_name}
                    </Link>
                  ) : (
                    <span className="font-medium">—</span>
                  )}
                  <p className="text-[11px] text-muted-foreground">{p.leads?.lead_uid}</p>
                </td>
                <td className="px-4 py-3 font-medium tabular-nums">{inr(p.amount)}</td>
                <td className="px-4 py-3">{p.method ? label(p.method) : "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.transaction_ref ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[p.status] ?? "bg-muted text-muted-foreground")}>
                    {label(p.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(p.paid_at ?? p.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {p.status === "pending" && (
                      <>
                        <button
                          onClick={() => mark.mutate({ id: p.id, status: "completed" })}
                          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-success hover:bg-muted"
                        >
                          Mark paid
                        </button>
                        <button
                          onClick={() => mark.mutate({ id: p.id, status: "failed" })}
                          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-destructive hover:bg-muted"
                        >
                          Failed
                        </button>
                      </>
                    )}
                    {p.status === "failed" && (
                      <button
                        onClick={() => mark.mutate({ id: p.id, status: "pending" })}
                        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <RecordPaymentDialog product={product} onClose={() => setOpen(false)} />}
    </div>
  );
}

function RecordPaymentDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]!);
  const [ref, setRef] = useState("");
  const [paid, setPaid] = useState(true);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-payment", product],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, lead_uid, full_name")
        .eq("product", product)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; lead_uid: string; full_name: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        lead_id: leadId,
        amount: Number(amount),
        method,
        transaction_ref: ref || null,
        status: paid ? "completed" : "pending",
        paid_at: paid ? new Date().toISOString() : null,
      });
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "payment",
        description: `Payment of ${inr(Number(amount))} ${paid ? "received" : "recorded as pending"} via ${label(method)}`,
        actor: "agent",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
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
          <h2 className="text-sm font-semibold">Record payment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Amount (₹)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {label(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Transaction reference</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className={input} placeholder="UPI-8821345601 (optional)" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4 rounded border-input" />
            Payment already received
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!leadId || !amount || Number(amount) <= 0 || create.isPending}
            className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? "Saving…" : "Save payment"}
          </button>
        </div>
        {create.isError && <p className="mt-2 text-xs text-destructive">Could not save payment. Try again.</p>}
      </div>
    </div>
  );
}
