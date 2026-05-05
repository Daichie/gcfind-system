
-- GCFind Staff / Faculty Panel RLS Fix
-- Run in Supabase SQL Editor only if Staff Panel cannot read pending reports/claims.
-- Required staff role in public.profiles.role: faculty_staff

drop policy if exists "Faculty staff can read item reports" on public.item_reports;
create policy "Faculty staff can read item reports"
on public.item_reports
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'faculty_staff'
  )
);

drop policy if exists "Faculty staff can read claim requests" on public.claim_requests;
create policy "Faculty staff can read claim requests"
on public.claim_requests
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'faculty_staff'
  )
);

drop policy if exists "Faculty staff can update item reports" on public.item_reports;
create policy "Faculty staff can update item reports"
on public.item_reports
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'faculty_staff'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'faculty_staff'
  )
);

drop policy if exists "Faculty staff can update claim requests" on public.claim_requests;
create policy "Faculty staff can update claim requests"
on public.claim_requests
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'faculty_staff'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role = 'faculty_staff'
  )
);
