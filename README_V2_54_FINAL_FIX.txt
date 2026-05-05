
GCFind v2.54 Final Action Fix

IMPORTANT:
1. Run SUPABASE_V2_54_FINAL_ACTION_SQL.sql in Supabase SQL Editor.
2. Refresh local site with Ctrl+F5.
3. Test locally first. Vercel is NOT required to test these issues.

Fixed focus:
- Staff/Faculty Claim Verification buttons (Verify / Approve Claim and Reject Claim)
- Notification Delete / Mark Read buttons
- CSSU Request Ticket Updates Delete
- System Admin Request Tickets Delete
- Recover Deleted Data Restore/Delete
- Staff notifications generated for new reports and new claim requests
- Uses actual notification columns: recipient_user_id, recipient_role, title, message, type, related_id, is_read

Note:
The SQL is demo-stable/permissive for authenticated users to stop RLS from blocking your panel demo.
Tighten policies later after demonstration.
