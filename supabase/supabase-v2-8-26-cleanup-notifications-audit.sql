-- GCFind v2.8.26 Cleanup Fixes
-- Run this once in Supabase SQL Editor before testing the updated files.

-- 1) Allow users to hide/delete their own claim update cards from their dashboard
--    without deleting the security/admin claim record.
ALTER TABLE public.claim_requests
ADD COLUMN IF NOT EXISTS user_deleted_at timestamptz;

-- 2) Notification delete policy: users can delete their own notifications.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications') THEN
    DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
    CREATE POLICY "Users can delete their own notifications"
    ON public.notifications
    FOR DELETE
    TO authenticated
    USING (recipient_user_id = auth.uid());
  END IF;
END $$;

-- 3) Claim update dismiss policy: users can hide their own claim update cards.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='claim_requests') THEN
    DROP POLICY IF EXISTS "Claimants can hide own claim updates" ON public.claim_requests;
    CREATE POLICY "Claimants can hide own claim updates"
    ON public.claim_requests
    FOR UPDATE
    TO authenticated
    USING (claimant_id = auth.uid())
    WITH CHECK (claimant_id = auth.uid());
  END IF;
END $$;
