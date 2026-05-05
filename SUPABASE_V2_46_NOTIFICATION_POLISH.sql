
-- GCFind v2.46 Notification Policy Helper
-- Run if CSSU/System Admin bell notifications cannot read/update/delete notifications.

alter table public.notifications
add column if not exists recipient_user_id uuid;

alter table public.notifications
add column if not exists recipient_email text;

alter table public.notifications
add column if not exists recipient_role text;

alter table public.notifications
add column if not exists is_read boolean default false;

alter table public.notifications
add column if not exists type text;

alter table public.notifications
add column if not exists related_id text;

drop policy if exists "Users can read own or role notifications" on public.notifications;
create policy "Users can read own or role notifications"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(recipient_email) = lower((auth.jwt() ->> 'email'))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = notifications.recipient_role
  )
);

drop policy if exists "Users can update own or role notifications" on public.notifications;
create policy "Users can update own or role notifications"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(recipient_email) = lower((auth.jwt() ->> 'email'))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = notifications.recipient_role
  )
)
with check (
  recipient_user_id = auth.uid()
  or lower(recipient_email) = lower((auth.jwt() ->> 'email'))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = notifications.recipient_role
  )
);

drop policy if exists "Users can delete own or role notifications" on public.notifications;
create policy "Users can delete own or role notifications"
on public.notifications
for delete
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(recipient_email) = lower((auth.jwt() ->> 'email'))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = notifications.recipient_role
  )
);

-- Make sure realtime can publish changes from these tables in Supabase Dashboard:
-- Database > Replication > enable realtime for notifications, item_reports, claim_requests, request_tickets.
