-- GCFind v2.51 Panel Final Fix
-- Run this in Supabase SQL Editor if delete/restore/approve actions are blocked by RLS.
-- This targets only notifications, request_tickets, item_reports, claim_requests, and deleted_records_archive.

-- Make common notification columns available for the frontend fallback schema.
alter table public.notifications add column if not exists recipient_user_id uuid;
alter table public.notifications add column if not exists recipient_email text;
alter table public.notifications add column if not exists recipient_role text;
alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists related_id text;

alter table public.request_tickets add column if not exists updated_at timestamptz default now();
alter table public.claim_requests add column if not exists updated_at timestamptz default now();
alter table public.claim_requests add column if not exists user_deleted_at timestamptz;
alter table public.deleted_records_archive add column if not exists restored_at timestamptz;

-- Helper predicate pattern: current user's profile role.
-- NOTIFICATIONS
alter table public.notifications enable row level security;

drop policy if exists "GCFind v251 notifications select" on public.notifications;
create policy "GCFind v251 notifications select"
on public.notifications for select to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and (
      p.role = notifications.recipient_role
      or (p.role = 'faculty_staff' and notifications.recipient_role = 'faculty_staff')
      or (p.role = 'admin' and notifications.recipient_role in ('admin','cssu','security'))
      or (p.role = 'system_admin' and notifications.recipient_role = 'system_admin')
    )
  )
);

drop policy if exists "GCFind v251 notifications update" on public.notifications;
create policy "GCFind v251 notifications update"
on public.notifications for update to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
)
with check (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
);

drop policy if exists "GCFind v251 notifications delete" on public.notifications;
create policy "GCFind v251 notifications delete"
on public.notifications for delete to authenticated
using (
  recipient_user_id = auth.uid()
  or lower(coalesce(recipient_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
);

drop policy if exists "GCFind v251 notifications insert" on public.notifications;
create policy "GCFind v251 notifications insert"
on public.notifications for insert to authenticated
with check (true);

-- REQUEST TICKETS
alter table public.request_tickets enable row level security;

drop policy if exists "GCFind v251 request tickets select" on public.request_tickets;
create policy "GCFind v251 request tickets select"
on public.request_tickets for select to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin'))
);

drop policy if exists "GCFind v251 request tickets insert" on public.request_tickets;
create policy "GCFind v251 request tickets insert"
on public.request_tickets for insert to authenticated
with check (
  requested_by = auth.uid()
  or lower(coalesce(requester_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin'))
);

drop policy if exists "GCFind v251 request tickets update" on public.request_tickets;
create policy "GCFind v251 request tickets update"
on public.request_tickets for update to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin'))
)
with check (
  requested_by = auth.uid()
  or lower(coalesce(requester_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin'))
);

drop policy if exists "GCFind v251 request tickets delete" on public.request_tickets;
create policy "GCFind v251 request tickets delete"
on public.request_tickets for delete to authenticated
using (
  requested_by = auth.uid()
  or lower(coalesce(requester_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin'))
);

-- ITEM REPORTS: staff/admin/system_admin can verify/restore/delete; students can read/insert their own.
alter table public.item_reports enable row level security;

drop policy if exists "GCFind v251 item reports select" on public.item_reports;
create policy "GCFind v251 item reports select"
on public.item_reports for select to authenticated
using (
  user_id = auth.uid()
  or lower(coalesce(reporter_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
  or status in ('Approved','Claimed','Returned')
);

drop policy if exists "GCFind v251 item reports insert" on public.item_reports;
create policy "GCFind v251 item reports insert"
on public.item_reports for insert to authenticated
with check (
  user_id = auth.uid()
  or user_id is null
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin'))
);

drop policy if exists "GCFind v251 item reports update" on public.item_reports;
create policy "GCFind v251 item reports update"
on public.item_reports for update to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
)
with check (
  user_id = auth.uid()
  or user_id is null
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
);

drop policy if exists "GCFind v251 item reports delete" on public.item_reports;
create policy "GCFind v251 item reports delete"
on public.item_reports for delete to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin'))
);

-- CLAIM REQUESTS: staff/admin/system_admin can verify approve/reject; students can read their own.
alter table public.claim_requests enable row level security;

drop policy if exists "GCFind v251 claim requests select" on public.claim_requests;
create policy "GCFind v251 claim requests select"
on public.claim_requests for select to authenticated
using (
  claimant_id = auth.uid()
  or lower(coalesce(claimant_email,'')) = lower(auth.jwt() ->> 'email')
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
);

drop policy if exists "GCFind v251 claim requests insert" on public.claim_requests;
create policy "GCFind v251 claim requests insert"
on public.claim_requests for insert to authenticated
with check (claimant_id = auth.uid() or claimant_id is null);

drop policy if exists "GCFind v251 claim requests update" on public.claim_requests;
create policy "GCFind v251 claim requests update"
on public.claim_requests for update to authenticated
using (
  claimant_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
)
with check (
  claimant_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('faculty_staff','admin','system_admin'))
);

drop policy if exists "GCFind v251 claim requests delete" on public.claim_requests;
create policy "GCFind v251 claim requests delete"
on public.claim_requests for delete to authenticated
using (
  claimant_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin'))
);

-- DELETED RECORDS ARCHIVE: system admin recovery tools.
alter table public.deleted_records_archive enable row level security;

drop policy if exists "GCFind v251 archive system admin select" on public.deleted_records_archive;
create policy "GCFind v251 archive system admin select"
on public.deleted_records_archive for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

drop policy if exists "GCFind v251 archive system admin insert" on public.deleted_records_archive;
create policy "GCFind v251 archive system admin insert"
on public.deleted_records_archive for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

drop policy if exists "GCFind v251 archive system admin update" on public.deleted_records_archive;
create policy "GCFind v251 archive system admin update"
on public.deleted_records_archive for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

drop policy if exists "GCFind v251 archive system admin delete" on public.deleted_records_archive;
create policy "GCFind v251 archive system admin delete"
on public.deleted_records_archive for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

-- Realtime reminder: enable these in Supabase Dashboard > Database > Replication/Realtime:
-- notifications, item_reports, claim_requests, request_tickets, deleted_records_archive
