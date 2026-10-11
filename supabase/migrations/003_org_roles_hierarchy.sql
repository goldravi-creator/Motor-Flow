-- ============================================================================
-- ORGANIZATION ROLES & HIERARCHY
-- ============================================================================
-- Adds role-based hierarchy within each organization:
-- client_admin (owner) → team_leader → telecaller
-- Higher roles see all data in their tree; lower roles see only their own
-- ============================================================================

-- Add org_role to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS org_role text NOT NULL DEFAULT 'telecaller'
CHECK (org_role IN ('client_admin', 'team_leader', 'telecaller'));

-- Add manager_id for hierarchy (team_leader reports to client_admin, telecaller reports to team_leader)
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.organization_members(id);

-- Index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_org_members_manager ON public.organization_members(manager_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON public.organization_members(organization_id, org_role);

-- Update existing members to have client_admin role (first member = owner)
UPDATE public.organization_members 
SET org_role = 'client_admin' 
WHERE id IN (
  SELECT DISTINCT ON (organization_id) id 
  FROM public.organization_members 
  ORDER BY organization_id, created_at
);

-- ============================================================================
-- HIERARCHY HELPER FUNCTIONS
-- ============================================================================

-- Get all descendant member IDs for a given member (recursive)
CREATE OR REPLACE FUNCTION public.get_descendant_member_ids(p_member_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER AS $$
  WITH RECURSIVE descendants AS (
    SELECT id FROM public.organization_members WHERE id = p_member_id
    UNION ALL
    SELECT om.id 
    FROM public.organization_members om
    JOIN descendants d ON om.manager_id = d.id
  )
  SELECT id FROM descendants;
$$;

-- Get all member IDs in user's visible tree (self + descendants)
CREATE OR REPLACE FUNCTION public.get_visible_member_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM public.get_descendant_member_ids(
    (SELECT id FROM public.organization_members WHERE profile_id = p_user_id LIMIT 1)
  );
$$;

-- Get user's org role
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_user_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT org_role FROM public.organization_members WHERE profile_id = p_user_id LIMIT 1;
$$;

-- Check if user can manage another user (for UI permissions)
CREATE OR REPLACE FUNCTION public.can_manage_user(p_manager_id uuid, p_target_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.get_descendant_member_ids(p_manager_id) 
    WHERE id = p_target_id
  );
$$;

-- ============================================================================
-- UPDATED RLS POLICIES FOR HIERARCHICAL ACCESS
-- ============================================================================

-- LEADS: Users see leads assigned to them OR their descendants
DROP POLICY IF EXISTS "org_member_view_leads" ON public.leads;
DROP POLICY IF EXISTS "org_member_insert_leads" ON public.leads;
DROP POLICY IF EXISTS "org_member_update_leads" ON public.leads;
DROP POLICY IF EXISTS "org_member_delete_leads" ON public.leads;

CREATE POLICY "hierarchy_view_leads" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR assigned_to IN (
      SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_insert_leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR assigned_to IN (
      SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
    )
    AND organization_id = public.get_current_user_org_id()
  );

CREATE POLICY "hierarchy_update_leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR assigned_to IN (
      SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR assigned_to IN (
      SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_delete_leads" ON public.leads
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR assigned_to IN (
      SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
    )
  );

-- CUSTOMERS: Same hierarchy
DROP POLICY IF EXISTS "org_member_view_customers" ON public.customers;
DROP POLICY IF EXISTS "org_member_insert_customers" ON public.customers;
DROP POLICY IF EXISTS "org_member_update_customers" ON public.customers;
DROP POLICY IF EXISTS "org_member_delete_customers" ON public.customers;

CREATE POLICY "hierarchy_view_customers" ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR id IN (
      SELECT DISTINCT customer_id FROM public.leads 
      WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_customers" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR organization_id = public.get_current_user_org_id()
  );

-- TASKS: Hierarchy based on assigned_to
DROP POLICY IF EXISTS "org_member_view_tasks" ON public.tasks;
DROP POLICY IF EXISTS "org_member_insert_tasks" ON public.tasks;
DROP POLICY IF EXISTS "org_member_update_tasks" ON public.tasks;
DROP POLICY IF EXISTS "org_member_delete_tasks" ON public.tasks;

CREATE POLICY "hierarchy_view_tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR assigned_to IN (
      SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
    )
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR assigned_to IN (
      SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
    )
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- NOTES: Hierarchy based on lead assignment
DROP POLICY IF EXISTS "org_member_view_notes" ON public.notes;
DROP POLICY IF EXISTS "org_member_insert_notes" ON public.notes;

CREATE POLICY "hierarchy_view_notes" ON public.notes
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_notes" ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- LEAD_ACTIVITIES: Hierarchy based on lead assignment
DROP POLICY IF EXISTS "org_member_view_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "org_member_insert_activities" ON public.lead_activities;

CREATE POLICY "hierarchy_view_activities" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_activities" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- WHATSAPP_MESSAGES: Hierarchy based on lead assignment
DROP POLICY IF EXISTS "org_member_view_whatsapp" ON public.whatsapp_messages;
DROP POLICY IF EXISTS "org_member_insert_whatsapp" ON public.whatsapp_messages;

CREATE POLICY "hierarchy_view_whatsapp" ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_whatsapp" ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- CALL_RECORDS: Hierarchy based on lead assignment
DROP POLICY IF EXISTS "org_member_view_calls" ON public.call_records;
DROP POLICY IF EXISTS "org_member_insert_calls" ON public.call_records;

CREATE POLICY "hierarchy_view_calls" ON public.call_records
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_calls" ON public.call_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- QUOTATIONS: Hierarchy based on lead assignment
DROP POLICY IF EXISTS "org_member_view_quotations" ON public.quotations;
DROP POLICY IF EXISTS "org_member_insert_quotations" ON public.quotations;
DROP POLICY IF EXISTS "org_member_update_quotations" ON public.quotations;

CREATE POLICY "hierarchy_view_quotations" ON public.quotations
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_quotations" ON public.quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- APPLICATIONS: Hierarchy based on lead assignment
DROP POLICY IF EXISTS "org_member_view_applications" ON public.applications;
DROP POLICY IF EXISTS "org_member_insert_applications" ON public.applications;
DROP POLICY IF EXISTS "org_member_update_applications" ON public.applications;

CREATE POLICY "hierarchy_view_applications" ON public.applications
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- DOCUMENTS: Hierarchy based on lead assignment
DROP POLICY IF EXISTS "org_member_view_documents" ON public.documents;
DROP POLICY IF EXISTS "org_member_insert_documents" ON public.documents;

CREATE POLICY "hierarchy_view_documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- PAYMENTS: Hierarchy based on lead assignment
DROP POLICY IF EXISTS "org_member_view_payments" ON public.payments;
DROP POLICY IF EXISTS "org_member_insert_payments" ON public.payments;

CREATE POLICY "hierarchy_view_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_payments" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR lead_id IN (
      SELECT id FROM public.leads WHERE assigned_to IN (
        SELECT profile_id FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- ORGANIZATION_MEMBERS: Client admins see all, team leaders see their tree
DROP POLICY IF EXISTS "org_member_view_own_members" ON public.organization_members;
DROP POLICY IF EXISTS "org_admin_manage_members" ON public.organization_members;
DROP POLICY IF EXISTS "org_admin_delete_members" ON public.organization_members;

CREATE POLICY "hierarchy_view_members" ON public.organization_members
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR id IN (
      SELECT id FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_insert_members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR (
      organization_id = public.get_current_user_org_id()
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
        AND om.org_role = 'client_admin'
      )
    )
    OR (
      organization_id = public.get_current_user_org_id()
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
        AND om.org_role = 'team_leader'
        AND NEW.org_role = 'telecaller'
        AND NEW.manager_id = om.id
      )
    )
  );

CREATE POLICY "hierarchy_update_members" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR id IN (
      SELECT id FROM public.get_visible_member_ids(auth.uid())
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR (
      organization_id = public.get_current_user_org_id()
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
        AND om.org_role = 'client_admin'
      )
    )
  );

CREATE POLICY "hierarchy_delete_members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    public.is_superadmin()
    OR (
      organization_id = public.get_current_user_org_id()
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.profile_id = auth.uid()
        AND om.org_role = 'client_admin'
      )
    )
  );

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_descendant_member_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visible_member_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_org_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_user(uuid, uuid) TO authenticated;