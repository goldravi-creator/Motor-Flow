import { Link } from "@tanstack/react-router";
import type { Lead, Profile } from "@/lib/crm-types";
import { PriorityBadge } from "@/components/crm/status-badge";
import { inr, label, timeAgo } from "@/lib/format";

export function PipelineBoard({
  leads,
  stages,
  agents,
}: {
  leads: Lead[];
  stages: readonly string[];
  agents: Profile[];
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const cards = leads.filter((l) => l.status === stage);
        return (
          <div key={stage} className="w-64 shrink-0 rounded-xl border border-border bg-muted/40">
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="text-xs font-semibold">{label(stage)}</p>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {cards.length}
              </span>
            </div>
            <div className="space-y-2 p-2">
              {cards.map((l) => {
                const agent = agents.find((a) => a.id === l.assigned_to);
                return (
                  <Link
                    key={l.id}
                    to="/leads/$leadId"
                    params={{ leadId: l.id }}
                    className="block rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{l.full_name}</p>
                      <PriorityBadge priority={l.priority} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[l.vehicle_make, l.vehicle_model].filter(Boolean).join(" ") || l.lead_uid}
                    </p>
                    {l.product === "loan" && l.loan_amount != null && (
                      <p className="mt-1 text-xs font-medium">{inr(l.loan_amount)}</p>
                    )}
                    {l.product === "insurance" && l.policy_expiry && (
                      <p className="mt-1 text-xs text-muted-foreground">Expiry {l.policy_expiry}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{agent ? agent.full_name.split(" ")[0] : "Unassigned"}</span>
                      <span>{timeAgo(l.last_contacted_at ?? l.created_at)}</span>
                    </div>
                  </Link>
                );
              })}
              {cards.length === 0 && (
                <p className="px-2 py-4 text-center text-[11px] text-muted-foreground">No leads</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
