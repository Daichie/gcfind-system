
-- GCFind v2.48 Stability Fix SQL
-- Run this in Supabase SQL Editor if:
-- 1) notification delete is blocked
-- 2) CSSU request ticket update delete is blocked
-- 3) Faculty/Staff approve/reject claim request is blocked

-- Make sure required columns exist where possible.
alter table public.notifications
add column if not exists recipient_user_id uuid;

alter table public.notifications
add column if not exists recipient_email text;

alter table public.notifications
add column if not exists recipient_role text;

alter table public.notifications
add column if not exists is_read boolean default false;

alter table public.claim_requests
add column if not exists updated_at timestamptz default now();

-- NOTIFICATIONS: allow logged-in user to read/update/delete own or role notifications.
drop policy if exists "GCFind notifications select own or role" on public.notifications;
create policy "GCFind notifications select own or role"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and (
      p.role = notifications.recipient_role
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
      or (p.role = 'faculty_staff' and notifications.recipient_role = 'faculty_staff')
    )
  )
);

drop policy if exists "GCFind notifications update own or role" on public.notifications;
create policy "GCFind notifications update own or role"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and (
      p.role = notifications.recipient_role
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
      or (p.role = 'faculty_staff' and notifications.recipient_role = 'faculty_staff')
    )
  )
)
with check (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and (
      p.role = notifications.recipient_role
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
      or (p.role = 'faculty_staff' and notifications.recipient_role = 'faculty_staff')
    )
  )
);

drop policy if exists "GCFind notifications delete own or role" on public.notifications;
create policy "GCFind notifications delete own or role"
on public.notifications
for delete
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and (
      p.role = notifications.recipient_role
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
      or (p.role = 'faculty_staff' and notifications.recipient_role = 'faculty_staff')
    )
  )
);

-- CLAIM REQUESTS: allow faculty_staff to read and approve/reject pending claims.
drop policy if exists "GCFind staff can read claim requests" on public.claim_requests;
create policy "GCFind staff can read claim requests"
on public.claim_requests
for select
to authenticated
using (
  claimant_id = auth.uid()
  or lower(coalesce(claimant_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
);

drop policy if exists "GCFind staff can update claim requests" on public.claim_requests;
create policy "GCFind staff can update claim requests"
on public.claim_requests
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
);

-- REQUEST TICKETS: allow CSSU/Admin/System Admin to read/update/delete request ticket updates.
drop policy if exists "GCFind request tickets select own admin system" on public.request_tickets;
create policy "GCFind request tickets select own admin system"
on public.request_tickets
for select
to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

drop policy if exists "GCFind request tickets update admin system" on public.request_tickets;
create policy "GCFind request tickets update admin system"
on public.request_tickets
for update
to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
)
with check (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

drop policy if exists "GCFind request tickets delete admin system own" on public.request_tickets;
create policy "GCFind request tickets delete admin system own"
on public.request_tickets
for delete
to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

-- Realtime reminder:
-- In Supabase Dashboard > Database > Replication/Realtime, enable:
-- notifications, item_reports, claim_requests, request_tickets
