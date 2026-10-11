import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, label } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit-log")({
  head: () => ({
    meta: [
      { title: "Audit Log — MotorFlow CRM" },
      { name: "description", content: "Every sensitive action, recorded." },
      { property: "og:title", content: "Audit Log — MotorFlow CRM" },
      { property: "og:description", content: "Every sensitive action, recorded." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditLogPage,
});

type AuditRow = {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as AuditRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email");
      if (error) throw error;
      return data ?? [];
    },
  });

  const userName = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.id, p.full_name || p.email || "Unknown"]));
    return (id: string | null) => (id ? (map.get(id) ?? "Former user") : "System");
  }, [profiles]);

  const actions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.action))).sort(),
    [rows],
  );
  const entities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.entity).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (actionFilter && r.action !== actionFilter) return false;
    if (entityFilter && r.entity !== entityFilter) return false;
    if (userFilter && r.user_id !== userFilter) return false;
    if (search) {
      const hay = `${r.action} ${r.entity ?? ""} ${JSON.stringify(r.metadata ?? {})}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const denied = (error as { message?: string } | null)?.message?.includes("row-level security");

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-primary" /> Audit Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every sensitive change — roles, members, integrations, payments — recorded with who and
          when. Visible to Admins and Sales Managers only.
        </p>
      </div>

      {denied ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Your role doesn't have access to the audit log. Ask an Admin or Sales Manager.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actions or details…"
              className="h-9 w-56 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {label(a)}
                </option>
              ))}
            </select>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="">All modules</option>
              {entities.map((en) => (
                <option key={en} value={en}>
                  {label(en)}
                </option>
              ))}
            </select>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
            >
              <option value="">All users</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </option>
              ))}
            </select>
            <span className="ml-auto self-center text-xs text-muted-foreground">
              {filtered.length} of {rows.length} events
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Module</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Loading audit log…
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No events match these filters.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">{userName(r.user_id)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {label(r.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{label(r.entity)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <code className="break-all">
                        {r.metadata && Object.keys(r.metadata).length > 0
                          ? JSON.stringify(r.metadata)
                          : "—"}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
