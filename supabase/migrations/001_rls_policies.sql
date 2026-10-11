-- ============================================================================
-- MULTI-TENANT RLS POLICIES FOR MOTOR FLOW CRM
-- ============================================================================
-- This migration enables Row Level Security on all tables and creates policies
-- to enforce organization-level data isolation.
-- 
-- SUPERADMIN: The platform owner (you) - identified by email or user_role
-- CLIENTS: Each signup creates an organization + organization_member
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current user's organization_id
CREATE OR REPLACE FUNCTION public.get_current_user_org_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT om.organization_id
  FROM public.organization_members om
  WHERE om.profile_id = auth.uid()
  LIMIT 1;
$$;

-- Check if current user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  );
$$;

-- Check if current user is admin of their organization
CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'sales_manager')
  );
$$;

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

-- Superadmin can see all organizations
CREATE POLICY "superadmin_all_organizations" ON public.organizations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Users can see their own organization
CREATE POLICY "org_member_view_own_org" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_current_user_org_id());

-- ============================================================================
-- ORGANIZATION_MEMBERS POLICIES
-- ============================================================================

-- Superadmin can manage all members
CREATE POLICY "superadmin_all_members" ON public.organization_members
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Users can see members of their organization
CREATE POLICY "org_member_view_own_members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

-- Admins can invite/remove members in their org
CREATE POLICY "org_admin_manage_members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin()
  );

CREATE POLICY "org_admin_delete_members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_current_user_org_id()
    AND public.is_org_admin()
  );

-- ============================================================================
-- CUSTOMERS POLICIES
-- ============================================================================

-- Superadmin sees all customers
CREATE POLICY "superadmin_all_customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Users see customers in their organization
CREATE POLICY "org_member_view_customers" ON public.customers
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_insert_customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_update_customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_current_user_org_id())
  WITH CHECK (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_delete_customers" ON public.customers
  FOR DELETE TO authenticated
  USING (organization_id = public.get_current_user_org_id());

-- ============================================================================
-- LEADS POLICIES
-- ============================================================================

-- Superadmin sees all leads
CREATE POLICY "superadmin_all_leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Users see leads in their organization
CREATE POLICY "org_member_view_leads" ON public.leads
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_insert_leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_update_leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_current_user_org_id())
  WITH CHECK (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_delete_leads" ON public.leads
  FOR DELETE TO authenticated
  USING (organization_id = public.get_current_user_org_id());

-- ============================================================================
-- LEAD_ACTIVITIES POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_activities" ON public.lead_activities
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_activities" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_insert_activities" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

-- ============================================================================
-- NOTES POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_notes" ON public.notes
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_notes" ON public.notes
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_insert_notes" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

-- ============================================================================
-- TASKS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_insert_tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_update_tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_current_user_org_id())
  WITH CHECK (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_delete_tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (organization_id = public.get_current_user_org_id());

-- ============================================================================
-- WHATSAPP_MESSAGES POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_whatsapp" ON public.whatsapp_messages
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_whatsapp" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_insert_whatsapp" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

-- ============================================================================
-- CALL_RECORDS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_calls" ON public.call_records
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_calls" ON public.call_records
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_insert_calls" ON public.call_records
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

-- ============================================================================
-- QUOTATIONS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_quotations" ON public.quotations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_quotations" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_insert_quotations" ON public.quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_update_quotations" ON public.quotations
  FOR UPDATE TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

-- ============================================================================
-- APPLICATIONS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_applications" ON public.applications
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_applications" ON public.applications
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_insert_applications" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_update_applications" ON public.applications
  FOR UPDATE TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

-- ============================================================================
-- DOCUMENTS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_documents" ON public.documents
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

CREATE POLICY "org_member_insert_documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads WHERE organization_id = public.get_current_user_org_id()
    )
  );

-- ============================================================================
-- PAYMENTS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_insert_payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

-- ============================================================================
-- CAMPAIGNS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_member_view_campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id());

CREATE POLICY "org_member_insert_campaigns" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id());

-- ============================================================================
-- INTEGRATION_SETTINGS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_integrations" ON public.integration_settings
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_admin_view_integrations" ON public.integration_settings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id() AND public.is_org_admin());

CREATE POLICY "org_admin_manage_integrations" ON public.integration_settings
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_current_user_org_id() AND public.is_org_admin());

-- ============================================================================
-- AUDIT_LOGS POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_audit_logs" ON public.audit_logs
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "org_admin_view_audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.get_current_user_org_id() AND public.is_org_admin());

-- ============================================================================
-- USER_ROLES POLICIES
-- ============================================================================

CREATE POLICY "superadmin_all_user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "user_view_own_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin() TO authenticated;