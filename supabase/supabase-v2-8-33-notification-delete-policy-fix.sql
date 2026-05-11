-- GCFind v2.8.33 Notification Delete Policy Fix
-- Run this in Supabase SQL Editor if notification delete does not remove rows.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (
  recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  OR recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- Optional indexes for faster bell/user notification queries.
CREATE INDEX IF NOT EXISTS notifications_recipient_user_created_idx
ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_email_created_idx
ON public.notifications (recipient_email, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_role_created_idx
ON public.notifications (recipient_role, created_at DESC);
