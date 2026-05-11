-- GCFind v2.8.31 System Admin Ticket Notifications
-- Run only if the right-side System Administrator Notifications panel still does not show notification rows.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "System admins can read ticket notifications" ON public.notifications;
CREATE POLICY "System admins can read ticket notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "System admins can create ticket notifications" ON public.notifications;
CREATE POLICY "System admins can create ticket notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  recipient_role IN ('system_admin','admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin','system_admin','faculty_staff')
  )
);
