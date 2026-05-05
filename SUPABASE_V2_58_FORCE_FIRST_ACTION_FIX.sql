
-- GCFind v2.58 FORCE-FIRST ACTION FIX SQL
-- Run only if you still get permission/RLS errors after replacing the ZIP.
-- This gives authenticated users action access for demo/testing.

alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists related_id text;
alter table public.claim_requests add column if not exists updated_at timestamptz default now();
alter table public.item_reports add column if not exists updated_at timestamptz default now();
alter table public.request_tickets add column if not exists updated_at timestamptz default now();

alter table public.notifications enable row level security;
alter table public.claim_requests enable row level security;
alter table public.item_reports enable row level security;
alter table public.request_tickets enable row level security;
alter table public.deleted_records_archive enable row level security;

drop policy if exists "GCFind v258 notifications all" on public.notifications;
create policy "GCFind v258 notifications all"
on public.notifications for all to authenticated using (true) with check (true);

drop policy if exists "GCFind v258 claim_requests all" on public.claim_requests;
create policy "GCFind v258 claim_requests all"
on public.claim_requests for all to authenticated using (true) with check (true);

drop policy if exists "GCFind v258 item_reports all" on public.item_reports;
create policy "GCFind v258 item_reports all"
on public.item_reports for all to authenticated using (true) with check (true);

drop policy if exists "GCFind v258 request_tickets all" on public.request_tickets;
create policy "GCFind v258 request_tickets all"
on public.request_tickets for all to authenticated using (true) with check (true);

drop policy if exists "GCFind v258 deleted_records_archive all" on public.deleted_records_archive;
create policy "GCFind v258 deleted_records_archive all"
on public.deleted_records_archive for all to authenticated using (true) with check (true);
