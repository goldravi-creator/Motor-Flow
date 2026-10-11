import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  TrendingUp,
  IndianRupee,
  Target,
  Gauge,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useProduct } from "@/lib/product";
import {
  INSURANCE_STATUSES,
  LOAN_STATUSES,
  CLOSED_STATUSES,
  type Lead,
  type Profile,
} from "@/lib/crm-types";
import { inr, compactInr, label, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — MotorFlow CRM" },
      { name: "description", content: "Conversion funnel, revenue, source, campaign and agent performance reports." },
      { property: "og:title", content: "Reports & Analytics — MotorFlow CRM" },
      { property: "og:description", content: "Conversion funnel, revenue, source, campaign and agent performance reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

interface PaymentRow {
  id: string;
  lead_id: string | null;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  leads: { product: string } | null;
}

interface CampaignRow {
  id: string;
  name: string;
  product: string;
  source: string;
  status: string;
  spend: number;
}

const CONVERTED = ["converted", "policy_issued", "disbursed"];

function ReportsPage() {
  const { product } = useProduct();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", product],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("product", product);
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", product],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, lead_id, amount, status, paid_at, created_at, leads!inner(product)")
        .eq("leads.product", product);
      if (error) throw error;
      return data as unknown as PaymentRow[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns", product],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("product", product);
      if (error) throw error;
      return data as CampaignRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("active", true);
      if (error) throw error;
      return data as Profile[];
    },
  });

  // ---- KPIs ----
  const converted = leads.filter((l) => CONVERTED.includes(l.status));
  const lost = leads.filter((l) => CLOSED_STATUSES.includes(l.status));
  const decided = converted.length + lost.length;
  const convRate = decided > 0 ? Math.round((converted.length / decided) * 100) : 0;
  const collected = payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + Number(p.amount), 0);
  const pendingValue = payments
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + Number(p.amount), 0);
  const avgScore = leads.length
    ? Math.round(leads.reduce((s, l) => s + l.lead_score, 0) / leads.length)
    : 0;

  const kpis = [
    { label: "Total leads", value: String(leads.length), icon: Users },
    { label: "Conversion rate", value: `${convRate}%`, icon: TrendingUp },
    { label: "Revenue collected", value: compactInr(collected), icon: IndianRupee },
    { label: "Pending collections", value: compactInr(pendingValue), icon: Target },
    { label: "Avg lead score", value: String(avgScore), icon: Gauge },
  ];

  // ---- Funnel (cumulative reach by pipeline order) ----
  const order = product === "insurance" ? INSURANCE_STATUSES : LOAN_STATUSES;
  const stageKeys =
    product === "insurance"
      ? ["new", "contacted", "qualified", "quotation_sent", "negotiation", "converted", "policy_issued"]
      : ["new", "contacted", "qualified", "application_submitted", "bank_review", "approved", "disbursed"];
  const stageIndex = (status: string) => {
    const i = (order as readonly string[]).indexOf(status);
    return i === -1 ? 0 : i; // closed/lost leads count as "new" only
  };
  const funnel = stageKeys.map((key) => {
    const idx = (order as readonly string[]).indexOf(key);
    const count = leads.filter((l) => stageIndex(l.status) >= idx).length;
    return {
      stage: label(key),
      count,
      pct: leads.length ? Math.round((count / leads.length) * 100) : 0,
    };
  });

  // ---- Revenue by day (completed payments) ----
  const revenueByDay = Object.entries(
    payments
      .filter((p) => p.status === "completed")
      .reduce<Record<string, number>>((acc, p) => {
        const day = fmtDate(p.paid_at ?? p.created_at);
        acc[day] = (acc[day] ?? 0) + Number(p.amount);
        return acc;
      }, {})
  ).map(([day, total]) => ({ day, total }));

  // ---- Source performance ----
  const revenueByLead = payments
    .filter((p) => p.status === "completed" && p.lead_id)
    .reduce<Record<string, number>>((acc, p) => {
      acc[p.lead_id!] = (acc[p.lead_id!] ?? 0) + Number(p.amount);
      return acc;
    }, {});
  const sources = Object.entries(
    leads.reduce<Record<string, Lead[]>>((acc, l) => {
      (acc[l.source] ??= []).push(l);
      return acc;
    }, {})
  )
    .map(([source, rows]) => {
      const conv = rows.filter((l) => CONVERTED.includes(l.status)).length;
      const rev = rows.reduce((s, l) => s + (revenueByLead[l.id] ?? 0), 0);
      return {
        source: label(source),
        leads: rows.length,
        converted: conv,
        rate: rows.length ? Math.round((conv / rows.length) * 100) : 0,
        revenue: rev,
      };
    })
    .sort((a, b) => b.leads - a.leads);

  // ---- Campaign performance ----
  const campaignRows = campaigns
    .map((c) => {
      const rows = leads.filter((l) => l.campaign === c.name || l.campaign === c.source);
      const conv = rows.filter((l) => CONVERTED.includes(l.status)).length;
      const rev = rows.reduce((s, l) => s + (revenueByLead[l.id] ?? 0), 0);
      return {
        name: c.name,
        source: label(c.source),
        status: c.status,
        spend: Number(c.spend),
        leads: rows.length,
        cpl: rows.length ? Math.round(Number(c.spend) / rows.length) : null,
        converted: conv,
        revenue: rev,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // ---- Agent performance ----
  const agents = profiles
    .map((p) => {
      const rows = leads.filter((l) => l.assigned_to === p.id);
      const conv = rows.filter((l) => CONVERTED.includes(l.status)).length;
      const rev = rows.reduce((s, l) => s + (revenueByLead[l.id] ?? 0), 0);
      return {
        id: p.id,
        name: p.full_name,
        title: p.title ?? "—",
        leads: rows.length,
        converted: conv,
        rate: rows.length ? Math.round((conv / rows.length) * 100) : 0,
        revenue: rev,
      };
    })
    .filter((a) => a.leads > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {product === "insurance" ? "Car Insurance" : "Car Loan"} Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Funnel, revenue, source, campaign and agent performance.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold">Conversion funnel</h2>
          <div className="space-y-3">
            {funnel.map((f) => (
              <div key={f.stage}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{f.stage}</span>
                  <span className="text-muted-foreground">
                    {f.count} leads · {f.pct}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(f.pct, f.count > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue trend */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-4 text-sm font-semibold">Revenue collected by day</h2>
          {revenueByDay.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No completed payments yet.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByDay} margin={{ left: -10 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => compactInr(Number(v))} />
                  <Tooltip formatter={(v) => inr(Number(v))} />
                  <Bar dataKey="total" fill="oklch(0.6 0.14 155)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Source performance */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Source performance</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Leads</th>
              <th className="px-4 py-2.5 font-medium">Converted</th>
              <th className="px-4 py-2.5 font-medium">Conv. rate</th>
              <th className="px-4 py-2.5 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5 font-medium">{s.source}</td>
                <td className="px-4 py-2.5">{s.leads}</td>
                <td className="px-4 py-2.5">{s.converted}</td>
                <td className="px-4 py-2.5">{s.rate}%</td>
                <td className="px-4 py-2.5 font-medium">{inr(s.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Campaign performance */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Campaign performance</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Campaign</th>
                <th className="px-4 py-2.5 font-medium">Spend</th>
                <th className="px-4 py-2.5 font-medium">Leads</th>
                <th className="px-4 py-2.5 font-medium">CPL</th>
                <th className="px-4 py-2.5 font-medium">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.map((c) => (
                <tr key={c.name} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.source} · {label(c.status)}</p>
                  </td>
                  <td className="px-4 py-2.5">{inr(c.spend)}</td>
                  <td className="px-4 py-2.5">{c.leads}</td>
                  <td className="px-4 py-2.5">{c.cpl != null ? inr(c.cpl) : "—"}</td>
                  <td className="px-4 py-2.5">{c.converted}</td>
                </tr>
              ))}
              {campaignRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No campaigns for this business yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Agent performance */}
        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Agent performance</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Agent</th>
                <th className="px-4 py-2.5 font-medium">Leads</th>
                <th className="px-4 py-2.5 font-medium">Converted</th>
                <th className="px-4 py-2.5 font-medium">Rate</th>
                <th className="px-4 py-2.5 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.title}</p>
                  </td>
                  <td className="px-4 py-2.5">{a.leads}</td>
                  <td className="px-4 py-2.5">{a.converted}</td>
                  <td className="px-4 py-2.5">{a.rate}%</td>
                  <td className="px-4 py-2.5 font-medium">{inr(a.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Looking for a specific lead? Open the <Link to="/leads" className="text-primary hover:underline">leads list</Link>.
      </p>
    </div>
  );
}
