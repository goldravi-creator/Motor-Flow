import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Upload, ChevronLeft, ChevronRight, Filter, X, Users, Download, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { type Lead } from "@/lib/crm-types";
import { StatusBadge, PriorityBadge } from "@/components/crm/status-badge";
import { ImportLeadsDialog } from "@/components/crm/import-leads-dialog";
import { label, timeAgo, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PAGE_SIZE = 50;

const ALL_STATUSES = [
  "new", "ai_contacting", "contacted", "follow_up", "qualified",
  "quotation_required", "quotation_sent", "negotiation",
  "documents_required", "payment_pending", "converted", "policy_issued",
  "eligibility_check", "application_created", "application_submitted",
  "bank_review", "approved", "sanctioned", "disbursement_pending", "disbursed",
  "not_interested", "invalid", "duplicate", "lost"
] as const;

export const Route = createFileRoute("/admin/leads")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    source: typeof search.source === "string" ? search.source : undefined,
    page: typeof search.page === "string" ? parseInt(search.page, 10) : undefined,
    assignee: typeof search.assignee === "string" ? search.assignee : undefined,
    org: typeof search.org === "string" ? search.org : undefined,
  }),
  component: AdminLeadsPage,
});

function AdminLeadsPage() {
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(search.status ?? "all");
  const [sourceFilter, setSourceFilter] = useState(search.source ?? "all");
  const [assigneeFilter, setAssigneeFilter] = useState(search.assignee ?? "all");
  const [orgFilter, setOrgFilter] = useState(search.org ?? "all");
  const [currentPage, setCurrentPage] = useState(search.page ?? 1);
  const [localSearch, setLocalSearch] = useState(search.q ?? "");
  const [productFilter, setProductFilter] = useState<"insurance" | "loan" | "all">("all");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [bulkAssignee, setBulkAssignee] = useState<string>("");

  // Sync URL with local state
  useEffect(() => setLocalSearch(search.q ?? ""), [search.q]);
  useEffect(() => setStatusFilter(search.status ?? "all"), [search.status]);
  useEffect(() => setSourceFilter(search.source ?? "all"), [search.source]);
  useEffect(() => setAssigneeFilter(search.assignee ?? "all"), [search.assignee]);
  useEffect(() => setOrgFilter(search.org ?? "all"), [search.org]);
  useEffect(() => setCurrentPage(search.page ?? 1), [search.page]);

  // Fetch leads with server-side pagination and filters
  const { data: leadsData, isLoading, isFetching } = useQuery({
    queryKey: ["admin-leads", currentPage, statusFilter, sourceFilter, assigneeFilter, orgFilter, localSearch, productFilter],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select(`
          *,
          profiles!assigned_to(full_name),
          organization_members!leads_organization_id_fkey(
            organization_id,
            organizations(name)
          )
        `, { count: "exact" })
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

      if (productFilter !== "all") {
        query = query.eq("product", productFilter);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (sourceFilter !== "all") {
        query = query.eq("source", sourceFilter);
      }
      if (assigneeFilter !== "all") {
        query = query.eq("assigned_to", assigneeFilter);
      }
      if (orgFilter !== "all") {
        query = query.eq("organization_members.organization_id", orgFilter);
      }
      if (localSearch) {
        const q = localSearch.toLowerCase();
        query = query.or(
          `full_name.ilike.%${q}%,phone.ilike.%${q}%,lead_uid.ilike.%${q}%,vehicle_reg.ilike.%${q}%`
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { leads: data as any[], totalCount: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  const leads = leadsData?.leads ?? [];
  const totalCount = leadsData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Fetch filter options
  const { data: sources = [] } = useQuery({
    queryKey: ["admin-lead-sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("source");
      if (error) throw error;
      return [...new Set(data.map((l) => l.source))];
    },
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ["admin-lead-assignees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("assigned_to, profiles!inner(full_name)")
        .not("assigned_to", "is", null);
      if (error) throw error;
      const map = new Map<string, string>();
      (data as any[]).forEach((l) => {
        if (l.profiles?.full_name) map.set(l.assigned_to, l.profiles.full_name);
      });
      return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    },
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Status update mutation
  const updateStatus = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-leads"] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  // Bulk assign mutation
  const bulkAssign = useMutation({
    mutationFn: async ({ leadIds, assigneeId }: { leadIds: string[]; assigneeId: string }) => {
      const { error } = await supabase.from("leads").update({ assigned_to: assigneeId }).in("id", leadIds);
      if (error) throw error;
    },
    onSuccess: (_, { leadIds }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-leads"] });
      toast.success(`Assigned ${leadIds.length} leads`);
    },
    onError: () => toast.error("Failed to assign leads"),
  });

  // Export leads
  const exportLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string | number> = { page: 1 };
    if (localSearch) params.q = localSearch;
    if (statusFilter !== "all") params.status = statusFilter;
    if (sourceFilter !== "all") params.source = sourceFilter;
    if (assigneeFilter !== "all") params.assignee = assigneeFilter;
    if (orgFilter !== "all") params.org = orgFilter;
    Route.updateSearch(params, { replace: true });
  };

  const clearFilters = () => {
    setLocalSearch("");
    setStatusFilter("all");
    setSourceFilter("all");
    setAssigneeFilter("all");
    setOrgFilter("all");
    setProductFilter("all");
    const params: Record<string, string | number> = { page: 1 };
    Route.updateSearch(params, { replace: true });
  };

  const hasFilters = localSearch || statusFilter !== "all" || sourceFilter !== "all" || assigneeFilter !== "all" || orgFilter !== "all" || productFilter !== "all";

  const handleBulkAssign = () => {
    if (selectedLeads.length > 0 && bulkAssignee) {
      bulkAssign.mutate({ leadIds: selectedLeads, assigneeId: bulkAssignee });
      setSelectedLeads([]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">All Leads (Admin)</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} total leads across all organizations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLeads} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Import
          </Button>
        </div>
      </div>

      {/* Product Filter */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-muted-foreground">Product:</span>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            <SelectItem value="insurance">Insurance</SelectItem>
            <SelectItem value="loan">Car Loan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search name, phone, ID, reg, org…"
            className="h-9 pl-9 pr-3 text-sm"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{label(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{label(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="All assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="All organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All organizations</SelectItem>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="submit" variant="outline" className="h-9">
          <Filter className="h-4 w-4 mr-2" /> Apply
        </Button>
        {hasFilters && (
          <Button type="button" variant="ghost" size="icon" onClick={clearFilters}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {/* Bulk Actions Bar */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <span className="text-sm text-muted-foreground">
          Select leads to assign:
        </span>
        <Select value={bulkAssignee} onValueChange={setBulkAssignee}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select team member" />
          </SelectTrigger>
          <SelectContent>
            {assignees.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleBulkAssign} 
          disabled={selectedLeads.length === 0 || !bulkAssignee}
        >
          <Users className="h-4 w-4 mr-1" /> Assign {selectedLeads.length} leads
        </Button>
      </div>

      {/* Leads Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium w-12">
                <input
                  type="checkbox"
                  checked={selectedLeads.length === leads.length && leads.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedLeads(leads.map(l => l.id));
                    } else {
                      setSelectedLeads([]);
                    }
                  }}
                  className="rounded border-input"
                />
              </th>
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Organization</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Assignee</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Next follow-up</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  Loading leads…
                </td>
              </tr>
            )}
            {!isLoading && leads.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  No leads match these filters.
                </td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedLeads.includes(l.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLeads([...selectedLeads, l.id]);
                      } else {
                        setSelectedLeads(selectedLeads.filter(id => id !== l.id));
                      }
                    }}
                    className="rounded border-input"
                  />
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium hover:text-primary cursor-pointer">{l.full_name}</p>
                  <p className="text-xs text-muted-foreground">{l.lead_uid}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-xs">
                    {l.organization_members?.organizations?.name || "—"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={l.product === "insurance" ? "default" : "secondary"} className="text-xs">
                    {l.product === "insurance" ? "Insurance" : "Loan"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <p>{l.phone}</p>
                  <p className="text-xs text-muted-foreground">{l.city ?? "—"}</p>
                </td>
                <td className="px-4 py-3">
                  {l.profiles?.full_name ? (
                    <span className="text-sm">{l.profiles.full_name}</span>
                  ) : (
                    <Badge variant="outline" className="text-xs">Unassigned</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{label(l.source)}</td>
                <td className="px-4 py-3 font-semibold">{l.lead_score}</td>
                <td className="px-4 py-3"><PriorityBadge priority={l.priority} /></td>
                <td className="px-4 py-3">
                  <EditableStatusBadge
                    lead={l}
                    statuses={ALL_STATUSES}
                    onUpdate={updateStatus.mutate}
                    disabled={isFetching}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {l.next_follow_up_at ? fmtDateTime(l.next_follow_up_at) : timeAgo(l.last_contacted_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} · {totalCount} leads
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isFetching}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm font-medium">{currentPage}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isFetching}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ImportLeadsDialog product={productFilter === "all" ? "insurance" : productFilter} open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function EditableStatusBadge({
  lead,
  statuses,
  onUpdate,
  disabled,
}: {
  lead: any;
  statuses: readonly string[];
  onUpdate: (args: { leadId: string; status: string }) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localStatus, setLocalStatus] = useState(lead.status);

  const handleSave = () => {
    if (localStatus !== lead.status) {
      onUpdate({ leadId: lead.id, status: localStatus });
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalStatus(lead.status);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <Select value={localStatus} onValueChange={setLocalStatus}>
          <SelectTrigger className="w-[160px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>{label(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <StatusBadge status={lead.status} className="cursor-pointer" onClick={() => !disabled && setEditing(true)} />
      )}
      {editing && (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={handleSave} disabled={disabled} className="h-6 w-6">
            <Check className="h-3.5 w-3.5 text-success" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleCancel} className="h-6 w-6">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
}

function convertToCSV(data: any[]): string {
  if (!data.length) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) return "";
      if (typeof val === "object") return JSON.stringify(val);
      return String(val).includes(",") ? `"${String(val).replace(/"/g, '""')}"` : String(val);
    }).join(",")
  );
  return [headers.join(","), ...rows].join("\n");
}