
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
