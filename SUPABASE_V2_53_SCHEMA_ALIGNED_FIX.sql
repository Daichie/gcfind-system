
-- GCFind v2.53 SCHEMA-ALIGNED FIX
-- Run this in Supabase SQL Editor.
-- This version matches your screenshots:
-- notifications: id, recipient_user_id, recipient_role, title, message, type
-- claim_requests: id, report_id, claimant_id, claim_message, status, created_at
-- request_tickets: id, requested_by, requester_email, requester_name, requester_role, message

-- Safe required columns
alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists related_id text;
alter table public.notifications add column if not exists created_at timestamptz default now();

alter table public.claim_requests add column if not exists updated_at timestamptz default now();
alter table public.request_tickets add column if not exists updated_at timestamptz default now();
alter table public.request_tickets add column if not exists status text default 'Pending';
alter table public.request_tickets add column if not exists response text;
alter table public.request_tickets add column if not exists responded_at timestamptz;
alter table public.request_tickets add column if not exists resolved_at timestamptz;

alter table public.notifications enable row level security;
alter table public.claim_requests enable row level security;
alter table public.item_reports enable row level security;
alter table public.request_tickets enable row level security;
alter table public.deleted_records_archive enable row level security;

-- NOTIFICATIONS
drop policy if exists "GCFind v253 notifications select" on public.notifications;
create policy "GCFind v253 notifications select"
on public.notifications for select to authenticated
using (
  recipient_user_id = auth.uid()
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

drop policy if exists "GCFind v253 notifications insert" on public.notifications;
create policy "GCFind v253 notifications insert"
on public.notifications for insert to authenticated
with check (true);

drop policy if exists "GCFind v253 notifications update" on public.notifications;
create policy "GCFind v253 notifications update"
on public.notifications for update to authenticated
using (
  recipient_user_id = auth.uid()
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

drop policy if exists "GCFind v253 notifications delete" on public.notifications;
create policy "GCFind v253 notifications delete"
on public.notifications for delete to authenticated
using (
  recipient_user_id = auth.uid()
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

-- CLAIM REQUESTS
drop policy if exists "GCFind v253 claim requests select" on public.claim_requests;
create policy "GCFind v253 claim requests select"
on public.claim_requests for select to authenticated
using (
  claimant_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
);

drop policy if exists "GCFind v253 claim requests insert" on public.claim_requests;
create policy "GCFind v253 claim requests insert"
on public.claim_requests for insert to authenticated
with check (claimant_id = auth.uid() or claimant_id is null);

drop policy if exists "GCFind v253 claim requests update" on public.claim_requests;
create policy "GCFind v253 claim requests update"
on public.claim_requests for update to authenticated
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

drop policy if exists "GCFind v253 claim requests delete" on public.claim_requests;
create policy "GCFind v253 claim requests delete"
on public.claim_requests for delete to authenticated
using (
  claimant_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

-- ITEM REPORTS
drop policy if exists "GCFind v253 item reports select" on public.item_reports;
create policy "GCFind v253 item reports select"
on public.item_reports for select to authenticated
using (
  user_id = auth.uid()
  or status in ('Approved','Claimed','Returned')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
);

drop policy if exists "GCFind v253 item reports update" on public.item_reports;
create policy "GCFind v253 item reports update"
on public.item_reports for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('faculty_staff','admin','system_admin')
  )
);

drop policy if exists "GCFind v253 item reports insert" on public.item_reports;
create policy "GCFind v253 item reports insert"
on public.item_reports for insert to authenticated
with check (user_id = auth.uid() or user_id is null);

drop policy if exists "GCFind v253 item reports delete" on public.item_reports;
create policy "GCFind v253 item reports delete"
on public.item_reports for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

-- REQUEST TICKETS
drop policy if exists "GCFind v253 request tickets select" on public.request_tickets;
create policy "GCFind v253 request tickets select"
on public.request_tickets for select to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

drop policy if exists "GCFind v253 request tickets insert" on public.request_tickets;
create policy "GCFind v253 request tickets insert"
on public.request_tickets for insert to authenticated
with check (requested_by = auth.uid() or requested_by is null);

drop policy if exists "GCFind v253 request tickets update" on public.request_tickets;
create policy "GCFind v253 request tickets update"
on public.request_tickets for update to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
)
with check (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

drop policy if exists "GCFind v253 request tickets delete" on public.request_tickets;
create policy "GCFind v253 request tickets delete"
on public.request_tickets for delete to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin','system_admin')
  )
);

-- DELETED RECORDS ARCHIVE
drop policy if exists "GCFind v253 deleted archive select" on public.deleted_records_archive;
create policy "GCFind v253 deleted archive select"
on public.deleted_records_archive for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'system_admin'));

drop policy if exists "GCFind v253 deleted archive update" on public.deleted_records_archive;
create policy "GCFind v253 deleted archive update"
on public.deleted_records_archive for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'system_admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'system_admin'));

drop policy if exists "GCFind v253 deleted archive delete" on public.deleted_records_archive;
create policy "GCFind v253 deleted archive delete"
on public.deleted_records_archive for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'system_admin'));
