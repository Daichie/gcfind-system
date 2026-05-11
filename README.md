# GCFind v2.52 Actions Fixed

This patch focuses only on the broken action buttons and Supabase RLS blockers.

Fixed:
- Notification Delete buttons: local-hide fallback + DB delete attempt.
- Student/Staff/CSSU/System Admin notification delete should not come back after refresh in the same browser.
- CSSU Request Ticket Updates Delete: local-hide fallback + DB delete attempt.
- System Admin Request Tickets Delete: local-hide fallback + DB delete attempt.
- Staff/Faculty Claim Verify/Approve and Reject: removed `.select()` after update to avoid RLS SELECT blocking the update result.
- Recover Deleted Data Delete/Restore: local-hide fallback so recovery list updates even if archive RLS blocks delete/update.

Required:
Run `SUPABASE_V2_52_ACTIONS_FIXED.sql` in Supabase SQL Editor, then refresh your local site.

Testing:
- Test locally first. You do NOT need to deploy to Vercel just to test these fixes.
