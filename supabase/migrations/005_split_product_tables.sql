-- ============================================================================
-- SPLIT LEADS & QUOTATIONS INTO PRODUCT-SPECIFIC TABLES
-- WITH FULL HIERARCHICAL RLS (Client Admin → Team Leader → Telecaller)
-- ============================================================================

-- ============================================================================
-- 1. CREATE INSURANCE_LEADS TABLE
-- ============================================================================
CREATE TABLE public.insurance_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_uid text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  customer_id uuid REFERENCES public.customers(id),
  assigned_to uuid REFERENCES auth.users(id),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text,
  state text,
  source text NOT NULL DEFAULT 'manual',
  campaign text,
  status text NOT NULL DEFAULT 'new',
  ai_status text,
  whatsapp_status text,
  call_status text,
  automation_status text,
  priority text NOT NULL DEFAULT 'medium',
  lead_score integer DEFAULT 0,
  vehicle_reg text,
  vehicle_make text,
  vehicle_model text,
  vehicle_variant text,
  vehicle_year integer,
  fuel_type text,
  current_insurer text,
  policy_expiry date,
  coverage_type text,
  whatsapp_consent boolean DEFAULT false,
  call_consent boolean DEFAULT false,
  do_not_contact boolean DEFAULT false,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_insurance_leads_org ON public.insurance_leads(organization_id);
CREATE INDEX idx_insurance_leads_assigned ON public.insurance_leads(assigned_to);
CREATE INDEX idx_insurance_leads_customer ON public.insurance_leads(customer_id);
CREATE INDEX idx_insurance_leads_status ON public.insurance_leads(status);
CREATE INDEX idx_insurance_leads_uid ON public.insurance_leads(lead_uid);
CREATE INDEX idx_insurance_leads_phone ON public.insurance_leads(phone);

-- ============================================================================
-- 2. CREATE LOAN_LEADS TABLE
-- ============================================================================
CREATE TABLE public.loan_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_uid text NOT NULL UNIQUE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  customer_id uuid REFERENCES public.customers(id),
  assigned_to uuid REFERENCES auth.users(id),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  city text,
  state text,
  source text NOT NULL DEFAULT 'manual',
  campaign text,
  status text NOT NULL DEFAULT 'new',
  ai_status text,
  whatsapp_status text,
  call_status text,
  automation_status text,
  priority text NOT NULL DEFAULT 'medium',
  lead_score integer DEFAULT 0,
  vehicle_reg text,
  vehicle_make text,
  vehicle_model text,
  vehicle_variant text,
  vehicle_year integer,
  fuel_type text,
  employment_type text,
  monthly_income numeric,
  loan_amount numeric,
  down_payment numeric,
  tenure_months integer,
  whatsapp_consent boolean DEFAULT false,
  call_consent boolean DEFAULT false,
  do_not_contact boolean DEFAULT false,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_loan_leads_org ON public.loan_leads(organization_id);
CREATE INDEX idx_loan_leads_assigned ON public.loan_leads(assigned_to);
CREATE INDEX idx_loan_leads_customer ON public.loan_leads(customer_id);
CREATE INDEX idx_loan_leads_status ON public.loan_leads(status);
CREATE INDEX idx_loan_leads_uid ON public.loan_leads(lead_uid);
CREATE INDEX idx_loan_leads_phone ON public.loan_leads(phone);

-- ============================================================================
-- 3. CREATE INSURANCE_QUOTATIONS TABLE
-- ============================================================================
CREATE TABLE public.insurance_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.insurance_leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid REFERENCES auth.users(id),
  provider text,
  premium numeric,
  coverage text,
  idv numeric,
  status text NOT NULL DEFAULT 'draft',
  valid_until date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_insurance_quotations_lead ON public.insurance_quotations(lead_id);
CREATE INDEX idx_insurance_quotations_org ON public.insurance_quotations(organization_id);

-- ============================================================================
-- 4. CREATE LOAN_QUOTATIONS TABLE (reuse quotations table with loan fields)
-- ============================================================================
CREATE TABLE public.loan_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.loan_leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_by uuid REFERENCES auth.users(id),
  provider text, -- bank/lender name
  interest_rate numeric,
  loan_amount numeric,
  tenure_months integer,
  emi numeric,
  status text NOT NULL DEFAULT 'draft',
  valid_until date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_loan_quotations_lead ON public.loan_quotations(lead_id);
CREATE INDEX idx_loan_quotations_org ON public.loan_quotations(organization_id);

