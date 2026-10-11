-- ============================================================================
-- NOTIFICATIONS SYSTEM
-- ============================================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'lead_assigned',
    'lead_status_changed', 
    'follow_up_due',
    'payment_received',
    'call_scheduled',
    'whatsapp_received',
    'task_assigned',
    'system'
  )),
  title text NOT NULL,
  message text NOT NULL,
  read boolean DEFAULT false,
  related_id uuid,
  related_type text CHECK (related_type IN ('lead', 'customer', 'task', 'payment')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- RLS Policies for notifications
CREATE POLICY "notifications_user_view" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.is_superadmin()
    OR user_id = auth.uid()
    OR user_id IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "notifications_user_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    public.is_superadmin()
    OR user_id = auth.uid()
    OR user_id IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR user_id = auth.uid()
    OR user_id IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
  );

CREATE POLICY "notifications_system_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_superadmin()
    OR user_id IN (
      SELECT get_visible_member_ids FROM public.get_visible_member_ids(auth.uid())
    )
    OR user_id = auth.uid()
  );

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_id uuid DEFAULT NULL,
  p_related_type text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Get organization_id from user
  SELECT om.organization_id INTO v_org_id
  FROM public.organization_members om
  WHERE om.profile_id = p_user_id
  LIMIT 1;
  
  INSERT INTO public.notifications (
    user_id,
    organization_id,
    type,
    title,
    message,
    related_id,
    related_type
  ) VALUES (
    p_user_id,
    v_org_id,
    p_type,
    p_title,
    p_message,
    p_related_id,
    p_related_type
  );
END;
$$;

-- Trigger for lead assignment notifications
CREATE OR REPLACE FUNCTION public.notify_lead_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.assigned_to,
      'lead_assigned',
      'New Lead Assigned',
      'You have been assigned a new lead: ' || NEW.full_name,
      NEW.id,
      'lead'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_lead_assigned ON public.leads;
CREATE TRIGGER trigger_lead_assigned
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_assigned();

-- Trigger for lead status change notifications
CREATE OR REPLACE FUNCTION public.notify_lead_status_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Notify assigned user
    IF NEW.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(
        NEW.assigned_to,
        'lead_status_changed',
        'Lead Status Updated',
        'Lead ' || NEW.full_name || ' status changed from ' || OLD.status || ' to ' || NEW.status,
        NEW.id,
        'lead'
      );
    END IF;
    
    -- Notify manager (team leader / client admin)
    IF OLD.assigned_to IS NOT NULL THEN
      PERFORM public.create_notification(
        OLD.assigned_to,
        'lead_status_changed',
        'Lead Status Updated',
        'Lead ' || NEW.full_name || ' status changed from ' || OLD.status || ' to ' || NEW.status,
        NEW.id,
        'lead'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_lead_status_changed ON public.leads;
CREATE TRIGGER trigger_lead_status_changed
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.notify_lead_status_changed();

-- Trigger for follow-up due notifications (run via cron)
CREATE OR REPLACE FUNCTION public.check_follow_ups()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lead RECORD;
BEGIN
  FOR v_lead IN 
    SELECT l.id, l.full_name, l.assigned_to, l.next_follow_up_at
    FROM public.leads l
    WHERE l.next_follow_up_at IS NOT NULL
      AND l.next_follow_up_at <= now() + interval '1 hour'
      AND l.next_follow_up_at >= now() - interval '1 hour'
      AND l.status NOT IN ('converted', 'lost', 'not_interested', 'invalid', 'duplicate')
  LOOP
    PERFORM public.create_notification(
      v_lead.assigned_to,
      'follow_up_due',
      'Follow-up Due',
      'Follow-up due for lead: ' || v_lead.full_name,
      v_lead.id,
      'lead'
    );
  END LOOP;
END;
$$;

-- Trigger for task assignment
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.assigned_to,
      'task_assigned',
      'New Task Assigned',
      'You have been assigned a new task: ' || NEW.title,
      NEW.id,
      'task'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_task_assigned ON public.tasks;
CREATE TRIGGER trigger_task_assigned
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- Trigger for payment received
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify assigned user of the lead
    IF NEW.lead_id IS NOT NULL THEN
      PERFORM public.create_notification(
        (SELECT assigned_to FROM public.leads WHERE id = NEW.lead_id),
        'payment_received',
        'Payment Received',
        'Payment of ₹' || NEW.amount || ' received for lead',
        NEW.lead_id,
        'lead'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_payment_received ON public.payments;
CREATE TRIGGER trigger_payment_received
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_received();

-- Trigger for WhatsApp message received
CREATE OR REPLACE FUNCTION public.notify_whatsapp_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    PERFORM public.create_notification(
      (SELECT assigned_to FROM public.leads WHERE id = NEW.lead_id),
      'whatsapp_received',
      'New WhatsApp Message',
      'New WhatsApp message from lead',
      NEW.lead_id,
      'lead'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_whatsapp_received ON public.whatsapp_messages;
CREATE TRIGGER trigger_whatsapp_received
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_whatsapp_received();

-- Grant execute
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_follow_ups() TO authenticated;