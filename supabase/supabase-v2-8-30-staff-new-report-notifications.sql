-- GCFind v2.8.30 Staff New Report Notifications
-- Run this only if Staff users cannot receive or read new report notifications.
-- This complements supabase-v2-8-30-notifications-display-fix.sql.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Ensure staff can read notifications addressed to the faculty_staff role.
DROP POLICY IF EXISTS "Staff can read faculty staff notifications" ON public.notifications;
CREATE POLICY "Staff can read faculty staff notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- Allow authenticated users to create workflow notifications when submitting reports.
-- For stricter production security, limit this to inserts where recipient_role = 'faculty_staff'.
DROP POLICY IF EXISTS "Users can create report workflow notifications" ON public.notifications;
CREATE POLICY "Users can create report workflow notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  recipient_role = 'faculty_staff'
  OR recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
