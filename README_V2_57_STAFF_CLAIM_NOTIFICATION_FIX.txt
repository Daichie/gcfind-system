
GCFind v2.57 Staff Claim + Notification Fix

Focus:
- Staff Panel Claim Verification Support:
  - Verify / Approve Claim
  - Reject Claim
- Staff claim request notifications:
  - Mark read
  - Delete
- Prevents Supabase 400 errors when synthetic notification IDs like staff-claim-... are clicked.
- Adds delegated button handlers so dynamically rendered buttons stay connected.
- Adds bridge handlers for common admin/CSSU delete/restore/report buttons.

Instructions:
1. Replace your project files with this ZIP.
2. Open local site using Go Live.
3. Press Ctrl + F5.
4. Test Staff Panel first:
   - Claim Verification Support: approve/reject
   - Notifications: mark read/delete
5. If Supabase still shows permission/RLS errors, run:
   SUPABASE_V2_57_STAFF_CLAIM_NOTIFICATION_FIX.sql

Note:
If the console only shows Tailwind CDN or tracking-prevention warnings, those are not related to your broken buttons.
