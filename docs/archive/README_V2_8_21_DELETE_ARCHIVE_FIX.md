# GCFind v2.8.21 Delete Archive Fix

## Fixed
- Delete report error: `original_record_id column ... schema cache`.
- Delete report now saves a recovery copy before deleting.
- Added fallback support if the archive table is still older.
- Removed technical Supabase/SQL wording from the admin UI.

## Required Supabase step
Run this file once in Supabase SQL Editor:

`supabase-v2-8-21-delete-archive-fix.sql`

After running it:
1. Wait 10–30 seconds.
2. Refresh the dashboard with Ctrl + F5.
3. Try deleting a report again.

If the same error appears, sign out and sign back in, then refresh again.
