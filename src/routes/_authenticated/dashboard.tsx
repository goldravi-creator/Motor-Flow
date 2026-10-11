import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  BotMessageSquare,
  CalendarClock,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useProduct } from "@/lib/product";
import { CLOSED_STATUSES, type Lead } from "@/lib/crm-types";
import { StatusBadge } from "@/components/crm/status-badge";
import { label, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — MotorFlow CRM" },
      { name: "description", content: "Sales pipeline overview, AI automation activity and conversions." },
      { property: "og:title", content: "Dashboard — MotorFlow CRM" },
      { property: "og:description", content: "Sales pipeline overview, AI automation activity and conversions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const PIE_COLORS = [
  "oklch(0.55 0.16 255)",
  "oklch(0.6 0.14 155)",
  "oklch(0.75 0.15 85)",
  "oklch(0.65 0.2 30)",
  "oklch(0.6 0.12 300)",
  "oklch(0.7 0.1 200)",
];

function DashboardPage() {
  const { product } = useProduct();
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", product],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("product", product)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const now = Date.now();
  const open = leads.filter((l) => !CLOSED_STATUSES.includes(l.status));
  const aiActive = leads.filter((l) => ["active", "qualifying"].includes(l.ai_status));
  const dueToday = leads.filter(
    (l) => l.next_follow_up_at && new Date(l.next_follow_up_at).getTime() < now + 86400000
  );
  const converted = leads.filter((l) =>
    ["converted", "policy_issued", "disbursed"].includes(l.status)
  );

  const statusCounts = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    }, {})
  )
    .map(([status, count]) => ({ status: label(status), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const sourceCounts = Object.entries(
    leads.reduce<Record<string, number>>((acc, l) => {
      acc[l.source] = (acc[l.source] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name: label(name), value }));

  const kpis = [
    { label: "Open leads", value: open.length, icon: Users },
    { label: "AI conversations active", value: aiActive.length, icon: BotMessageSquare },
    { label: "Follow-ups due", value: dueToday.length, icon: CalendarClock },
    { label: "Converted", value: converted.length, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {product === "insurance" ? "Car Insurance" : "Car Loan"} Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Pipeline, automation and team activity at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {isLoading ? "…" : k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold">Leads by stage</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusCounts} margin={{ left: -20 }}>
                <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="oklch(0.55 0.16 255)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold">Lead sources</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceCounts} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {sourceCounts.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sourceCounts.map((s, i) => (
              <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {s.name} ({s.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Recent leads</h2>
          <Link to="/leads" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Lead</th>
              <th className="px-4 py-2.5 font-medium">Vehicle</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 8).map((l) => (
              <tr key={l.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                <td className="px-4 py-2.5">
                  <Link to="/leads/$leadId" params={{ leadId: l.id }} className="font-medium hover:text-primary">
                    {l.full_name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{l.lead_uid} · {l.city ?? "—"}</p>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {[l.vehicle_make, l.vehicle_model].filter(Boolean).join(" ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{label(l.source)}</td>
                <td className="px-4 py-2.5">
                  <span className="font-semibold">{l.lead_score}</span>
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                <td className="px-4 py-2.5 text-muted-foreground">{timeAgo(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
