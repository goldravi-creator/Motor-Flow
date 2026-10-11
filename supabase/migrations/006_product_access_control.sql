-- ============================================================================
-- PRODUCT ACCESS CONTROL PER ORGANIZATION
-- Insurance and Loan as completely separate "projects"
-- Superadmin controls which product(s) each org can access
-- ============================================================================

-- Add product_access column to organizations
-- Values: 'insurance', 'loan', 'both'
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS product_access text NOT NULL DEFAULT 'both'
CHECK (product_access IN ('insurance', 'loan', 'both'));

-- Index for querying
CREATE INDEX IF NOT EXISTS idx_organizations_product_access ON public.organizations(product_access);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get current user's organization product access
CREATE OR REPLACE FUNCTION public.get_user_org_product_access()
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT o.product_access
  FROM public.organizations o
  JOIN public.organization_members om ON om.organization_id = o.id
  WHERE om.profile_id = auth.uid()
  LIMIT 1;
$$;

-- Check if user's org has access to a specific product
CREATE OR REPLACE FUNCTION public.org_has_product_access(p_product text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.profile_id = auth.uid()
    AND (o.product_access = 'both' OR o.product_access = p_product)
  );
$$;

-- Superadmin function to update org product access
CREATE OR REPLACE FUNCTION public.set_org_product_access(p_org_id uuid, p_access text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only superadmin can change product access';
  END IF;
  
  IF p_access NOT IN ('insurance', 'loan', 'both') THEN
    RAISE EXCEPTION 'Invalid product access value';
  END IF;
  
  UPDATE public.organizations
  SET product_access = p_access
  WHERE id = p_org_id;
END;
$$;

-- ============================================================================
-- UPDATE RLS POLICIES ON PRODUCT TABLES TO ENFORCE PRODUCT ACCESS
-- ============================================================================

-- INSURANCE_LEADS: Only accessible if org has insurance access
DROP POLICY IF EXISTS "superadmin_insurance_leads" ON public.insurance_leads;
DROP POLICY IF EXISTS "hierarchy_view_insurance_leads" ON public.insurance_leads;
DROP POLICY IF EXISTS "hierarchy_insert_insurance_leads" ON public.insurance_leads;
DROP POLICY IF EXISTS "hierarchy_update_insurance_leads" ON public.insurance_leads;
DROP POLICY IF EXISTS "hierarchy_delete_insurance_leads" ON public.insurance_leads;

CREATE POLICY "superadmin_insurance_leads" ON public.insurance_leads
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "hierarchy_view_insurance_leads" ON public.insurance_leads
  FOR SELECT TO authenticated
  USING (
    public.org_has_product_access('insurance')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_insert_insurance_leads" ON public.insurance_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.org_has_product_access('insurance')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
    AND organization_id = public.get_current_user_org_id()
  );

CREATE POLICY "hierarchy_update_insurance_leads" ON public.insurance_leads
  FOR UPDATE TO authenticated
  USING (
    public.org_has_product_access('insurance')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  )
  WITH CHECK (
    public.org_has_product_access('insurance')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_delete_insurance_leads" ON public.insurance_leads
  FOR DELETE TO authenticated
  USING (
    public.org_has_product_access('insurance')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

-- LOAN_LEADS: Only accessible if org has loan access
DROP POLICY IF EXISTS "superadmin_loan_leads" ON public.loan_leads;
DROP POLICY IF EXISTS "hierarchy_view_loan_leads" ON public.loan_leads;
DROP POLICY IF EXISTS "hierarchy_insert_loan_leads" ON public.loan_leads;
DROP POLICY IF EXISTS "hierarchy_update_loan_leads" ON public.loan_leads;
DROP POLICY IF EXISTS "hierarchy_delete_loan_leads" ON public.loan_leads;

CREATE POLICY "superadmin_loan_leads" ON public.loan_leads
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "hierarchy_view_loan_leads" ON public.loan_leads
  FOR SELECT TO authenticated
  USING (
    public.org_has_product_access('loan')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_insert_loan_leads" ON public.loan_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    public.org_has_product_access('loan')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
    AND organization_id = public.get_current_user_org_id()
  );

CREATE POLICY "hierarchy_update_loan_leads" ON public.loan_leads
  FOR UPDATE TO authenticated
  USING (
    public.org_has_product_access('loan')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  )
  WITH CHECK (
    public.org_has_product_access('loan')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_delete_loan_leads" ON public.loan_leads
  FOR DELETE TO authenticated
  USING (
    public.org_has_product_access('loan')
    AND assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

-- INSURANCE_QUOTATIONS: Only accessible if org has insurance access
DROP POLICY IF EXISTS "superadmin_insurance_quotations" ON public.insurance_quotations;
DROP POLICY IF EXISTS "hierarchy_view_insurance_quotations" ON public.insurance_quotations;
DROP POLICY IF EXISTS "hierarchy_insert_insurance_quotations" ON public.insurance_quotations;
DROP POLICY IF EXISTS "hierarchy_update_insurance_quotations" ON public.insurance_quotations;

CREATE POLICY "superadmin_insurance_quotations" ON public.insurance_quotations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "hierarchy_view_insurance_quotations" ON public.insurance_quotations
  FOR SELECT TO authenticated
  USING (
    public.org_has_product_access('insurance')
    AND lead_id IN (
      SELECT id FROM public.insurance_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_insurance_quotations" ON public.insurance_quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.org_has_product_access('insurance')
    AND lead_id IN (
      SELECT id FROM public.insurance_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_update_insurance_quotations" ON public.insurance_quotations
  FOR UPDATE TO authenticated
  USING (
    public.org_has_product_access('insurance')
    AND lead_id IN (
      SELECT id FROM public.insurance_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  )
  WITH CHECK (
    public.org_has_product_access('insurance')
    AND lead_id IN (
      SELECT id FROM public.insurance_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- LOAN_QUOTATIONS: Only accessible if org has loan access
DROP POLICY IF EXISTS "superadmin_loan_quotations" ON public.loan_quotations;
DROP POLICY IF EXISTS "hierarchy_view_loan_quotations" ON public.loan_quotations;
DROP POLICY IF EXISTS "hierarchy_insert_loan_quotations" ON public.loan_quotations;
DROP POLICY IF EXISTS "hierarchy_update_loan_quotations" ON public.loan_quotations;

CREATE POLICY "superadmin_loan_quotations" ON public.loan_quotations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "hierarchy_view_loan_quotations" ON public.loan_quotations
  FOR SELECT TO authenticated
  USING (
    public.org_has_product_access('loan')
    AND lead_id IN (
      SELECT id FROM public.loan_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_loan_quotations" ON public.loan_quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.org_has_product_access('loan')
    AND lead_id IN (
      SELECT id FROM public.loan_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_update_loan_quotations" ON public.loan_quotations
  FOR UPDATE TO authenticated
  USING (
    public.org_has_product_access('loan')
    AND lead_id IN (
      SELECT id FROM public.loan_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  )
  WITH CHECK (
    public.org_has_product_access('loan')
    AND lead_id IN (
      SELECT id FROM public.loan_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- ============================================================================
-- GRANT EXECUTE ON NEW FUNCTIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_user_org_product_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_product_access(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_org_product_access(uuid, text) TO authenticated;

-- ============================================================================
-- NOTE:
-- This migration should run AFTER 005_split_product_tables.sql
-- The old 'leads' and 'quotations' tables remain for backward compatibility
-- Application code must be updated to check product_access before rendering tabs
-- ============================================================================