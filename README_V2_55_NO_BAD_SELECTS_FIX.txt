
GCFind v2.55 No Bad Selects Fix

What changed:
- Removed remaining Supabase SELECT columns that were causing 400 Bad Request:
  reporter_name, reporter_email, claimant_name, claimant_email, and message from tables where your current database screenshots do not show them.
- Staff Panel claim list now uses claim_requests + profiles lookup instead of selecting missing claim columns.
- Student report updates now fetch by user_id only, not reporter_email.
- Staff report alerts now fetch by user_id only, not reporter_email.
- Keeps the v2.54 action stabilizer for approve/reject/delete/restore buttons.

Required:
1. You already ran v2.54 SQL. No new SQL is required for this patch.
2. Replace files with this ZIP.
3. Refresh with Ctrl + F5.