-- ============================================================================
-- 4b. SEED DEMO AUTH USERS (FK PREREQUISITE FOR DATA MIGRATION)
-- ----------------------------------------------------------------------------
-- The new product tables reference assigned_to/created_by -> auth.users(id).
-- The demo data copied below references the demo profile IDs (a0000000-...)
-- that only exist in public.profiles. Create matching auth.users rows so the
-- FK constraints pass. The on_auth_user_created trigger uses ON CONFLICT
-- DO NOTHING for profiles/user_roles, so existing demo profiles and roles are
-- left untouched (hierarchy unchanged). Real signups still flow normally.
-- ============================================================================
INSERT INTO auth.users
  (id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, raw_app_meta_data, confirmation_token,
   recovery_token, email_change, created_at, updated_at)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ravi.sharma@motorflow.in',
   '$2a$10$7EqJtq98hPqEX7fNZaFWoOhiD3PwBIjmx1G8S5ZheY7nvWaY1eEGa', now(),
   '{"full_name":"Ravi Sharma"}', '{}', '', '', '', now(), now()),
  ('a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'anjali.verma@motorflow.in',
   '$2a$10$7EqJtq98hPqEX7fNZaFWoOhiD3PwBIjmx1G8S5ZheY7nvWaY1eEGa', now(),
   '{"full_name":"Anjali Verma"}', '{}', '', '', '', now(), now()),
  ('a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'vikram.singh@motorflow.in',
   '$2a$10$7EqJtq98hPqEX7fNZaFWoOhiD3PwBIjmx1G8S5ZheY7nvWaY1eEGa', now(),
   '{"full_name":"Vikram Singh"}', '{}', '', '', '', now(), now()),
  ('a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'priya.nair@motorflow.in',
   '$2a$10$7EqJtq98hPqEX7fNZaFWoOhiD3PwBIjmx1G8S5ZheY7nvWaY1eEGa', now(),
   '{"full_name":"Priya Nair"}', '{}', '', '', '', now(), now()),
  ('a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'amit.kulkarni@motorflow.in',
   '$2a$10$7EqJtq98hPqEX7fNZaFWoOhiD3PwBIjmx1G8S5ZheY7nvWaY1eEGa', now(),
   '{"full_name":"Amit Kulkarni"}', '{}', '', '', '', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. MIGRATE EXISTING DATA FROM leads TABLE
-- ============================================================================

-- Migrate Insurance Leads
INSERT INTO public.insurance_leads (
  id, lead_uid, organization_id, customer_id, assigned_to,
  full_name, phone, email, city, state, source, campaign,
  status, ai_status, whatsapp_status, call_status, automation_status,
  priority, lead_score, vehicle_reg, vehicle_make, vehicle_model,
  vehicle_variant, vehicle_year, fuel_type, current_insurer,
  policy_expiry, coverage_type, whatsapp_consent, call_consent,
  do_not_contact, last_contacted_at, next_follow_up_at,
  utm_source, utm_medium, utm_campaign, created_at, updated_at
)
SELECT
  id, lead_uid, organization_id, customer_id, assigned_to,
  full_name, phone, email, city, state, source, campaign,
  status, ai_status, whatsapp_status, call_status, automation_status,
  priority, lead_score, vehicle_reg, vehicle_make, vehicle_model,
  vehicle_variant, vehicle_year, fuel_type, current_insurer,
  policy_expiry, coverage_type, whatsapp_consent, call_consent,
  do_not_contact, last_contacted_at, next_follow_up_at,
  utm_source, utm_medium, utm_campaign, created_at, updated_at
FROM public.leads
WHERE product = 'insurance';

-- Migrate Loan Leads
INSERT INTO public.loan_leads (
  id, lead_uid, organization_id, customer_id, assigned_to,
  full_name, phone, email, city, state, source, campaign,
  status, ai_status, whatsapp_status, call_status, automation_status,
  priority, lead_score, vehicle_reg, vehicle_make, vehicle_model,
  vehicle_variant, vehicle_year, fuel_type, employment_type,
  monthly_income, loan_amount, down_payment, tenure_months,
  whatsapp_consent, call_consent, do_not_contact,
  last_contacted_at, next_follow_up_at,
  utm_source, utm_medium, utm_campaign, created_at, updated_at
)
SELECT
  id, lead_uid, organization_id, customer_id, assigned_to,
  full_name, phone, email, city, state, source, campaign,
  status, ai_status, whatsapp_status, call_status, automation_status,
  priority, lead_score, vehicle_reg, vehicle_make, vehicle_model,
  vehicle_variant, vehicle_year, fuel_type, employment_type,
  monthly_income, loan_amount, down_payment, tenure_months,
  whatsapp_consent, call_consent, do_not_contact,
  last_contacted_at, next_follow_up_at,
  utm_source, utm_medium, utm_campaign, created_at, updated_at
FROM public.leads
WHERE product = 'loan';

-- Migrate Insurance Quotations
INSERT INTO public.insurance_quotations (
  id, lead_id, organization_id, created_by, provider,
  premium, coverage, idv, status, valid_until, notes,
  created_at, updated_at
)
SELECT q.id, q.lead_id, l.organization_id, q.created_by, q.provider,
  q.premium, q.coverage, q.idv, q.status, q.valid_until, q.notes,
  q.created_at, q.created_at AS updated_at
FROM public.quotations q
JOIN public.leads l ON q.lead_id = l.id
WHERE q.product = 'insurance';

-- Migrate Loan Quotations
INSERT INTO public.loan_quotations (
  id, lead_id, organization_id, created_by, provider,
  interest_rate, loan_amount, tenure_months, emi,
  status, valid_until, notes, created_at, updated_at
)
SELECT q.id, q.lead_id, l.organization_id, q.created_by, q.provider,
  q.interest_rate, q.loan_amount, q.tenure_months, q.emi,
  q.status, q.valid_until, q.notes, q.created_at, q.created_at AS updated_at
FROM public.quotations q
JOIN public.leads l ON q.lead_id = l.id
WHERE q.product = 'loan';

-- ============================================================================
-- 6. ENABLE RLS ON NEW TABLES
-- ============================================================================
ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_quotations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. HIERARCHICAL RLS POLICIES - INSURANCE_LEADS
-- ============================================================================

-- Superadmin: full access
CREATE POLICY "superadmin_insurance_leads" ON public.insurance_leads
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- Client Admin / Team Leader / Telecaller: hierarchical access
CREATE POLICY "hierarchy_view_insurance_leads" ON public.insurance_leads
  FOR SELECT TO authenticated
  USING (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_insert_insurance_leads" ON public.insurance_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
    AND organization_id = public.get_current_user_org_id()
  );

CREATE POLICY "hierarchy_update_insurance_leads" ON public.insurance_leads
  FOR UPDATE TO authenticated
  USING (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  )
  WITH CHECK (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_delete_insurance_leads" ON public.insurance_leads
  FOR DELETE TO authenticated
  USING (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

-- ============================================================================
-- 8. HIERARCHICAL RLS POLICIES - LOAN_LEADS
-- ============================================================================

CREATE POLICY "superadmin_loan_leads" ON public.loan_leads
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "hierarchy_view_loan_leads" ON public.loan_leads
  FOR SELECT TO authenticated
  USING (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_insert_loan_leads" ON public.loan_leads
  FOR INSERT TO authenticated
  WITH CHECK (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
    AND organization_id = public.get_current_user_org_id()
  );

CREATE POLICY "hierarchy_update_loan_leads" ON public.loan_leads
  FOR UPDATE TO authenticated
  USING (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  )
  WITH CHECK (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "hierarchy_delete_loan_leads" ON public.loan_leads
  FOR DELETE TO authenticated
  USING (
    assigned_to IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

-- ============================================================================
-- 9. HIERARCHICAL RLS POLICIES - INSURANCE_QUOTATIONS
-- ============================================================================

CREATE POLICY "superadmin_insurance_quotations" ON public.insurance_quotations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "hierarchy_view_insurance_quotations" ON public.insurance_quotations
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.insurance_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_insurance_quotations" ON public.insurance_quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.insurance_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_update_insurance_quotations" ON public.insurance_quotations
  FOR UPDATE TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.insurance_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.insurance_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- ============================================================================
-- 10. HIERARCHICAL RLS POLICIES - LOAN_QUOTATIONS
-- ============================================================================

CREATE POLICY "superadmin_loan_quotations" ON public.loan_quotations
  FOR ALL TO authenticated
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

CREATE POLICY "hierarchy_view_loan_quotations" ON public.loan_quotations
  FOR SELECT TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.loan_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_insert_loan_quotations" ON public.loan_quotations
  FOR INSERT TO authenticated
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.loan_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

CREATE POLICY "hierarchy_update_loan_quotations" ON public.loan_quotations
  FOR UPDATE TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.loan_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.loan_leads
      WHERE assigned_to IN (
        SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
      )
    )
  );

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_quotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_quotations TO authenticated;

-- ============================================================================
-- 12. TRIGGERS FOR UPDATED_AT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_insurance_leads_updated_at
  BEFORE UPDATE ON public.insurance_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_leads_updated_at
  BEFORE UPDATE ON public.loan_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_insurance_quotations_updated_at
  BEFORE UPDATE ON public.insurance_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loan_quotations_updated_at
  BEFORE UPDATE ON public.loan_quotations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 13. LEAD_UID GENERATION FUNCTIONS (per product)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.next_insurance_lead_uid()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_max integer;
  v_uid text;
BEGIN
  SELECT COALESCE(MAX(CAST(REPLACE(lead_uid, 'INS-', '') AS integer))), 1000
  INTO v_max FROM public.insurance_leads;
  v_uid := 'INS-' || (v_max + 1);
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_loan_lead_uid()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_max integer;
  v_uid text;
BEGIN
  SELECT COALESCE(MAX(CAST(REPLACE(lead_uid, 'LON-', '') AS integer))), 2000
  INTO v_max FROM public.loan_leads;
  v_uid := 'LON-' || (v_max + 1);
  RETURN v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_insurance_lead_uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_loan_lead_uid() TO authenticated;

-- ============================================================================
-- NOTES:
-- - Run this migration AFTER 003_org_roles_hierarchy.sql
-- - The old 'leads' and 'quotations' tables are KEPT for backward compatibility
-- - Application code should be updated to use insurance_leads/loan_leads
-- - Once verified, old tables can be dropped with a follow-up migration
-- ============================================================================