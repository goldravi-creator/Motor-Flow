import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, DollarSign, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [orgs, users, leads, payments] = await Promise.all([
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount", { count: "exact", head: true }),
      ]);
      return {
        organizations: orgs.count ?? 0,
        users: users.count ?? 0,
        leads: leads.count ?? 0,
        payments: payments.count ?? 0,
      };
    },
  });

  const statsCards = [
    { title: "Organizations", value: stats?.organizations ?? 0, icon: Building2, color: "text-blue-500" },
    { title: "Total Users", value: stats?.users ?? 0, icon: Users, color: "text-green-500" },
    { title: "Total Leads", value: stats?.leads ?? 0, icon: TrendingUp, color: "text-purple-500" },
    { title: "Total Payments", value: stats?.payments ?? 0, icon: DollarSign, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentOrganizations />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecentOrganizations() {
  const { data: orgs } = useQuery({
    queryKey: ["recent-orgs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      {orgs?.map((org) => (
        <div key={org.id} className="flex items-center justify-between py-2 border-b last:border-0">
          <div>
            <p className="font-medium">{org.name}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(org.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentActivity() {
  const { data: logs } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("action, entity, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      {logs?.map((log, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
          <div>
            <p className="font-medium capitalize">{log.action.replace(/_/g, " ")}</p>
            <p className="text-xs text-muted-foreground">
              {log.entity} • {new Date(log.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}