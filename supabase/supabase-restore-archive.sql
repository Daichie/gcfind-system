
create table if not exists deleted_records_archive (
 id uuid default gen_random_uuid() primary key,
 source_table text,
 original_record_id text,
 record_data jsonb,
 deleted_at timestamp default now(),
 restored_at timestamp
);
