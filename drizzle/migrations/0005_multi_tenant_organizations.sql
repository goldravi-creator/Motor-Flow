-- 1. Organizations (one private workspace per client company)
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

-- 2. Membership: which profiles belong to which organization
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

-- 3. Helper functions (created before any policy that uses them)
CREATE OR REPLACE FUNCTION public.my_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id FROM public.organization_members
  WHERE profile_id = auth.uid()
  ORDER BY created_at
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND profile_id = auth.uid()
  )
$$;

-- 4. Tenant column on every shared table (nullable first for safe backfill)
ALTER TABLE public.leads ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.customers ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.campaigns ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.tasks ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.payments ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.audit_logs ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.integration_settings ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- 5. Auto-stamp organization_id on insert when the app does not send it
CREATE OR REPLACE FUNCTION public.set_organization_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.my_organization_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leads_org BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER trg_customers_org BEFORE INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER trg_campaigns_org BEFORE INSERT ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER trg_tasks_org BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER trg_payments_org BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER trg_audit_logs_org BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();
CREATE TRIGGER trg_integration_settings_org BEFORE INSERT ON public.integration_settings FOR EACH ROW EXECUTE FUNCTION public.set_organization_id();

-- 6. Backfill: existing demo workspace becomes "MotorFlow HQ"
INSERT INTO public.organizations (id, name)
VALUES ('0fa00000-0000-4000-8000-000000000001', 'MotorFlow HQ');

INSERT INTO public.organization_members (organization_id, profile_id)
SELECT '0fa00000-0000-4000-8000-000000000001', id FROM public.profiles
ON CONFLICT DO NOTHING;

UPDATE public.leads SET organization_id = '0fa00000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE public.customers SET organization_id = '0fa00000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE public.campaigns SET organization_id = '0fa00000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE public.tasks SET organization_id = '0fa00000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE public.payments SET organization_id = '0fa00000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE public.audit_logs SET organization_id = '0fa00000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;
UPDATE public.integration_settings SET organization_id = '0fa00000-0000-4000-8000-000000000001' WHERE organization_id IS NULL;

-- 7. Signup trigger: brand-new clients get their own private workspace and become its Super Admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.email)
  ON CONFLICT (id) DO NOTHING;

  -- Only self-serve signups (no roles yet) get a fresh workspace; invited members keep theirs
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = new.id) THEN
    INSERT INTO public.organizations (name)
    VALUES (coalesce(nullif(new.raw_user_meta_data ->> 'company_name', ''), split_part(new.email, '@', 2), 'My Company'))
    RETURNING id INTO v_org;

    INSERT INTO public.organization_members (organization_id, profile_id)
    VALUES (v_org, new.id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END;
$$;

-- 8. RLS on the two new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own organization" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_member_of(id));
CREATE POLICY "admins update own organization" ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_member_of(id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (public.is_member_of(id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')));

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read organization members" ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "self or org admins add members" ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() OR (public.is_member_of(organization_id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "org admins update members" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (public.is_member_of(organization_id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "org admins remove members" ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')));

-- 9. Replace open policies with organization-scoped ones

-- profiles: only see people in your own company
DROP POLICY IF EXISTS authenticated_all ON public.profiles;
CREATE POLICY "read organization profiles" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.profile_id = profiles.id AND public.is_member_of(om.organization_id)
  ));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "org admins update profiles" ON public.profiles FOR UPDATE TO authenticated
  USING ((public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.profile_id = profiles.id AND public.is_member_of(om.organization_id)
  ));
CREATE POLICY "org admins add profiles" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin'));

-- user_roles: scoped to your company
DROP POLICY IF EXISTS "read own or admins" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "read own or org admins" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR ((public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.profile_id = user_roles.user_id AND public.is_member_of(om.organization_id)
  )));
CREATE POLICY "org admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.profile_id = user_roles.user_id AND public.is_member_of(om.organization_id)
  ))
  WITH CHECK ((public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')) AND (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.profile_id = user_roles.user_id AND public.is_member_of(om.organization_id)
  )));

-- leads: managers see the whole company pipeline; agents/telecallers see their own or unassigned
DROP POLICY IF EXISTS authenticated_all ON public.leads;
CREATE POLICY "org members read visible leads" ON public.leads FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR assigned_to = auth.uid() OR assigned_to IS NULL
  ));
CREATE POLICY "org members create leads" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "update visible leads" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR assigned_to = auth.uid() OR assigned_to IS NULL
  ))
  WITH CHECK (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR assigned_to = auth.uid() OR assigned_to IS NULL
  ));
CREATE POLICY "managers delete leads" ON public.leads FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
  ));

-- customers
DROP POLICY IF EXISTS authenticated_all ON public.customers;
CREATE POLICY "org members read customers" ON public.customers FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "org members create customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "org members update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id)) WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "managers delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
  ));

