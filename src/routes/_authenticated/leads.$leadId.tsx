import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Phone, MessageSquare, StickyNote, Send, FileText, Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Lead, LeadActivity, Note, Profile } from "@/lib/crm-types";
import { StatusBadge, PriorityBadge } from "@/components/crm/status-badge";
import { LeadFormDialog } from "@/components/crm/lead-form-dialog";
import { fmtDate, fmtDateTime, inr, label, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/leads/$leadId")({
  head: () => ({
    meta: [
      { title: "Lead detail — MotorFlow CRM" },
      { name: "description", content: "Full lead profile, vehicle and policy details, communication history and notes." },
      { property: "og:title", content: "Lead detail — MotorFlow CRM" },
      { property: "og:description", content: "Full lead profile, vehicle and policy details, communication history and notes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadDetailPage,
});

function Field({ label: l, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{l}</p>
      <p className="mt-0.5 text-sm">{value ?? "—"}</p>
    </div>
  );
}

function LeadDetailPage() {
  const { leadId } = useParams({ from: "/_authenticated/leads/$leadId" });
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).single();
      if (error) throw error;
      return data as Lead;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["lead-activities", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      return (data ?? []) as LeadActivity[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["lead-notes", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notes")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Note[];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("active", true);
      return (data ?? []) as Profile[];
    },
  });

  const { data: quotations = [] } = useQuery({
    queryKey: ["lead-quotations", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("quotations")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      return (data ?? []) as {
        id: string;
        provider: string | null;
        coverage: string | null;
        premium: number | null;
        loan_amount: number | null;
        interest_rate: number | null;
        tenure_months: number | null;
        emi: number | null;
        status: string;
        created_at: string;
      }[];
    },
  });

  const createQuote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("quotations").insert({
        lead_id: leadId,
        product: lead!.product,
        status: "draft",
        created_by: lead!.assigned_to,
      });
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: leadId,
        activity_type: "quotation",
        description: "Draft quotation created",
        actor: "agent",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-quotations", leadId] });
      queryClient.invalidateQueries({ queryKey: ["lead-activities", leadId] });
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
    },
  });

  const addNote = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("notes").insert({ lead_id: leadId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["lead-notes", leadId] });
    },
  });

  if (isLoading || !lead) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Loading lead…</p>;
  }

  const assignee = agents.find((a) => a.id === lead.assigned_to);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/leads" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Leads
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{lead.full_name}</h1>
            <StatusBadge status={lead.status} />
            <PriorityBadge priority={lead.priority} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {lead.lead_uid} · {lead.product === "insurance" ? "Car Insurance" : "Car Loan"} · {label(lead.source)}
            {lead.campaign ? ` · ${lead.campaign}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-semibold">{lead.lead_score}</p>
            <p className="text-[11px] text-muted-foreground">AI score</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Phone className="h-4 w-4" /> Call
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-success px-3 py-2 text-sm font-medium text-success-foreground hover:bg-success/90">
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Contact & assignment</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Phone" value={lead.phone} />
              <Field label="Email" value={lead.email} />
              <Field label="City" value={[lead.city, lead.state].filter(Boolean).join(", ")} />
              <Field label="Assigned to" value={assignee?.full_name ?? "Unassigned"} />
              <Field label="WhatsApp consent" value={lead.whatsapp_consent ? "Given" : "Not given"} />
              <Field label="Call consent" value={lead.call_consent ? "Given" : "Not given"} />
              <Field label="Last contacted" value={fmtDateTime(lead.last_contacted_at)} />
              <Field label="Next follow-up" value={fmtDateTime(lead.next_follow_up_at)} />
              <Field label="Created" value={fmtDate(lead.created_at)} />
            </div>
          </section>

          {lead.product === "insurance" ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Vehicle & policy</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="Vehicle" value={[lead.vehicle_make, lead.vehicle_model, lead.vehicle_variant].filter(Boolean).join(" ")} />
                <Field label="Registration" value={lead.vehicle_reg} />
                <Field label="Year" value={lead.vehicle_year} />
                <Field label="Fuel" value={lead.fuel_type} />
                <Field label="Current insurer" value={lead.current_insurer} />
                <Field label="Policy expiry" value={fmtDate(lead.policy_expiry)} />
                <Field label="Coverage sought" value={lead.coverage_type} />
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Vehicle & loan</h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="Vehicle" value={[lead.vehicle_make, lead.vehicle_model, lead.vehicle_variant].filter(Boolean).join(" ")} />
                <Field label="Year" value={lead.vehicle_year} />
                <Field label="Fuel" value={lead.fuel_type} />
                <Field label="Employment" value={lead.employment_type} />
                <Field label="Monthly income" value={lead.monthly_income ? inr(lead.monthly_income) : null} />
                <Field label="Loan amount" value={lead.loan_amount ? inr(lead.loan_amount) : null} />
                <Field label="Down payment" value={lead.down_payment ? inr(lead.down_payment) : null} />
                <Field label="Tenure" value={lead.tenure_months ? `${lead.tenure_months} months` : null} />
              </div>
            </section>
          )}

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <FileText className="h-4 w-4" /> Quotations
              </h2>
              <button
                onClick={() => createQuote.mutate()}
                disabled={createQuote.isPending}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> New draft
              </button>
            </div>
            <div className="space-y-2">
              {quotations.length === 0 && (
                <p className="text-sm text-muted-foreground">No quotations yet.</p>
              )}
              {quotations.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">
                      {q.provider ?? "Draft"}
                      {q.coverage ? ` · ${q.coverage}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {lead.product === "insurance"
                        ? q.premium
                          ? `${inr(q.premium)}/yr`
                          : "Premium TBD"
                        : q.loan_amount
                          ? `${inr(q.loan_amount)} @ ${q.interest_rate ?? "—"}%${q.emi ? ` · EMI ${inr(q.emi)}` : ""}`
                          : "Terms TBD"}{" "}
                      · {timeAgo(q.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {label(q.status)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <StickyNote className="h-4 w-4" /> Notes
            </h2>
            <div className="mb-4 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
                className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => note.trim() && addNote.mutate(note.trim())}
                disabled={addNote.isPending || !note.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <div className="space-y-3">
              {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-sm">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Automation</h2>
            <div className="space-y-3">
              <Field label="Automation status" value={lead.automation_status} />
              <Field label="AI status" value={label(lead.ai_status)} />
              <Field label="WhatsApp" value={label(lead.whatsapp_status)} />
              <Field label="Calling" value={label(lead.call_status)} />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Activity timeline</h2>
            <div className="space-y-4">
              {activities.length === 0 && (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              )}
              {activities.map((a) => (
                <div key={a.id} className="relative border-l border-border pl-4">
                  <span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-primary" />
                  <p className="text-sm">{a.description}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {label(a.activity_type)} · {a.actor} · {timeAgo(a.created_at)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <LeadFormDialog product={lead.product} lead={lead} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
