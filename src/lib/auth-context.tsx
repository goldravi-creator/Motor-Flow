import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type OrgRole = 'client_admin' | 'team_leader' | 'telecaller' | null;
export type ProductAccess = 'insurance' | 'loan' | 'both' | null;

interface AuthContextType {
  userId: string | null;
  organizationId: string | null;
  orgRole: OrgRole;
  orgMemberId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  loading: boolean;
  canManage: (targetMemberId: string) => Promise<boolean>;
  isClientAdmin: boolean;
  isTeamLeader: boolean;
  isTelecaller: boolean;
  productAccess: ProductAccess;
  hasInsuranceAccess: boolean;
  hasLoanAccess: boolean;
  hasBothAccess: boolean;
}

const AuthContext = createContext<AuthContextType>({
  userId: null,
  organizationId: null,
  orgRole: null,
  orgMemberId: null,
  isSuperAdmin: false,
  userRole: null,
  loading: true,
  canManage: () => Promise.resolve(false),
  isClientAdmin: false,
  isTeamLeader: false,
  isTelecaller: false,
  productAccess: null,
  hasInsuranceAccess: false,
  hasLoanAccess: false,
  hasBothAccess: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthContextType>({
    userId: null,
    organizationId: null,
    orgRole: null,
    orgMemberId: null,
    isSuperAdmin: false,
    userRole: null,
    loading: true,
    canManage: () => Promise.resolve(false),
    isClientAdmin: false,
    isTeamLeader: false,
    isTelecaller: false,
    productAccess: null,
    hasInsuranceAccess: false,
    hasLoanAccess: false,
    hasBothAccess: false,
  });

  useEffect(() => {
    async function loadAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuth({ 
          userId: null, organizationId: null, orgRole: null, orgMemberId: null, 
          isSuperAdmin: false, userRole: null, loading: false, 
          canManage: () => Promise.resolve(false),
          isClientAdmin: false, isTeamLeader: false, isTelecaller: false,
          productAccess: null, hasInsuranceAccess: false, hasLoanAccess: false, hasBothAccess: false
        });
        return;
      }

      // Get organization member info with role
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('id, organization_id, org_role, manager_id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      // Get platform role (super_admin)
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      // Get organization product access
      const { data: org } = await supabase
        .from('organizations')
        .select('product_access')
        .eq('id', orgMember?.organization_id)
        .maybeSingle();

      const productAccess = org?.product_access ?? 'both';
      const orgRole = orgMember?.org_role ?? null;
      const isSuperAdmin = userRole?.role === 'super_admin';

      // Helper to check if current user can manage another member
      const canManage = async (targetMemberId: string): Promise<boolean> => {
        if (isSuperAdmin) return true;
        if (!orgMember?.id) return false;
        
        const { data } = await supabase.rpc('can_manage_user', {
          p_manager_id: orgMember.id,
          p_target_id: targetMemberId
        });
        return data ?? false;
      };

      setAuth({
        userId: user.id,
        organizationId: orgMember?.organization_id ?? null,
        orgRole,
        orgMemberId: orgMember?.id ?? null,
        isSuperAdmin,
        userRole: userRole?.role ?? null,
        loading: false,
        canManage,
        isClientAdmin: orgRole === 'client_admin',
        isTeamLeader: orgRole === 'team_leader',
        isTelecaller: orgRole === 'telecaller',
        productAccess,
        hasInsuranceAccess: productAccess === 'insurance' || productAccess === 'both',
        hasLoanAccess: productAccess === 'loan' || productAccess === 'both',
        hasBothAccess: productAccess === 'both',
      });
    }

    loadAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}