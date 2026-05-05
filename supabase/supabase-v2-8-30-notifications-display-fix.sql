-- GCFind v2.8.30 Notification Display Fix
-- Run this once in Supabase SQL Editor if notifications are not appearing in the UI.

-- 1) Ensure notifications table has the expected columns used by the frontend.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text,
  recipient_role text,
  title text NOT NULL DEFAULT 'Notification',
  message text NOT NULL DEFAULT '',
  type text DEFAULT 'info',
  related_id text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS recipient_email text,
ADD COLUMN IF NOT EXISTS recipient_role text,
ADD COLUMN IF NOT EXISTS title text DEFAULT 'Notification',
ADD COLUMN IF NOT EXISTS message text DEFAULT '',
ADD COLUMN IF NOT EXISTS type text DEFAULT 'info',
ADD COLUMN IF NOT EXISTS related_id text,
ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2) Users can read notifications addressed to their user id, email, or role.
DROP POLICY IF EXISTS "users can read own notifications" ON public.notifications;
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

-- 3) Users can mark their own notifications as read.
DROP POLICY IF EXISTS "users can mark own notifications read" ON public.notifications;
DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.notifications;
CREATE POLICY "Users can mark own notifications read"
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

-- 4) Staff/admin/system_admin can create notifications for workflow updates.
DROP POLICY IF EXISTS "support can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Support can create notifications" ON public.notifications;
CREATE POLICY "Support can create notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('faculty_staff','admin','system_admin')
  )
  OR recipient_user_id = auth.uid()
  OR lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- 5) Users can delete their own notifications.
DROP POLICY IF EXISTS "users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
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

-- 6) Helpful indexes.
CREATE INDEX IF NOT EXISTS notifications_recipient_user_created_idx
ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_email_created_idx
ON public.notifications (recipient_email, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_role_created_idx
ON public.notifications (recipient_role, created_at DESC);
