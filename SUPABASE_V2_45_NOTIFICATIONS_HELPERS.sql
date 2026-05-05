
-- GCFind v2.45 notification helper SQL
-- Run this in Supabase SQL Editor if notifications do not show, cannot be marked read, or cannot be deleted.

-- Common notification columns used by GCFind.
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

-- Allow logged-in users to read their own notifications or role-based notifications.
drop policy if exists "Users can read own or role notifications" on public.notifications;
create policy "Users can read own or role notifications"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(recipient_email) = lower((auth.jwt() ->> 'email'))
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role = notifications.recipient_role
  )
);

-- Allow logged-in users to mark their own notifications read.
drop policy if exists "Users can update own notification read state" on public.notifications;
create policy "Users can update own notification read state"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(recipient_email) = lower((auth.jwt() ->> 'email'))
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role = notifications.recipient_role
  )
)
with check (
  recipient_user_id = auth.uid()
  or lower(recipient_email) = lower((auth.jwt() ->> 'email'))
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
    and p.role = notifications.recipient_role
  )
);

-- Allow logged-in users to delete their own notification rows.
drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
on public.notifications
for delete
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(recipient_email) = lower((auth.jwt() ->> 'email'))
);

-- Staff/faculty read access for pending task source tables.
drop policy if exists "Faculty staff can read item reports" on public.item_reports;
create policy "Faculty staff can read item reports"
on public.item_reports
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'faculty_staff'
  )
  or user_id = auth.uid()
  or lower(reporter_email) = lower((auth.jwt() ->> 'email'))
);

drop policy if exists "Faculty staff can read claim requests" on public.claim_requests;
create policy "Faculty staff can read claim requests"
on public.claim_requests
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'faculty_staff'
  )
  or claimant_id = auth.uid()
  or lower(claimant_email) = lower((auth.jwt() ->> 'email'))
);
