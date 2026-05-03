create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text unique not null,
  role text not null default 'student' check (role in ('student','faculty_staff','admin','system_admin')),
  department text default 'General',
  created_at timestamptz default now()
);

create table if not exists item_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  item_name text not null,
  description text,
  category text,
  type text check (type in ('Lost','Found')),
  location text,
  date_reported date,
  image_url text,
  status text default 'Pending' check (status in ('Pending','Approved','Rejected','Claimed','Returned')),
  created_at timestamptz default now()
);

create table if not exists claim_requests (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references item_reports(id) on delete cascade,
  claimant_id uuid references auth.users(id) on delete cascade,
  claim_message text,
  status text default 'Pending' check (status in ('Pending','Approved','Rejected')),
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table item_reports enable row level security;
alter table claim_requests enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "profiles select own" on profiles;
drop policy if exists "profiles insert own" on profiles;
drop policy if exists "profiles update own" on profiles;
drop policy if exists "approved reports visible" on item_reports;
drop policy if exists "users insert own reports" on item_reports;
drop policy if exists "users update own pending reports" on item_reports;
drop policy if exists "users view own claims" on claim_requests;
drop policy if exists "users insert own claims" on claim_requests;
drop policy if exists "users insert own logs" on audit_logs;
drop policy if exists "admins can read all profiles" on profiles;
drop policy if exists "admins can read all reports" on item_reports;
drop policy if exists "admins can update all reports" on item_reports;
drop policy if exists "admins can delete reports" on item_reports;
drop policy if exists "admins can read all claims" on claim_requests;
drop policy if exists "admins can update all claims" on claim_requests;
drop policy if exists "admins can read all logs" on audit_logs;
drop policy if exists "admins can insert audit logs" on audit_logs;

create policy "profiles select own"
on profiles for select
to authenticated
using (auth.uid() = id);

create policy "profiles insert own"
on profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles update own"
on profiles for update
to authenticated
using (auth.uid() = id);

create policy "approved reports visible"
on item_reports for select
to authenticated
using (status = 'Approved' or status = 'Claimed' or status = 'Returned' or auth.uid() = user_id);

create policy "users insert own reports"
on item_reports for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users update own pending reports"
on item_reports for update
to authenticated
using (auth.uid() = user_id and status = 'Pending');

create policy "users view own claims"
on claim_requests for select
to authenticated
using (auth.uid() = claimant_id);

create policy "users insert own claims"
on claim_requests for insert
to authenticated
with check (auth.uid() = claimant_id);

create policy "users insert own logs"
on audit_logs for insert
to authenticated
with check (auth.uid() = actor_id);

create policy "admins can read all profiles"
on profiles for select
to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

create policy "admins can read all reports"
on item_reports for select
to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

create policy "admins can update all reports"
on item_reports for update
to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

create policy "admins can delete reports"
on item_reports for delete
to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

create policy "admins can read all claims"
on claim_requests for select
to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

create policy "admins can update all claims"
on claim_requests for update
to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

create policy "admins can read all logs"
on audit_logs for select
to authenticated
using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

create policy "admins can insert audit logs"
on audit_logs for insert
to authenticated
with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','system_admin')));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, department)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    coalesce(new.raw_user_meta_data->>'department', 'General')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = excluded.role,
        department = excluded.department;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();


-- safer admin helper to avoid recursive profile policies
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin','system_admin')
  );
$$;

drop policy if exists "admins can read all profiles" on profiles;
create policy "admins can read all profiles"
on profiles for select
to authenticated
using (public.is_admin(auth.uid()));

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid references item_reports(id) on delete set null,
  message_text text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table messages enable row level security;

drop policy if exists "users read own messages" on messages;
drop policy if exists "users send messages" on messages;
drop policy if exists "users update received messages" on messages;

create policy "users read own messages"
on messages for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "users send messages"
on messages for insert
to authenticated
with check (auth.uid() = sender_id);

create policy "users update received messages"
on messages for update
to authenticated
using (auth.uid() = receiver_id);


-- Support staff helper
create or replace function public.is_support(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and role in ('faculty_staff', 'admin', 'system_admin')
  );
$$;


drop policy if exists "support can read all profiles" on public.profiles;
create policy "support can read all profiles"
on public.profiles
for select
to authenticated
using (public.is_support(auth.uid()));

drop policy if exists "support can read all reports" on public.item_reports;
create policy "support can read all reports"
on public.item_reports
for select
to authenticated
using (public.is_support(auth.uid()));

drop policy if exists "support can read all claims" on public.claim_requests;
create policy "support can read all claims"
on public.claim_requests
for select
to authenticated
using (public.is_support(auth.uid()));


drop policy if exists "authenticated can read basic profiles" on public.profiles;
create policy "authenticated can read basic profiles"
on public.profiles
for select
to authenticated
using (true);

create table if not exists deleted_records_archive (
 id uuid default gen_random_uuid() primary key,
 source_table text,
 original_record_id text,
 record_data jsonb,
 deleted_at timestamp default now(),
 restored_at timestamp
);


-- Optional reporter snapshot columns
alter table public.item_reports add column if not exists reporter_name text, add column if not exists reporter_email text;
