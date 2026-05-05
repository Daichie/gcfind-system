-- GCFind v2.49
-- Targeted RLS fix for notification delete/read + request ticket sync actions.
-- Affected tables: notifications, request_tickets, item_reports, claim_requests

begin;

-- =========================
-- notifications
-- =========================
alter table if exists public.notifications enable row level security;

drop policy if exists "gcfind_notifications_select_own_or_role" on public.notifications;
create policy "gcfind_notifications_select_own_or_role"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or user_id = auth.uid()
  or receiver_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        notifications.recipient_role = p.role
        or notifications.role = p.role
        or notifications.target_role = p.role
      )
  )
);

drop policy if exists "gcfind_notifications_update_read_own_or_role" on public.notifications;
create policy "gcfind_notifications_update_read_own_or_role"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or user_id = auth.uid()
  or receiver_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        notifications.recipient_role = p.role
        or notifications.role = p.role
        or notifications.target_role = p.role
      )
  )
)
with check (
  recipient_user_id = auth.uid()
  or user_id = auth.uid()
  or receiver_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        notifications.recipient_role = p.role
        or notifications.role = p.role
        or notifications.target_role = p.role
      )
  )
);

drop policy if exists "gcfind_notifications_delete_own_or_role" on public.notifications;
create policy "gcfind_notifications_delete_own_or_role"
on public.notifications
for delete
to authenticated
using (
  recipient_user_id = auth.uid()
  or user_id = auth.uid()
  or receiver_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        notifications.recipient_role = p.role
        or notifications.role = p.role
        or notifications.target_role = p.role
      )
  )
);

-- =========================
-- request_tickets
-- =========================
alter table if exists public.request_tickets enable row level security;

drop policy if exists "gcfind_request_tickets_select_requester_or_system_admin" on public.request_tickets;
create policy "gcfind_request_tickets_select_requester_or_system_admin"
on public.request_tickets
for select
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'system_admin'
  )
);

drop policy if exists "gcfind_request_tickets_insert_authenticated" on public.request_tickets;
create policy "gcfind_request_tickets_insert_authenticated"
on public.request_tickets
for insert
to authenticated
with check (
  requested_by = auth.uid()
  or requested_by is null
);

drop policy if exists "gcfind_request_tickets_update_requester_or_system_admin" on public.request_tickets;
create policy "gcfind_request_tickets_update_requester_or_system_admin"
on public.request_tickets
for update
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'system_admin'
  )
)
with check (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'system_admin'
  )
);

drop policy if exists "gcfind_request_tickets_delete_requester_or_system_admin" on public.request_tickets;
create policy "gcfind_request_tickets_delete_requester_or_system_admin"
on public.request_tickets
for delete
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'system_admin'
  )
);

-- =========================
-- item_reports + claim_requests
-- (stabilize staff verify/approve/reject operations)
-- =========================
alter table if exists public.item_reports enable row level security;
alter table if exists public.claim_requests enable row level security;

drop policy if exists "gcfind_item_reports_update_staff_admin_system_admin" on public.item_reports;
create policy "gcfind_item_reports_update_staff_admin_system_admin"
on public.item_reports
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('faculty_staff', 'admin', 'system_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('faculty_staff', 'admin', 'system_admin')
  )
);

drop policy if exists "gcfind_claim_requests_update_staff_admin_system_admin" on public.claim_requests;
create policy "gcfind_claim_requests_update_staff_admin_system_admin"
on public.claim_requests
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('faculty_staff', 'admin', 'system_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('faculty_staff', 'admin', 'system_admin')
  )
);

commit;
