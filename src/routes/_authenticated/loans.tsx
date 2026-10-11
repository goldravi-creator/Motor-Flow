import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LOAN_STATUSES, type Lead, type Profile } from "@/lib/crm-types";
import { PipelineBoard } from "@/components/crm/pipeline-board";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({
    meta: [
      { title: "Car Loan Pipeline — MotorFlow CRM" },
      { name: "description", content: "Car loan pipeline from eligibility check to disbursal." },
      { property: "og:title", content: "Car Loan Pipeline — MotorFlow CRM" },
      { property: "og:description", content: "Car loan pipeline from eligibility check to disbursal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoansPage,
});

function LoansPage() {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", "loan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("product", "loan")
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
        <h1 className="text-xl font-semibold tracking-tight">Car Loan Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          From eligibility check to disbursal. Closed leads are hidden.
        </p>
      </div>
      {isLoading ? (
        <p className="py-20 text-center text-sm text-muted-foreground">Loading pipeline…</p>
      ) : (
        <PipelineBoard leads={leads} stages={LOAN_STATUSES} agents={agents} />
      )}
    </div>
  );
}
