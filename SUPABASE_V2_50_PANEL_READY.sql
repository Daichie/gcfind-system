-- GCFind v2.50 PANEL READY SQL FIX
-- Purpose: fix permanent notification delete/read, request ticket delete/read,
-- and Staff/CSSU/Admin approve/update permissions.
-- Run this ONCE in Supabase SQL Editor, then refresh the app.
--
-- This SQL avoids old fallback column references like user_id/receiver_id on notifications
-- because those columns may not exist in your schema.

begin;

-- =========================================================
-- 1) NOTIFICATIONS TABLE
-- =========================================================
alter table if exists public.notifications enable row level security;

-- Add the standard columns used by the current GCFind JS if they are missing.
alter table public.notifications add column if not exists recipient_user_id uuid;
alter table public.notifications add column if not exists recipient_email text;
alter table public.notifications add column if not exists recipient_role text;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists related_id text;
alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists created_at timestamptz default now();

drop policy if exists "gcfind_notifications_select_v50" on public.notifications;
create policy "gcfind_notifications_select_v50"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        recipient_role = p.role
        or (p.role = 'admin' and recipient_role in ('admin','cssu','security'))
        or (p.role = 'system_admin' and recipient_role = 'system_admin')
        or (p.role = 'faculty_staff' and recipient_role = 'faculty_staff')
      )
  )
);

drop policy if exists "gcfind_notifications_insert_v50" on public.notifications;
create policy "gcfind_notifications_insert_v50"
on public.notifications
for insert
to authenticated
with check (true);

drop policy if exists "gcfind_notifications_update_v50" on public.notifications;
create policy "gcfind_notifications_update_v50"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        recipient_role = p.role
        or (p.role = 'admin' and recipient_role in ('admin','cssu','security'))
        or (p.role = 'system_admin' and recipient_role = 'system_admin')
        or (p.role = 'faculty_staff' and recipient_role = 'faculty_staff')
      )
  )
)
with check (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        recipient_role = p.role
        or (p.role = 'admin' and recipient_role in ('admin','cssu','security'))
        or (p.role = 'system_admin' and recipient_role = 'system_admin')
        or (p.role = 'faculty_staff' and recipient_role = 'faculty_staff')
      )
  )
);

drop policy if exists "gcfind_notifications_delete_v50" on public.notifications;
create policy "gcfind_notifications_delete_v50"
on public.notifications
for delete
to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        recipient_role = p.role
        or (p.role = 'admin' and recipient_role in ('admin','cssu','security'))
        or (p.role = 'system_admin' and recipient_role = 'system_admin')
        or (p.role = 'faculty_staff' and recipient_role = 'faculty_staff')
      )
  )
);

-- =========================================================
-- 2) REQUEST TICKETS
-- =========================================================
alter table if exists public.request_tickets enable row level security;
alter table public.request_tickets add column if not exists requested_by uuid;
alter table public.request_tickets add column if not exists requester_email text;
alter table public.request_tickets add column if not exists message text;
alter table public.request_tickets add column if not exists admin_response text;
alter table public.request_tickets add column if not exists status text default 'Pending';
alter table public.request_tickets add column if not exists created_at timestamptz default now();
alter table public.request_tickets add column if not exists updated_at timestamptz default now();

drop policy if exists "gcfind_request_tickets_select_v50" on public.request_tickets;
create policy "gcfind_request_tickets_select_v50"
on public.request_tickets
for select
to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','system_admin')
  )
);

drop policy if exists "gcfind_request_tickets_insert_v50" on public.request_tickets;
create policy "gcfind_request_tickets_insert_v50"
on public.request_tickets
for insert
to authenticated
with check (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or requested_by is null
);

drop policy if exists "gcfind_request_tickets_update_v50" on public.request_tickets;
create policy "gcfind_request_tickets_update_v50"
on public.request_tickets
for update
to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','system_admin')
  )
)
with check (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','system_admin')
  )
);

drop policy if exists "gcfind_request_tickets_delete_v50" on public.request_tickets;
create policy "gcfind_request_tickets_delete_v50"
on public.request_tickets
for delete
to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','system_admin')
  )
);

-- =========================================================
-- 3) ITEM REPORTS
-- =========================================================
alter table if exists public.item_reports enable row level security;
alter table public.item_reports add column if not exists status text default 'Pending';
alter table public.item_reports add column if not exists reporter_email text;
alter table public.item_reports add column if not exists reporter_name text;

drop policy if exists "gcfind_item_reports_staff_update_v50" on public.item_reports;
create policy "gcfind_item_reports_staff_update_v50"
on public.item_reports
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

drop policy if exists "gcfind_item_reports_authenticated_insert_v50" on public.item_reports;
create policy "gcfind_item_reports_authenticated_insert_v50"
on public.item_reports
for insert
to authenticated
with check (true);

-- =========================================================
-- 4) CLAIM REQUESTS
-- =========================================================
alter table if exists public.claim_requests enable row level security;
alter table public.claim_requests add column if not exists status text default 'Pending';
alter table public.claim_requests add column if not exists claimant_id uuid;
alter table public.claim_requests add column if not exists claimant_email text;
alter table public.claim_requests add column if not exists claimant_name text;
alter table public.claim_requests add column if not exists user_deleted_at timestamptz;
alter table public.claim_requests add column if not exists updated_at timestamptz default now();

drop policy if exists "gcfind_claim_requests_select_v50" on public.claim_requests;
create policy "gcfind_claim_requests_select_v50"
on public.claim_requests
for select
to authenticated
using (
  claimant_id = auth.uid()
  or lower(coalesce(claimant_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('faculty_staff','admin','system_admin')
  )
);

drop policy if exists "gcfind_claim_requests_insert_v50" on public.claim_requests;
create policy "gcfind_claim_requests_insert_v50"
on public.claim_requests
for insert
to authenticated
with check (
  claimant_id = auth.uid()
  or lower(coalesce(claimant_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or claimant_id is null
);

drop policy if exists "gcfind_claim_requests_update_v50" on public.claim_requests;
create policy "gcfind_claim_requests_update_v50"
on public.claim_requests
for update
to authenticated
using (
  claimant_id = auth.uid()
  or lower(coalesce(claimant_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('faculty_staff','admin','system_admin')
  )
)
with check (
  claimant_id = auth.uid()
  or lower(coalesce(claimant_email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('faculty_staff','admin','system_admin')
  )
);

commit;

-- Optional but recommended: Supabase Dashboard > Database > Replication/Realtime
-- Enable Realtime for: notifications, item_reports, claim_requests, request_tickets
