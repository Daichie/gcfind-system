-- GCFind Claim Delete Policy
-- Run this only if Delete claim request fails due to RLS/policy error.

drop policy if exists "admin can delete claim requests" on public.claim_requests;

create policy "admin can delete claim requests"
on public.claim_requests
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role in ('admin', 'system_admin')
  )
);
