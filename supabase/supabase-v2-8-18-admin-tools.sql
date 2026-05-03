-- GCFind v2.8.18 System Administrator Tools
-- Run this ONCE in Supabase SQL Editor before testing recover deleted data.

create table if not exists public.deleted_records_archive (
  id uuid default gen_random_uuid() primary key,
  source_table text not null,
  original_record_id text not null,
  record_data jsonb not null,
  deleted_at timestamptz default now(),
  restored_at timestamptz
);

alter table public.deleted_records_archive enable row level security;

drop policy if exists "system admins can read deleted archive" on public.deleted_records_archive;
create policy "system admins can read deleted archive"
on public.deleted_records_archive
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'system_admin'
  )
);

drop policy if exists "system admins can insert deleted archive" on public.deleted_records_archive;
create policy "system admins can insert deleted archive"
on public.deleted_records_archive
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'system_admin'
  )
);

drop policy if exists "system admins can update deleted archive" on public.deleted_records_archive;
create policy "system admins can update deleted archive"
on public.deleted_records_archive
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'system_admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'system_admin'
  )
);

-- Make sure System Administrator can restore archived item_reports.
drop policy if exists "system admins can restore item reports" on public.item_reports;
create policy "system admins can restore item reports"
on public.item_reports
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'system_admin'
  )
);

-- Ensure System Administrator can delete reports after archiving.
drop policy if exists "system admins can delete item reports" on public.item_reports;
create policy "system admins can delete item reports"
on public.item_reports
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role = 'system_admin'
  )
);
