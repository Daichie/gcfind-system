-- Run this in Supabase SQL Editor for final restore + reporter name fixes


create table if not exists deleted_records_archive (
 id uuid default gen_random_uuid() primary key,
 source_table text,
 original_record_id text,
 record_data jsonb,
 deleted_at timestamp default now(),
 restored_at timestamp
);



-- GCFind Reporter Name Fix / Profile Backfill
-- Run this if item details show UUID instead of the reporter name.

-- 1) Check reports that have no matching profile:
select r.id, r.item_name, r.user_id
from public.item_reports r
left join public.profiles p on p.id = r.user_id
where p.id is null;

-- 2) Check profile names:
select id, email, full_name, role, department
from public.profiles
order by created_at desc;

-- 3) If a profile exists but has no name, update it manually, example:
-- update public.profiles
-- set full_name = 'Student Name'
-- where email = 'student1@gordoncollege.edu.ph';

-- 4) Optional: add reporter snapshot columns so old reports keep display names even if profile lookup fails.
alter table public.item_reports
add column if not exists reporter_name text,
add column if not exists reporter_email text;

-- 5) Backfill current reports with profile names/emails where possible:
update public.item_reports r
set reporter_name = coalesce(r.reporter_name, p.full_name),
    reporter_email = coalesce(r.reporter_email, p.email)
from public.profiles p
where r.user_id = p.id;



-- ===================== GCFind v2.8.6 Request Ticket + Staff Verification SQL =====================

create table if not exists public.request_tickets (
  id uuid default gen_random_uuid() primary key,
  requested_by uuid references auth.users(id) on delete set null,
  requester_email text,
  requester_name text,
  requester_role text,
  message text not null,
  status text default 'Pending',
  admin_response text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.request_tickets enable row level security;

drop policy if exists "admins and system admins can manage request tickets" on public.request_tickets;
create policy "admins and system admins can manage request tickets"
on public.request_tickets
for all
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role in ('admin', 'system_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role in ('admin', 'system_admin')
  )
);

drop policy if exists "requester can view own request tickets" on public.request_tickets;
create policy "requester can view own request tickets"
on public.request_tickets
for select
using (requested_by = auth.uid());

-- Allow faculty/staff to verify/approve pending reports.
drop policy if exists "faculty staff can verify item reports" on public.item_reports;
create policy "faculty staff can verify item reports"
on public.item_reports
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role in ('faculty_staff', 'admin', 'system_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role in ('faculty_staff', 'admin', 'system_admin')
  )
);
