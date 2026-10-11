import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProduct } from "@/lib/product";
import type { Lead } from "@/lib/crm-types";
import { StatusBadge } from "@/components/crm/status-badge";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/follow-ups")({
  head: () => ({
    meta: [
      { title: "Follow-ups — MotorFlow CRM" },
      { name: "description", content: "Scheduled follow-ups and overdue callbacks." },
      { property: "og:title", content: "Follow-ups — MotorFlow CRM" },
      { property: "og:description", content: "Scheduled follow-ups and overdue callbacks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FollowUpsPage,
});

function FollowUpsPage() {
  const { product } = useProduct();
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["follow-ups", product],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("product", product)
        .not("next_follow_up_at", "is", null)
        .order("next_follow_up_at", { ascending: true });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const now = Date.now();
  const overdue = leads.filter((l) => new Date(l.next_follow_up_at!).getTime() < now);
  const upcoming = leads.filter((l) => new Date(l.next_follow_up_at!).getTime() >= now);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">
          {overdue.length} overdue · {upcoming.length} upcoming
        </p>
      </div>

      {isLoading ? (
        <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-muted-foreground">
          <CalendarClock className="h-8 w-8" />
          <p className="text-sm">No follow-ups scheduled.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...overdue, ...upcoming].map((l) => {
                const isOverdue = new Date(l.next_follow_up_at!).getTime() < now;
                return (
                  <tr key={l.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className={`px-4 py-3 font-medium ${isOverdue ? "text-destructive" : ""}`}>
                      {fmtDateTime(l.next_follow_up_at)}
                      {isOverdue && <span className="ml-2 text-[11px] font-semibold">OVERDUE</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link to="/leads/$leadId" params={{ leadId: l.id }} className="font-medium hover:text-primary">
                        {l.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{l.lead_uid}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{l.phone}</td>
                    <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
