
-- GCFind Staff / Faculty Panel RLS Fix
-- Run this in Supabase SQL Editor if Staff Panel still shows 0 pending reports/claims.
-- This allows authenticated faculty_staff users to read pending reports, claims, and notifications.

-- Make sure profiles has role = 'faculty_staff' for staff/faculty accounts.

-- ITEM REPORTS: allow staff to read pending reports
drop policy if exists "Faculty staff can read pending item reports" on public.item_reports;
create policy "Faculty staff can read pending item reports"
on public.item_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'faculty_staff'
  )
);

-- CLAIM REQUESTS: allow staff to read pending claim requests
drop policy if exists "Faculty staff can read claim requests" on public.claim_requests;
create policy "Faculty staff can read claim requests"
on public.claim_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'faculty_staff'
  )
);

-- CLAIM REQUESTS: allow staff to approve/reject claim requests
drop policy if exists "Faculty staff can update claim requests" on public.claim_requests;
create policy "Faculty staff can update claim requests"
on public.claim_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'faculty_staff'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'faculty_staff'
  )
);

-- ITEM REPORTS: allow staff to approve/reject reports
drop policy if exists "Faculty staff can update item reports" on public.item_reports;
create policy "Faculty staff can update item reports"
on public.item_reports
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'faculty_staff'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'faculty_staff'
  )
);

-- NOTIFICATIONS: allow staff to read notifications targeted to faculty_staff role or their own account
drop policy if exists "Faculty staff can read their notifications" on public.notifications;
create policy "Faculty staff can read their notifications"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or user_id = auth.uid()
  or receiver_id = auth.uid()
  or recipient_role = 'faculty_staff'
  or role = 'faculty_staff'
  or target_role = 'faculty_staff'
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'faculty_staff'
      and (
        recipient_role = 'faculty_staff'
        or role = 'faculty_staff'
        or target_role = 'faculty_staff'
      )
  )
);

-- NOTIFICATIONS: allow staff to mark/delete their own notifications
drop policy if exists "Faculty staff can update their notifications" on public.notifications;
create policy "Faculty staff can update their notifications"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or user_id = auth.uid()
  or receiver_id = auth.uid()
  or recipient_role = 'faculty_staff'
  or role = 'faculty_staff'
  or target_role = 'faculty_staff'
)
with check (
  recipient_user_id = auth.uid()
  or user_id = auth.uid()
  or receiver_id = auth.uid()
  or recipient_role = 'faculty_staff'
  or role = 'faculty_staff'
  or target_role = 'faculty_staff'
);

drop policy if exists "Faculty staff can delete their notifications" on public.notifications;
create policy "Faculty staff can delete their notifications"
on public.notifications
for delete
to authenticated
using (
  recipient_user_id = auth.uid()
  or user_id = auth.uid()
  or receiver_id = auth.uid()
  or recipient_role = 'faculty_staff'
  or role = 'faculty_staff'
  or target_role = 'faculty_staff'
);
