-- ============================================================================
-- ORGANIZATION SETUP FUNCTIONS
-- ============================================================================
-- These functions handle organization creation on user signup
-- ============================================================================

-- Function to create organization and member for new user
CREATE OR REPLACE FUNCTION public.create_organization_for_user(
  p_user_id uuid,
  p_org_name text,
  p_user_full_name text,
  p_user_email text,
  p_product_access text DEFAULT 'both'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Validate product_access
  IF p_product_access NOT IN ('insurance', 'loan', 'both') THEN
    RAISE EXCEPTION 'Invalid product_access: %', p_product_access;
  END IF;
  
  -- Create organization with product_access
  INSERT INTO public.organizations (name, product_access)
  VALUES (p_org_name, p_product_access)
  RETURNING id INTO v_org_id;
  
  -- Create organization member (owner/admin)
  INSERT INTO public.organization_members (organization_id, profile_id, org_role)
  VALUES (v_org_id, p_user_id, 'client_admin');
  
  -- Create user profile if not exists
  INSERT INTO public.profiles (id, full_name, email, active)
  VALUES (p_user_id, p_user_full_name, p_user_email, true)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    active = true;
END;
$$;

-- Function to check if user is platform superadmin (by email)
-- IMPORTANT: Replace 'your-email@example.com' with YOUR actual email
CREATE OR REPLACE FUNCTION public.check_and_set_superadmin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_email text;
  v_is_superadmin boolean := false;
BEGIN
  -- Get current user's email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  -- CHECK: Replace this with YOUR email address
  IF v_user_email = 'your-email@example.com' THEN
    v_is_superadmin := true;
  END IF;
  
  -- If superadmin, ensure role exists
  IF v_is_superadmin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (auth.uid(), 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;

-- Trigger to auto-set superadmin on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Call the superadmin check
  PERFORM public.check_and_set_superadmin();
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- MANUAL SUPERADMIN SETUP
-- ============================================================================
-- Run this function manually after deploying to set yourself as superadmin
-- Usage: SELECT public.set_superadmin('your-email@example.com');
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_superadmin(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', p_email;
  END IF;
  
  -- Grant super_admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RAISE NOTICE 'Superadmin role granted to %', p_email;
END;
$$;

-- Also create a function to check current user's superadmin status
CREATE OR REPLACE FUNCTION public.check_my_superadmin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN public.is_superadmin();
END;
$$;