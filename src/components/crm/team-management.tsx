"use client";

import { useState } from "react";
import { Plus, Users, UserPlus, Loader2, ChevronDown, Trash2, Edit, Shield, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

type MemberRole = 'team_leader' | 'telecaller';

interface TeamMember {
  id: string;
  profile_id: string;
  full_name: string;
  email: string | null;
  org_role: MemberRole | 'client_admin';
  manager_id: string | null;
  manager_name: string | null;
  created_at: string;
  is_current_user: boolean;
}

interface MemberWithProfile {
  id: string;
  organization_id: string;
  profile_id: string;
  org_role: string;
  manager_id: string | null;
  created_at: string;
  profiles: {
    id: string;
    full_name: string;
    email: string | null;
  } | null;
  manager: {
    profiles: {
      full_name: string;
    } | null;
  } | null;
}

export function TeamManagement() {
  const { isClientAdmin, isTeamLeader, orgMemberId, organizationId, userId } = useAuth();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>('telecaller');
  const [newMemberManager, setNewMemberManager] = useState<string>("");
  const [adding, setAdding] = useState(false);

  // Determine what roles current user can create
  const allowedRoles: MemberRole[] = isClientAdmin ? ['team_leader', 'telecaller'] : ['telecaller'];
  const defaultRole: MemberRole = isClientAdmin ? 'team_leader' : 'telecaller';

  // Fetch team members
  const { data: members, isLoading } = useQuery({
    queryKey: ["team-members", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          id,
          organization_id,
          profile_id,
          org_role,
          manager_id,
          created_at,
          profiles!inner(full_name, email),
          manager:manager_id(
            profiles(full_name)
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown as MemberWithProfile[]).map(m => ({
        id: m.id,
        profile_id: m.profile_id,
        full_name: m.profiles?.full_name || "Unknown",
        email: m.profiles?.email,
        org_role: m.org_role as TeamMember['org_role'],
        manager_id: m.manager_id,
        manager_name: m.manager?.profiles?.full_name || null,
        created_at: m.created_at,
        is_current_user: m.profile_id === userId,
      }));
    },
  });

  // Fetch potential managers (client_admins and team_leaders)
  const { data: potentialManagers } = useQuery({
    queryKey: ["potential-managers", organizationId],
    enabled: !!organizationId && isTeamLeader,
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("id, profiles!inner(full_name)")
        .eq("organization_id", organizationId)
        .in("org_role", ["client_admin", "team_leader"]);
      return (data as any[])?.map(m => ({ id: m.id, name: m.profiles?.full_name })) ?? [];
    },
  });

  // Add member mutation
  const addMember = useMutation({
    mutationFn: async () => {
      // 1. Create auth user (invite)
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(newMemberEmail, {
        data: { full_name: newMemberName },
        redirectTo: `${window.location.origin}/auth`,
      });
      if (inviteError) throw inviteError;

      // 2. Wait for user to be created, then add to organization
      // The trigger will handle profile creation, we just need to add org_member
      // But we need the user_id first - for invite flow, user is created on accept
      // Alternative: create user with temp password
      
      // For now, let's use signUp which creates user immediately
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email: newMemberEmail,
        password: Math.random().toString(36).slice(-10), // temp password
        email_confirm: true,
        user_metadata: { full_name: newMemberName },
      });
      if (signUpError) throw signUpError;

      // 3. Add to organization_members
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: organizationId,
          profile_id: signUpData.user.id,
          org_role: newMemberRole,
          manager_id: newMemberManager || (isClientAdmin ? orgMemberId : null),
        });
      if (memberError) throw memberError;

      // 4. Send invite email with temp password (in production, use proper invite flow)
      return signUpData.user;
    },
    onSuccess: () => {
      toast.success(`${newMemberRole === 'team_leader' ? 'Team Leader' : 'Telecaller'} added successfully!`);
      setShowAddDialog(false);
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberRole(defaultRole);
      setNewMemberManager("");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add member");
    },
    onSettled: () => setAdding(false),
  });

  // Delete member mutation
  const deleteMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: () => toast.error("Failed to remove member"),
  });

  // Role options for dropdown
  const roleOptions = [
    { value: 'team_leader' as const, label: 'Team Leader', icon: Shield, desc: 'Can manage telecallers & see their data' },
    { value: 'telecaller' as const, label: 'Telecaller', icon: Phone, desc: 'Can only see own leads & data' },
  ].filter(r => allowedRoles.includes(r.value));

  // Manager options (for team_leader role)
  const managerOptions = potentialManagers?.map(m => ({ value: m.id, label: m.name })) ?? [];

  if (!organizationId) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Management</CardTitle>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                  placeholder="john@company.com"
                  required
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={newMemberRole} onValueChange={v => setNewMemberRole(v as MemberRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        <div className="flex items-center gap-2">
                          <role.icon className="h-4 w-4" />
                          <span>{role.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {roleOptions.find(r => r.value === newMemberRole)?.desc}
                </p>
              </div>
              {(newMemberRole === 'telecaller' && isClientAdmin) && (
                <div>
                  <Label>Assign to Team Leader</Label>
                  <Select value={newMemberManager} onValueChange={v => setNewMemberManager(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team leader" />
                    </SelectTrigger>
                    <SelectContent>
                      {managerOptions.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Telecaller will report to this team leader</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={() => addMember.mutate()} disabled={adding || !newMemberName || !newMemberEmail}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Reports To</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map(member => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                      {member.is_current_user && <Badge variant="secondary" className="mt-1">You</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.org_role === 'client_admin' ? 'default' : member.org_role === 'team_leader' ? 'secondary' : 'outline'}>
                      {member.org_role === 'client_admin' ? (
                        <>
                          <Shield className="h-3 w-3 mr-1" /> Client Admin
                        </>
                      ) : member.org_role === 'team_leader' ? (
                        <>
                          <Shield className="h-3 w-3 mr-1" /> Team Leader
                        </>
                      ) : (
                        <>
                          <Phone className="h-3 w-3 mr-1" /> Telecaller
                        </>
                      )}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.manager_name ? (
                      <span className="text-sm text-muted-foreground">{member.manager_name}</span>
                    ) : member.org_role === 'client_admin' ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Badge variant="destructive" className="text-xs">No manager assigned</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(member.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {!member.is_current_user && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Remove ${member.full_name} from team?`)) {
                            deleteMember.mutate(member.id);
                          }
                        }}
                        disabled={member.org_role === 'client_admin'}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!members?.length && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No team members yet. Click "Add Member" to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}