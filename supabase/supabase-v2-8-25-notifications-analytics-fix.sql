-- GCFind v2.8.25 Notification delete + analytics support
-- Run this once in Supabase SQL Editor.

-- Make sure the notifications table supports user-specific deletes.
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_role text check (recipient_role in ('student','faculty_staff','admin','system_admin')),
  title text not null default 'Notification',
  message text not null default '',
  type text default 'info',
  related_id text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

-- Users can read notifications addressed directly to them or to their current role.
drop policy if exists "users can read own notifications" on public.notifications;
create policy "users can read own notifications"
on public.notifications
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or recipient_role = (select role from public.profiles where id = auth.uid())
);

-- Users can mark their own notifications as read.
drop policy if exists "users can mark own notifications read" on public.notifications;
create policy "users can mark own notifications read"
on public.notifications
for update
to authenticated
using (
  recipient_user_id = auth.uid()
  or recipient_role = (select role from public.profiles where id = auth.uid())
)
with check (
  recipient_user_id = auth.uid()
  or recipient_role = (select role from public.profiles where id = auth.uid())
);

-- Users can delete notifications addressed to them.
-- Admin/system-admin can also remove role-based notifications when needed.
drop policy if exists "users can delete own notifications" on public.notifications;
create policy "users can delete own notifications"
on public.notifications
for delete
to authenticated
using (
  recipient_user_id = auth.uid()
  or (
    recipient_role = (select role from public.profiles where id = auth.uid())
    and recipient_user_id is null
  )
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin','system_admin')
  )
);

-- Staff/admin/system admin can create notifications.
drop policy if exists "support can create notifications" on public.notifications;
create policy "support can create notifications"
on public.notifications
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('faculty_staff','admin','system_admin')
  )
  or recipient_user_id = auth.uid()
);

create index if not exists notifications_recipient_user_created_idx
on public.notifications (recipient_user_id, created_at desc);

create index if not exists notifications_recipient_role_created_idx
on public.notifications (recipient_role, created_at desc);
