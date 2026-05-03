-- GCFind v2.8.23 Notification delete support
-- Run this once in Supabase SQL Editor.

alter table public.notifications enable row level security;

-- Allow users to delete their own notifications.
-- Also allows role-based notifications to be deleted by users with that role.
drop policy if exists "users can delete own notifications" on public.notifications;
create policy "users can delete own notifications"
on public.notifications
for delete
to authenticated
using (
  recipient_user_id = auth.uid()
  or recipient_role = (select role from public.profiles where id = auth.uid())
);

-- Optional safety index for faster notification dropdown queries.
create index if not exists notifications_recipient_user_created_idx
on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_recipient_role_created_idx
on public.notifications (recipient_role, created_at desc);
