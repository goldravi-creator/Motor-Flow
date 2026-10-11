import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileStack, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProduct, type Product } from "@/lib/product";
import { label, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type DocRow = {
  id: string;
  lead_id: string;
  doc_type: string;
  file_name: string | null;
  status: string;
  created_at: string;
  leads: { full_name: string; lead_uid: string; product: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  uploaded: "bg-primary/10 text-primary",
  verified: "bg-success/15 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const FILTERS = ["all", "pending", "uploaded", "verified", "rejected"] as const;

const DOC_TYPES: Record<string, string[]> = {
  insurance: ["rc_copy", "previous_policy", "driving_license", "vehicle_photo", "invoice"],
  loan: ["pan_card", "aadhaar_card", "salary_slips", "bank_statement", "address_proof", "itr"],
};

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — MotorFlow CRM" },
      { name: "description", content: "KYC, vehicle and income documents collected from insurance and loan leads." },
      { property: "og:title", content: "Documents — MotorFlow CRM" },
      { property: "og:description", content: "KYC, vehicle and income documents collected from insurance and loan leads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { product } = useProduct();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [open, setOpen] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, leads(full_name, lead_uid, product)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as DocRow[];
    },
  });

  const productDocs = useMemo(() => documents.filter((d) => d.leads?.product === product), [documents, product]);
  const visible = filter === "all" ? productDocs : productDocs.filter((d) => d.status === filter);
  const pendingCount = productDocs.filter((d) => d.status === "pending" || d.status === "uploaded").length;

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("documents").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <FileStack className="h-5 w-5" /> Documents
          </h1>
          <p className="text-sm text-muted-foreground">
            {product === "insurance" ? "Car Insurance" : "Car Loan"} · {productDocs.length} documents · {pendingCount} awaiting verification
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add document
        </button>
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "all" ? "All" : label(f)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Document</th>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Added</th>
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
            {!isLoading && visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No documents here yet.
                </td>
              </tr>
            )}
            {visible.map((d) => (
              <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link to="/leads/$leadId" params={{ leadId: d.lead_id }} className="font-medium hover:underline">
                    {d.leads?.full_name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">{d.leads?.lead_uid}</p>
                </td>
                <td className="px-4 py-3">{label(d.doc_type)}</td>
                <td className="max-w-52 truncate px-4 py-3 text-xs text-muted-foreground">{d.file_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLES[d.status] ?? "bg-muted text-muted-foreground")}>
                    {label(d.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(d.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {(d.status === "pending" || d.status === "uploaded") && (
                      <>
                        <button
                          onClick={() => setStatus.mutate({ id: d.id, status: "verified" })}
                          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-success hover:bg-muted"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => setStatus.mutate({ id: d.id, status: "rejected" })}
                          className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-destructive hover:bg-muted"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {d.status === "rejected" && (
                      <button
                        onClick={() => setStatus.mutate({ id: d.id, status: "pending" })}
                        className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                      >
                        Reset to pending
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && <AddDocumentDialog product={product} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AddDocumentDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[product]![0]!);
  const [fileName, setFileName] = useState("");

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-document", product],
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
      const { error } = await supabase.from("documents").insert({
        lead_id: leadId,
        doc_type: docType,
        file_name: fileName || null,
        status: "uploaded",
      });
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "document",
        description: `${label(docType)} uploaded for verification`,
        actor: "agent",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
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
          <h2 className="text-sm font-semibold">Add document</h2>
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
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={input}>
              {DOC_TYPES[product]!.map((t) => (
                <option key={t} value={t}>
                  {label(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">File name</label>
            <input value={fileName} onChange={(e) => setFileName(e.target.value)} className={input} placeholder="PAN_AaravMehta.pdf" />
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
            {create.isPending ? "Adding…" : "Add document"}
          </button>
        </div>
        {create.isError && <p className="mt-2 text-xs text-destructive">Could not add document. Try again.</p>}
      </div>
    </div>
  );
}
