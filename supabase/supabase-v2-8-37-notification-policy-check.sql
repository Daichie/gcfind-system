-- GCFind v2.8.37 Targeted Notification Policy Check
-- Run only if notifications still do not display/delete after deploying this fix.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Workflow can create notifications" ON public.notifications;
CREATE POLICY "Workflow can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR recipient_role IN ('student','faculty_staff','admin','system_admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('faculty_staff','admin','system_admin')
  )
);
