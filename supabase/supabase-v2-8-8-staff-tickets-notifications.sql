-- GCFind v2.8.8 Staff Panel + Request Ticket Notifications

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_role text check (recipient_role in ('student','faculty_staff','admin','system_admin')),
  title text not null default 'Notification',
  message text not null default '',
  type text default 'info',
  related_id text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "users can read own notifications" on public.notifications;
create policy "users can read own notifications"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or recipient_role = (select role from public.profiles where id = auth.uid())
);

drop policy if exists "users can mark own notifications read" on public.notifications;
create policy "users can mark own notifications read"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or recipient_role = (select role from public.profiles where id = auth.uid())
)
with check (
  recipient_user_id = auth.uid()
  or recipient_role = (select role from public.profiles where id = auth.uid())
);

drop policy if exists "support can create notifications" on public.notifications;
create policy "support can create notifications"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('faculty_staff','admin','system_admin')
  )
  or recipient_user_id = auth.uid()
);

-- Make sure request tickets can be created by CSSU/admin and viewed by requester.
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
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin','system_admin'))
)
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('admin','system_admin'))
);

drop policy if exists "requester can create request tickets" on public.request_tickets;
create policy "requester can create request tickets"
on public.request_tickets
for insert
to authenticated
with check (requested_by = auth.uid());

drop policy if exists "requester can view own request tickets" on public.request_tickets;
create policy "requester can view own request tickets"
on public.request_tickets
for select
to authenticated
using (requested_by = auth.uid());

-- Staff can read and update reports for verification support.
drop policy if exists "faculty staff can verify item reports" on public.item_reports;
create policy "faculty staff can verify item reports"
on public.item_reports
for update
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('faculty_staff','admin','system_admin'))
)
with check (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role in ('faculty_staff','admin','system_admin'))
);
