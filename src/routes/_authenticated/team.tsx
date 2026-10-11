import { createFileRoute } from "@tanstack/react-router";
import { TeamManagement } from "@/components/crm/team-management";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Phone, TrendingUp, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

function TeamPage() {
  const { isClientAdmin, isTeamLeader, isTelecaller, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isTelecaller) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, isTelecaller, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isTelecaller) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team Management</h1>
        <p className="text-muted-foreground">
          {isClientAdmin 
            ? "Manage your team leaders and telecallers" 
            : "Manage your telecallers"
          }
        </p>
      </div>

      <TeamManagement />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Leaders</CardTitle>
            <Shield className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <TeamLeadersCount />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Telecallers</CardTitle>
            <Phone className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <TelecallersCount />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Team</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <TotalTeamCount />
          </CardContent>
        </Card>
      </div>

      {isClientAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Team Performance Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamPerformanceTable />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamLeadersCount() {
  const { data } = useQuery({
    queryKey: ["team-leaders-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("org_role", "team_leader");
      return count ?? 0;
    },
  });
  return <div className="text-3xl font-bold">{data ?? 0}</div>;
}

function TelecallersCount() {
  const { data } = useQuery({
    queryKey: ["telecallers-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("org_role", "telecaller");
      return count ?? 0;
    },
  });
  return <div className="text-3xl font-bold">{data ?? 0}</div>;
}

function TotalTeamCount() {
  const { data } = useQuery({
    queryKey: ["total-team-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });
  return <div className="text-3xl font-bold">{data ?? 0}</div>;
}

function TeamPerformanceTable() {
  const { data: members } = useQuery({
    queryKey: ["team-performance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select(`
          id,
          org_role,
          profiles!inner(full_name, email),
          leads:leads!assigned_to(id, status, lead_score)
        `)
        .in("org_role", ["team_leader", "telecaller"]);
      return data ?? [];
    },
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-muted-foreground">
            <th className="pb-3">Member</th>
            <th className="pb-3">Role</th>
            <th className="pb-3">Total Leads</th>
            <th className="pb-3">Qualified</th>
            <th className="pb-3">Converted</th>
            <th className="pb-3">Avg Score</th>
          </tr>
        </thead>
        <tbody>
          {members?.map((m: any) => {
            const leads = m.leads ?? [];
            const total = leads.length;
            const qualified = leads.filter((l: any) => ['qualified', 'quotation_required', 'quotation_sent', 'negotiation'].includes(l.status)).length;
            const converted = leads.filter((l: any) => l.status === 'converted').length;
            const avgScore = total > 0 ? Math.round(leads.reduce((a: number, l: any) => a + (l.lead_score || 0), 0) / total) : 0;
            
            return (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-3">
                  <p className="font-medium">{m.profiles?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{m.profiles?.email}</p>
                </td>
                <td className="py-3">
                  <span className={`badge ${m.org_role === 'team_leader' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {m.org_role === 'team_leader' ? 'Team Leader' : 'Telecaller'}
                  </span>
                </td>
                <td className="py-3">{total}</td>
                <td className="py-3">{qualified}</td>
                <td className="py-3">{converted}</td>
                <td className="py-3">{avgScore}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}