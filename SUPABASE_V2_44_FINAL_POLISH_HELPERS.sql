
-- GCFind v2.44 final polish SQL helpers
-- Run only if needed.

-- 1) Ensure submitted reports can store reporter name/email for display and notification context.
alter table public.item_reports
add column if not exists reporter_name text;

alter table public.item_reports
add column if not exists reporter_email text;

-- 2) Ensure claim requests can store claimant name/email.
alter table public.claim_requests
add column if not exists claimant_name text;

alter table public.claim_requests
add column if not exists claimant_email text;

-- 3) Backfill claimant name/email for old claim requests.
update public.claim_requests cr
set
  claimant_name = coalesce(cr.claimant_name, p.full_name),
  claimant_email = coalesce(cr.claimant_email, p.email)
from public.profiles p
where cr.claimant_id = p.id
  and (cr.claimant_name is null or cr.claimant_email is null);

-- 4) Backfill reporter name/email for old reports.
update public.item_reports ir
set
  reporter_name = coalesce(ir.reporter_name, p.full_name),
  reporter_email = coalesce(ir.reporter_email, p.email)
from public.profiles p
where ir.user_id = p.id
  and (ir.reporter_name is null or ir.reporter_email is null);
