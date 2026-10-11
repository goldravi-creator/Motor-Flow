import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Eye, Trash2, Shield, IndianRupee, Lock, Check } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/organizations")({
  component: AdminOrganizations,
});

function AdminOrganizations() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: orgs } = useQuery({
    queryKey: ["admin-organizations", search],
    queryFn: async () => {
      let query = supabase
        .from("organizations")
        .select(`
          id,
          name,
          product_access,
          created_at,
          organization_members!inner(profile_id, profiles(full_name, email))
        `)
        .order("created_at", { ascending: false });

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data } = await query.limit(50);
      return data ?? [];
    },
  });

  const deleteOrg = useMutation({
    mutationFn: async (orgId: string) => {
      const { error } = await supabase.from("organizations").delete().eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-organizations"] }),
  });

  const updateProductAccess = useMutation({
    mutationFn: async ({ orgId, access }: { orgId: string; access: string }) => {
      const { error } = await supabase.rpc('set_org_product_access', {
        p_org_id: orgId,
        p_access: access
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      toast.success("Product access updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update product access"),
  });

  const getAccessBadge = (access: string) => {
    switch (access) {
      case 'insurance':
        return (
          <Badge variant="default" className="gap-1">
            <Shield className="h-3 w-3" /> Insurance Only
          </Badge>
        );
      case 'loan':
        return (
          <Badge variant="secondary" className="gap-1">
            <IndianRupee className="h-3 w-3" /> Car Loan Only
          </Badge>
        );
      case 'both':
        return (
          <Badge variant="outline" className="gap-1">
            <Check className="h-3 w-3" /> Both
          </Badge>
        );
      default:
        return <Badge variant="outline">{access}</Badge>;
    }
  };

  const getAccessIcon = (access: string) => {
    switch (access) {
      case 'insurance': return <Shield className="h-4 w-4" />;
      case 'loan': return <IndianRupee className="h-4 w-4" />;
      case 'both': return <Check className="h-4 w-4" />;
      default: return <Lock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Organizations</h1>
          <p className="text-muted-foreground">Manage client organizations & product access</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Organization
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Organizations</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Product Access</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs?.map((org: any) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-muted-foreground">{org.id.slice(0, 8)}...</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {org.organization_members?.[0]?.profiles ? (
                      <>
                        <p className="font-medium">{org.organization_members[0].profiles.full_name}</p>
                        <p className="text-xs text-muted-foreground">{org.organization_members[0].profiles.email}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{org.organization_members?.length ?? 0} members</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getAccessIcon(org.product_access)}
                      {getAccessBadge(org.product_access)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(org.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Select
                        value={org.product_access}
                        onValueChange={(value) => updateProductAccess.mutate({ orgId: org.id, access: value })}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue placeholder={org.product_access} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="insurance">
                            <span className="flex items-center gap-2">
                              <Shield className="h-4 w-4" /> Insurance Only
                            </span>
                          </SelectItem>
                          <SelectItem value="loan">
                            <span className="flex items-center gap-2">
                              <IndianRupee className="h-4 w-4" /> Car Loan Only
                            </span>
                          </SelectItem>
                          <SelectItem value="both">
                            <span className="flex items-center gap-2">
                              <Check className="h-4 w-4" /> Both Products
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => window.location.href = `/admin/organizations/${org.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteOrg.mutate(org.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}