-- campaigns
DROP POLICY IF EXISTS authenticated_all ON public.campaigns;
CREATE POLICY "org members read campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "org members create campaigns" ON public.campaigns FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "org members update campaigns" ON public.campaigns FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id)) WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "managers delete campaigns" ON public.campaigns FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
  ));

-- tasks: agents see their own or unassigned, managers see all
DROP POLICY IF EXISTS authenticated_all ON public.tasks;
CREATE POLICY "org members read visible tasks" ON public.tasks FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR assigned_to = auth.uid() OR assigned_to IS NULL
  ));
CREATE POLICY "org members create tasks" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "update visible tasks" ON public.tasks FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR assigned_to = auth.uid() OR assigned_to IS NULL
  ))
  WITH CHECK (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR assigned_to = auth.uid() OR assigned_to IS NULL
  ));
CREATE POLICY "delete visible tasks" ON public.tasks FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR assigned_to = auth.uid() OR assigned_to IS NULL
  ));

-- payments
DROP POLICY IF EXISTS authenticated_all ON public.payments;
CREATE POLICY "org members read payments" ON public.payments FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id));
CREATE POLICY "org members create payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "org members update payments" ON public.payments FOR UPDATE TO authenticated
  USING (public.is_member_of(organization_id)) WITH CHECK (public.is_member_of(organization_id));
CREATE POLICY "managers delete payments" ON public.payments FOR DELETE TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
  ));

-- audit logs: read restricted to company admins/managers, members can write
DROP POLICY IF EXISTS "admins and managers read audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS authenticated_insert ON public.audit_logs;
CREATE POLICY "org admins and managers read audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
  ));
CREATE POLICY "org members insert audit logs" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (organization_id IS NULL OR public.is_member_of(organization_id));

-- integration settings: private per company, admins only
DROP POLICY IF EXISTS "admins read integrations" ON public.integration_settings;
DROP POLICY IF EXISTS "admins manage integrations" ON public.integration_settings;
CREATE POLICY "org admins read integrations" ON public.integration_settings FOR SELECT TO authenticated
  USING (public.is_member_of(organization_id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "org admins manage integrations" ON public.integration_settings FOR ALL TO authenticated
  USING (public.is_member_of(organization_id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (public.is_member_of(organization_id) AND (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin')));

-- 10. Lead child tables: follow the lead's visibility inside the company
DROP POLICY IF EXISTS authenticated_all ON public.lead_activities;
CREATE POLICY "org members manage lead activities" ON public.lead_activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_activities.lead_id AND public.is_member_of(l.organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR l.assigned_to = auth.uid() OR l.assigned_to IS NULL
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_activities.lead_id AND public.is_member_of(l.organization_id)));

DROP POLICY IF EXISTS authenticated_all ON public.notes;
CREATE POLICY "org members manage notes" ON public.notes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = notes.lead_id AND public.is_member_of(l.organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR l.assigned_to = auth.uid() OR l.assigned_to IS NULL
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = notes.lead_id AND public.is_member_of(l.organization_id)));

DROP POLICY IF EXISTS authenticated_all ON public.documents;
CREATE POLICY "org members manage documents" ON public.documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = documents.lead_id AND public.is_member_of(l.organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR l.assigned_to = auth.uid() OR l.assigned_to IS NULL
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = documents.lead_id AND public.is_member_of(l.organization_id)));

DROP POLICY IF EXISTS authenticated_all ON public.whatsapp_messages;
CREATE POLICY "org members manage whatsapp messages" ON public.whatsapp_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = whatsapp_messages.lead_id AND public.is_member_of(l.organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR l.assigned_to = auth.uid() OR l.assigned_to IS NULL
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = whatsapp_messages.lead_id AND public.is_member_of(l.organization_id)));

DROP POLICY IF EXISTS authenticated_all ON public.call_records;
CREATE POLICY "org members manage call records" ON public.call_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = call_records.lead_id AND public.is_member_of(l.organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR l.assigned_to = auth.uid() OR l.assigned_to IS NULL
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = call_records.lead_id AND public.is_member_of(l.organization_id)));

DROP POLICY IF EXISTS authenticated_all ON public.quotations;
CREATE POLICY "org members manage quotations" ON public.quotations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = quotations.lead_id AND public.is_member_of(l.organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR l.assigned_to = auth.uid() OR l.assigned_to IS NULL
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = quotations.lead_id AND public.is_member_of(l.organization_id)));

DROP POLICY IF EXISTS authenticated_all ON public.applications;
CREATE POLICY "org members manage applications" ON public.applications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = applications.lead_id AND public.is_member_of(l.organization_id) AND (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sales_manager')
    OR l.assigned_to = auth.uid() OR l.assigned_to IS NULL
  )))
  WITH CHECK (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = applications.lead_id AND public.is_member_of(l.organization_id)));