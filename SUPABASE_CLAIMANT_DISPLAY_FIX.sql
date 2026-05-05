
-- GCFind v2.43 Claimant Display Fix
-- Run this once in Supabase SQL Editor if Staff Panel still shows "Unknown claimant" or "Claimant".

alter table public.claim_requests
add column if not exists claimant_name text;

alter table public.claim_requests
add column if not exists claimant_email text;

-- Optional backfill from profiles for existing claim requests.
update public.claim_requests cr
set
  claimant_name = coalesce(cr.claimant_name, p.full_name),
  claimant_email = coalesce(cr.claimant_email, p.email)
from public.profiles p
where cr.claimant_id = p.id
  and (cr.claimant_name is null or cr.claimant_email is null);
