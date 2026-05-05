
-- GCFind v2.52 ACTIONS FIXED SQL
-- Run this in Supabase SQL Editor, then refresh your local site.
-- This fixes RLS blocking for:
-- - notification delete/read
-- - staff/faculty claim approve/reject
-- - CSSU/System Admin request ticket delete
-- - recover deleted data restore/delete

-- Required columns used by GCFind
alter table public.notifications add column if not exists recipient_user_id uuid;
alter table public.notifications add column if not exists recipient_email text;
alter table public.notifications add column if not exists recipient_role text;
alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists related_id text;

alter table public.claim_requests add column if not exists updated_at timestamptz default now();
alter table public.item_reports add column if not exists updated_at timestamptz default now();

-- Enable RLS if not already enabled
alter table public.notifications enable row level security;
alter table public.claim_requests enable row level security;
alter table public.item_reports enable row level security;
alter table public.request_tickets enable row level security;
alter table public.deleted_records_archive enable row level security;

-- =========================
-- NOTIFICATIONS
-- =========================
drop policy if exists "GCFind v252 notifications select" on public.notifications;
create policy "GCFind v252 notifications select"
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
      or (p.role = 'faculty_staff' and notifications.recipient_role in ('faculty_staff','staff'))
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
    )
  )
);

drop policy if exists "GCFind v252 notifications update" on public.notifications;
create policy "GCFind v252 notifications update"
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
      or (p.role = 'faculty_staff' and notifications.recipient_role in ('faculty_staff','staff'))
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
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
      or (p.role = 'faculty_staff' and notifications.recipient_role in ('faculty_staff','staff'))
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
    )
  )
);

drop policy if exists "GCFind v252 notifications delete" on public.notifications;
create policy "GCFind v252 notifications delete"
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
      or (p.role = 'faculty_staff' and notifications.recipient_role in ('faculty_staff','staff'))
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
    )
  )
);

drop policy if exists "GCFind v252 notifications insert" on public.notifications;
create policy "GCFind v252 notifications insert"
on public.notifications
for insert
to authenticated
with check (true);

-- =========================
-- CLAIM REQUESTS
-- =========================
drop policy if exists "GCFind v252 claims select" on public.claim_requests;
create policy "GCFind v252 claims select"
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

drop policy if exists "GCFind v252 claims update staff admin" on public.claim_requests;
create policy "GCFind v252 claims update staff admin"
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

drop policy if exists "GCFind v252 claims insert own" on public.claim_requests;
create policy "GCFind v252 claims insert own"
on public.claim_requests
for insert
to authenticated
with check (
  claimant_id = auth.uid()
  or lower(coalesce(claimant_email, '')) = lower(auth.jwt() ->> 'email')
  or claimant_id is null
);

drop policy if exists "GCFind v252 claims delete admin" on public.claim_requests;
create policy "GCFind v252 claims delete admin"
on public.claim_requests
for delete
to authenticated
using (
  claimant_id = auth.uid()
  or lower(coalesce(claimant_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

-- =========================
-- ITEM REPORTS
-- =========================
drop policy if exists "GCFind v252 item reports select" on public.item_reports;
create policy "GCFind v252 item reports select"
on public.item_reports
for select
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(reporter_email, '')) = lower(auth.jwt() ->> 'email')
  or status in ('Approved','Claimed','Returned')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
);

drop policy if exists "GCFind v252 item reports update staff admin" on public.item_reports;
create policy "GCFind v252 item reports update staff admin"
on public.item_reports
for update
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(reporter_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
)
with check (
  user_id = auth.uid()
  or lower(coalesce(reporter_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
);

drop policy if exists "GCFind v252 item reports insert own" on public.item_reports;
create policy "GCFind v252 item reports insert own"
on public.item_reports
for insert
to authenticated
with check (
  user_id = auth.uid()
  or lower(coalesce(reporter_email, '')) = lower(auth.jwt() ->> 'email')
  or user_id is null
);

drop policy if exists "GCFind v252 item reports delete admin" on public.item_reports;
create policy "GCFind v252 item reports delete admin"
on public.item_reports
for delete
to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(reporter_email, '')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

-- =========================
-- REQUEST TICKETS
-- =========================
drop policy if exists "GCFind v252 request tickets select" on public.request_tickets;
create policy "GCFind v252 request tickets select"
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

drop policy if exists "GCFind v252 request tickets insert" on public.request_tickets;
create policy "GCFind v252 request tickets insert"
on public.request_tickets
for insert
to authenticated
with check (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(auth.jwt() ->> 'email')
  or requested_by is null
);

drop policy if exists "GCFind v252 request tickets update" on public.request_tickets;
create policy "GCFind v252 request tickets update"
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

drop policy if exists "GCFind v252 request tickets delete" on public.request_tickets;
create policy "GCFind v252 request tickets delete"
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

-- =========================
-- DELETED RECORDS ARCHIVE
-- =========================
drop policy if exists "GCFind v252 deleted archive select" on public.deleted_records_archive;
create policy "GCFind v252 deleted archive select"
on public.deleted_records_archive
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'system_admin'
  )
);

drop policy if exists "GCFind v252 deleted archive update" on public.deleted_records_archive;
create policy "GCFind v252 deleted archive update"
on public.deleted_records_archive
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'system_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'system_admin'
  )
);

drop policy if exists "GCFind v252 deleted archive delete" on public.deleted_records_archive;
create policy "GCFind v252 deleted archive delete"
on public.deleted_records_archive
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'system_admin'
  )
);

drop policy if exists "GCFind v252 deleted archive insert" on public.deleted_records_archive;
create policy "GCFind v252 deleted archive insert"
on public.deleted_records_archive
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

-- Realtime reminder:
-- Supabase Dashboard > Database > Replication/Realtime:
-- enable notifications, item_reports, claim_requests, request_tickets
