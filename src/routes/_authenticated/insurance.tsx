import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { INSURANCE_STATUSES, type Lead, type Profile } from "@/lib/crm-types";
import { PipelineBoard } from "@/components/crm/pipeline-board";

export const Route = createFileRoute("/_authenticated/insurance")({
  head: () => ({
    meta: [
      { title: "Insurance Pipeline — MotorFlow CRM" },
      { name: "description", content: "Car insurance pipeline from new lead to policy issued." },
      { property: "og:title", content: "Insurance Pipeline — MotorFlow CRM" },
      { property: "og:description", content: "Car insurance pipeline from new lead to policy issued." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsurancePage,
});

function InsurancePage() {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", "insurance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("product", "insurance")
        .order("lead_score", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("active", true);
      return (data ?? []) as Profile[];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Insurance Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          From first contact to policy issued. Closed leads are hidden.
        </p>
      </div>
      {isLoading ? (
        <p className="py-20 text-center text-sm text-muted-foreground">Loading pipeline…</p>
      ) : (
        <PipelineBoard leads={leads} stages={INSURANCE_STATUSES} agents={agents} />
      )}
    </div>
  );
}
