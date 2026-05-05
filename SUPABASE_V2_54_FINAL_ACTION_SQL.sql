
-- GCFind v2.54 FINAL ACTION SQL
-- Run this in Supabase SQL Editor, then refresh local site with Ctrl+F5.
-- This uses your ACTUAL visible columns and gives authenticated users the required action access
-- for the demo: notifications delete/read, claim approve/reject, ticket delete, archive restore/delete.

-- 1) Make sure helper columns exist
alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists related_id text;
alter table public.notifications add column if not exists created_at timestamptz default now();

alter table public.claim_requests add column if not exists updated_at timestamptz default now();

alter table public.item_reports add column if not exists updated_at timestamptz default now();

alter table public.request_tickets add column if not exists updated_at timestamptz default now();
alter table public.request_tickets add column if not exists status text default 'Pending';
alter table public.request_tickets add column if not exists response text;
alter table public.request_tickets add column if not exists responded_at timestamptz;
alter table public.request_tickets add column if not exists resolved_at timestamptz;

alter table public.deleted_records_archive add column if not exists restored_at timestamptz;

-- 2) Enable RLS
alter table public.notifications enable row level security;
alter table public.claim_requests enable row level security;
alter table public.item_reports enable row level security;
alter table public.request_tickets enable row level security;
alter table public.deleted_records_archive enable row level security;

-- 3) Remove older GCFind policies that may conflict
drop policy if exists "GCFind v252 notifications select" on public.notifications;
drop policy if exists "GCFind v252 notifications update" on public.notifications;
drop policy if exists "GCFind v252 notifications delete" on public.notifications;
drop policy if exists "GCFind v252 notifications insert" on public.notifications;
drop policy if exists "GCFind v253 notifications select" on public.notifications;
drop policy if exists "GCFind v253 notifications update" on public.notifications;
drop policy if exists "GCFind v253 notifications delete" on public.notifications;
drop policy if exists "GCFind v253 notifications insert" on public.notifications;

drop policy if exists "GCFind v252 claims select" on public.claim_requests;
drop policy if exists "GCFind v252 claims update staff admin" on public.claim_requests;
drop policy if exists "GCFind v252 claims insert own" on public.claim_requests;
drop policy if exists "GCFind v252 claims delete admin" on public.claim_requests;
drop policy if exists "GCFind v253 claim requests select" on public.claim_requests;
drop policy if exists "GCFind v253 claim requests insert" on public.claim_requests;
drop policy if exists "GCFind v253 claim requests update" on public.claim_requests;
drop policy if exists "GCFind v253 claim requests delete" on public.claim_requests;

drop policy if exists "GCFind v252 item reports select" on public.item_reports;
drop policy if exists "GCFind v252 item reports update staff admin" on public.item_reports;
drop policy if exists "GCFind v252 item reports insert own" on public.item_reports;
drop policy if exists "GCFind v252 item reports delete admin" on public.item_reports;
drop policy if exists "GCFind v253 item reports select" on public.item_reports;
drop policy if exists "GCFind v253 item reports update" on public.item_reports;
drop policy if exists "GCFind v253 item reports insert" on public.item_reports;
drop policy if exists "GCFind v253 item reports delete" on public.item_reports;

drop policy if exists "GCFind v252 request tickets select" on public.request_tickets;
drop policy if exists "GCFind v252 request tickets insert" on public.request_tickets;
drop policy if exists "GCFind v252 request tickets update" on public.request_tickets;
drop policy if exists "GCFind v252 request tickets delete" on public.request_tickets;
drop policy if exists "GCFind v253 request tickets select" on public.request_tickets;
drop policy if exists "GCFind v253 request tickets insert" on public.request_tickets;
drop policy if exists "GCFind v253 request tickets update" on public.request_tickets;
drop policy if exists "GCFind v253 request tickets delete" on public.request_tickets;

drop policy if exists "GCFind v252 deleted archive select" on public.deleted_records_archive;
drop policy if exists "GCFind v252 deleted archive update" on public.deleted_records_archive;
drop policy if exists "GCFind v252 deleted archive delete" on public.deleted_records_archive;
drop policy if exists "GCFind v252 deleted archive insert" on public.deleted_records_archive;
drop policy if exists "GCFind v253 deleted archive select" on public.deleted_records_archive;
drop policy if exists "GCFind v253 deleted archive update" on public.deleted_records_archive;
drop policy if exists "GCFind v253 deleted archive delete" on public.deleted_records_archive;

-- 4) DEMO-STABLE policies.
-- These are intentionally permissive for authenticated users so your demo actions work reliably.
-- You can tighten after the panel/demo.

drop policy if exists "GCFind v254 notifications all authenticated" on public.notifications;
create policy "GCFind v254 notifications all authenticated"
on public.notifications
for all
to authenticated
using (true)
with check (true);

drop policy if exists "GCFind v254 claim requests all authenticated" on public.claim_requests;
create policy "GCFind v254 claim requests all authenticated"
on public.claim_requests
for all
to authenticated
using (true)
with check (true);

drop policy if exists "GCFind v254 item reports all authenticated" on public.item_reports;
create policy "GCFind v254 item reports all authenticated"
on public.item_reports
for all
to authenticated
using (true)
with check (true);

drop policy if exists "GCFind v254 request tickets all authenticated" on public.request_tickets;
create policy "GCFind v254 request tickets all authenticated"
on public.request_tickets
for all
to authenticated
using (true)
with check (true);

drop policy if exists "GCFind v254 deleted archive all authenticated" on public.deleted_records_archive;
create policy "GCFind v254 deleted archive all authenticated"
on public.deleted_records_archive
for all
to authenticated
using (true)
with check (true);

-- 5) Optional realtime support
-- In Supabase Dashboard > Database > Replication/Realtime, enable:
-- notifications, item_reports, claim_requests, request_tickets
