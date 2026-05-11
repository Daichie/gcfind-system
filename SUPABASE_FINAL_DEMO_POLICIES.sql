
-- GCFind FINAL Demo Policies / Helpers
-- Run only if Supabase blocks Staff claim updates, notifications, request tickets, or archive actions.

alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists related_id text;
alter table public.claim_requests add column if not exists updated_at timestamptz default now();
alter table public.item_reports add column if not exists updated_at timestamptz default now();
alter table public.request_tickets add column if not exists updated_at timestamptz default now();

alter table public.notifications enable row level security;
alter table public.claim_requests enable row level security;
alter table public.item_reports enable row level security;
alter table public.request_tickets enable row level security;
alter table public.deleted_records_archive enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "GCFind final notifications all authenticated" on public.notifications;
create policy "GCFind final notifications all authenticated"
on public.notifications for all to authenticated using (true) with check (true);

drop policy if exists "GCFind final claim_requests all authenticated" on public.claim_requests;
create policy "GCFind final claim_requests all authenticated"
on public.claim_requests for all to authenticated using (true) with check (true);

drop policy if exists "GCFind final item_reports all authenticated" on public.item_reports;
create policy "GCFind final item_reports all authenticated"
on public.item_reports for all to authenticated using (true) with check (true);

drop policy if exists "GCFind final request_tickets all authenticated" on public.request_tickets;
create policy "GCFind final request_tickets all authenticated"
on public.request_tickets for all to authenticated using (true) with check (true);

drop policy if exists "GCFind final deleted_records_archive all authenticated" on public.deleted_records_archive;
create policy "GCFind final deleted_records_archive all authenticated"
on public.deleted_records_archive for all to authenticated using (true) with check (true);

drop policy if exists "GCFind final audit_logs all authenticated" on public.audit_logs;
create policy "GCFind final audit_logs all authenticated"
on public.audit_logs for all to authenticated using (true) with check (true);
