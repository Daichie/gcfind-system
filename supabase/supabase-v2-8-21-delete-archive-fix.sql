-- GCFind v2.8.21 Delete Archive Fix
-- Run this in Supabase SQL Editor if deleting reports shows:
-- "Could not find the 'original_record_id' column of 'deleted_records_archive' in the schema cache"

create table if not exists public.deleted_records_archive (
  id uuid default gen_random_uuid() primary key,
  source_table text,
  original_record_id text,
  record_data jsonb,
  deleted_at timestamptz default now(),
  restored_at timestamptz
);

alter table public.deleted_records_archive
  add column if not exists source_table text default 'item_reports',
  add column if not exists original_record_id text,
  add column if not exists record_data jsonb,
  add column if not exists deleted_at timestamptz default now(),
  add column if not exists restored_at timestamptz;

update public.deleted_records_archive
set source_table = coalesce(source_table, 'item_reports')
where source_table is null;

alter table public.deleted_records_archive enable row level security;

drop policy if exists "system admins can read deleted archive" on public.deleted_records_archive;
create policy "system admins can read deleted archive"
on public.deleted_records_archive
for select
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'system_admin'));

drop policy if exists "system admins can insert deleted archive" on public.deleted_records_archive;
create policy "system admins can insert deleted archive"
on public.deleted_records_archive
for insert
to authenticated
with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'system_admin'));

drop policy if exists "system admins can update deleted archive" on public.deleted_records_archive;
create policy "system admins can update deleted archive"
on public.deleted_records_archive
for update
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'system_admin'))
with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'system_admin'));

drop policy if exists "system admins can delete item reports" on public.item_reports;
create policy "system admins can delete item reports"
on public.item_reports
for delete
to authenticated
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'system_admin'));

drop policy if exists "system admins can restore item reports" on public.item_reports;
create policy "system admins can restore item reports"
on public.item_reports
for insert
to authenticated
with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'system_admin'));

notify pgrst, 'reload schema';
