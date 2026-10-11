import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Customer } from "@/lib/crm-types";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — MotorFlow CRM" },
      { name: "description", content: "Converted customers across insurance and loans." },
      { property: "og:title", content: "Customers — MotorFlow CRM" },
      { property: "og:description", content: "Converted customers across insurance and loans." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">{customers.length} converted customers</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Since</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3 font-medium">{c.full_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
