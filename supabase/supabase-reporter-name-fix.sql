
-- GCFind Reporter Name Fix / Profile Backfill
-- Run this if item details show UUID instead of the reporter name.

-- 1) Check reports that have no matching profile:
select r.id, r.item_name, r.user_id
from public.item_reports r
left join public.profiles p on p.id = r.user_id
where p.id is null;

-- 2) Check profile names:
select id, email, full_name, role, department
from public.profiles
order by created_at desc;

-- 3) If a profile exists but has no name, update it manually, example:
-- update public.profiles
-- set full_name = 'Student Name'
-- where email = 'student1@gordoncollege.edu.ph';

-- 4) Optional: add reporter snapshot columns so old reports keep display names even if profile lookup fails.
alter table public.item_reports
add column if not exists reporter_name text,
add column if not exists reporter_email text;

-- 5) Backfill current reports with profile names/emails where possible:
update public.item_reports r
set reporter_name = coalesce(r.reporter_name, p.full_name),
    reporter_email = coalesce(r.reporter_email, p.email)
from public.profiles p
where r.user_id = p.id;
