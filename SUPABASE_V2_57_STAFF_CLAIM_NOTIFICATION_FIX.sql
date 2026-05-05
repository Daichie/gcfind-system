
-- GCFind v2.57 Staff Claim + Notification Action Fix SQL
-- Run this ONLY if buttons still show RLS/permission errors after using the ZIP.
-- It keeps demo behavior stable by allowing authenticated users to update/delete
-- the affected tables during your panel demonstration.

alter table public.notifications enable row level security;
alter table public.claim_requests enable row level security;
alter table public.item_reports enable row level security;
alter table public.request_tickets enable row level security;
alter table public.deleted_records_archive enable row level security;

drop policy if exists "GCFind v257 notifications action access" on public.notifications;
create policy "GCFind v257 notifications action access"
on public.notifications
for all
to authenticated
using (true)
with check (true);

drop policy if exists "GCFind v257 claim requests action access" on public.claim_requests;
create policy "GCFind v257 claim requests action access"
on public.claim_requests
for all
to authenticated
using (true)
with check (true);

drop policy if exists "GCFind v257 item reports action access" on public.item_reports;
create policy "GCFind v257 item reports action access"
on public.item_reports
for all
to authenticated
using (true)
with check (true);

drop policy if exists "GCFind v257 request tickets action access" on public.request_tickets;
create policy "GCFind v257 request tickets action access"
on public.request_tickets
for all
to authenticated
using (true)
with check (true);

drop policy if exists "GCFind v257 deleted archive action access" on public.deleted_records_archive;
create policy "GCFind v257 deleted archive action access"
on public.deleted_records_archive
for all
to authenticated
using (true)
with check (true);
