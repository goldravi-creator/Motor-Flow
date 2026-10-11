import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bot, MessageSquare, PhoneCall, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProduct } from "@/lib/product";
import type { Lead } from "@/lib/crm-types";
import { fmtDateTime, label, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type WAMessage = {
  id: string;
  lead_id: string;
  direction: string;
  body: string;
  status: string;
  sender_type: string;
  created_at: string;
  leads: { full_name: string; lead_uid: string; product: string } | null;
};

type CallRecord = {
  id: string;
  lead_id: string;
  call_type: string;
  status: string;
  duration_seconds: number;
  outcome: string | null;
  summary: string | null;
  sentiment: string | null;
  created_at: string;
  leads: { full_name: string; lead_uid: string; product: string } | null;
  profiles: { full_name: string } | null;
};

const TABS = [
  { id: "whatsapp", label: "WhatsApp AI", icon: MessageSquare },
  { id: "calls", label: "AI Calling", icon: PhoneCall },
  { id: "qualification", label: "Qualification", icon: UserCheck },
] as const;

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({
    meta: [
      { title: "AI Automation — MotorFlow CRM" },
      { name: "description", content: "AI WhatsApp conversations, AI calling outcomes and lead qualification." },
      { property: "og:title", content: "AI Automation — MotorFlow CRM" },
      { property: "og:description", content: "AI WhatsApp conversations, AI calling outcomes and lead qualification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomationPage,
});

function fmtDuration(s: number) {
  if (!s) return "—";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function AutomationPage() {
  const { product } = useProduct();
  const [tab, setTab] = useState<string>("whatsapp");
  const [selectedLead, setSelectedLead] = useState<string | null>(null);

  const { data: messages = [], isLoading: msgLoading } = useQuery({
    queryKey: ["wa-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*, leads(full_name, lead_uid, product)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as WAMessage[];
    },
  });

  const { data: calls = [], isLoading: callLoading } = useQuery({
    queryKey: ["call-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("*, leads(full_name, lead_uid, product), profiles(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as CallRecord[];
    },
  });

  const { data: aiLeads = [] } = useQuery({
    queryKey: ["ai-leads", product],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("product", product)
        .neq("ai_status", "not_started")
        .order("lead_score", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const productMessages = useMemo(
    () => messages.filter((m) => m.leads?.product === product),
    [messages, product]
  );
  const productCalls = useMemo(
    () => calls.filter((c) => c.leads?.product === product),
    [calls, product]
  );

  const conversations = useMemo(() => {
    const map = new Map<string, { lead: WAMessage["leads"]; msgs: WAMessage[] }>();
    for (const m of productMessages) {
      const entry = map.get(m.lead_id) ?? { lead: m.leads, msgs: [] };
      entry.msgs.push(m);
      map.set(m.lead_id, entry);
    }
    return [...map.entries()].sort(
      (a, b) =>
        new Date(b[1].msgs.at(-1)!.created_at).getTime() -
        new Date(a[1].msgs.at(-1)!.created_at).getTime()
    );
  }, [productMessages]);

  const activeConvo = conversations.find(([id]) => id === selectedLead) ?? conversations[0];

  const handoffs = aiLeads.filter((l) => l.ai_status === "human_handoff").length;
  const avgScore = aiLeads.length
    ? Math.round(aiLeads.reduce((s, l) => s + l.lead_score, 0) / aiLeads.length)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Bot className="h-5 w-5" /> AI Automation
          </h1>
          <p className="text-sm text-muted-foreground">
            {product === "insurance" ? "Car Insurance" : "Car Loan"} · {productMessages.length} WhatsApp
            messages · {productCalls.length} calls · {handoffs} human handoffs · avg score {avgScore}
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "whatsapp" && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Conversation list */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <p className="border-b border-border px-4 py-3 text-sm font-semibold">Conversations</p>
            <div className="max-h-[520px] overflow-y-auto">
              {msgLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
              {!msgLoading && conversations.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No WhatsApp conversations yet.</p>
              )}
              {conversations.map(([leadId, convo]) => {
                const last = convo.msgs.at(-1)!;
                const active = activeConvo?.[0] === leadId;
                return (
                  <button
                    key={leadId}
                    onClick={() => setSelectedLead(leadId)}
                    className={cn(
                      "block w-full border-b border-border px-4 py-3 text-left transition-colors",
                      active ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{convo.lead?.full_name}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(last.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{last.body}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Thread */}
          <div className="flex flex-col rounded-xl border border-border bg-card lg:col-span-2">
            {activeConvo ? (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{activeConvo[1].lead?.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">{activeConvo[1].lead?.lead_uid}</p>
                  </div>
                  <Link
                    to="/leads/$leadId"
                    params={{ leadId: activeConvo[0] }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Open lead
                  </Link>
                </div>
                <div className="max-h-[460px] flex-1 space-y-2 overflow-y-auto p-4">
                  {activeConvo[1].msgs.map((m) => {
                    const inbound = m.direction === "in";
                    return (
                      <div key={m.id} className={cn("flex", inbound ? "justify-start" : "justify-end")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                            inbound
                              ? "rounded-bl-sm bg-muted"
                              : m.sender_type === "human"
                                ? "rounded-br-sm bg-primary text-primary-foreground"
                                : "rounded-br-sm bg-success/15 text-foreground"
                          )}
                        >
                          <p>{m.body}</p>
                          <p
                            className={cn(
                              "mt-1 text-[10px]",
                              inbound ? "text-muted-foreground" : "text-muted-foreground"
                            )}
                          >
                            {inbound ? "Lead" : m.sender_type === "human" ? "Advisor" : "AI"} ·{" "}
                            {fmtDateTime(m.created_at)} · {label(m.status)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="p-8 text-center text-sm text-muted-foreground">Select a conversation.</p>
            )}
          </div>
        </div>
      )}

      {tab === "calls" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">Sentiment</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {callLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!callLoading && productCalls.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No calls recorded yet.
                  </td>
                </tr>
              )}
              {productCalls.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      to="/leads/$leadId"
                      params={{ leadId: c.lead_id }}
                      className="font-medium hover:underline"
                    >
                      {c.leads?.full_name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">{c.leads?.lead_uid}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        c.call_type === "ai"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {c.call_type === "ai" ? "AI" : `Human · ${c.profiles?.full_name ?? ""}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">{label(c.status)}</td>
                  <td className="px-4 py-3 tabular-nums">{fmtDuration(c.duration_seconds)}</td>
                  <td className="px-4 py-3">{label(c.outcome)}</td>
                  <td className="max-w-64 px-4 py-3">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{c.summary}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        c.sentiment === "positive" && "bg-success/15 text-success",
                        c.sentiment === "neutral" && "bg-muted text-muted-foreground",
                        c.sentiment === "negative" && "bg-destructive/10 text-destructive"
                      )}
                    >
                      {label(c.sentiment)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "qualification" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">AI score</th>
                <th className="px-4 py-3 font-medium">AI status</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Calling</th>
                <th className="px-4 py-3 font-medium">Automation</th>
                <th className="px-4 py-3 font-medium">Last contacted</th>
              </tr>
            </thead>
            <tbody>
              {aiLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No AI-qualified leads yet.
                  </td>
                </tr>
              )}
              {aiLeads.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link to="/leads/$leadId" params={{ leadId: l.id }} className="font-medium hover:underline">
                      {l.full_name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">{l.lead_uid}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            l.lead_score >= 75 ? "bg-success" : l.lead_score >= 50 ? "bg-primary" : "bg-muted-foreground"
                          )}
                          style={{ width: `${l.lead_score}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{l.lead_score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{label(l.ai_status)}</td>
                  <td className="px-4 py-3">{label(l.whatsapp_status)}</td>
                  <td className="px-4 py-3">{label(l.call_status)}</td>
                  <td className="px-4 py-3 text-xs">{l.automation_status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {l.last_contacted_at ? timeAgo(l.last_contacted_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
