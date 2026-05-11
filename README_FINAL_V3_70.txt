
GCFind v3.70 STAFF PANEL CLEAN FINAL

Focus of this cleaned build:
1. Staff / Faculty Panel only:
   - Claim Verify / Approve works through one handler.
   - Claim Reject works through one handler.
   - Staff notification Mark Read works.
   - Staff notification Delete works.
   - Staff claim actions add audit log entries when Supabase allows it.
   - Notification deletes add audit log entries when Supabase allows it.

2. Confirmation UI:
   - Uses one global appConfirm() modal style.
   - Removed duplicate Staff claim confirmation source.
   - No browser confirm popup for Staff claim actions.

3. Cleanup:
   - Removed old README_V*.txt files.
   - Removed old SUPABASE_V*.sql and duplicate RLS SQL patch files.
   - Kept one final SQL helper:
     SUPABASE_FINAL_DEMO_POLICIES.sql

Test steps:
1. Open pages/staff-panel.html.
2. Press Ctrl + F5.
3. Console:
   window.GCFIND_ACTION_HOTFIX_VERSION
   Expected:
   gcfind-actions-fix-loaded-v3.70
4. Test:
   - Verify / Approve Claim
   - Reject Claim
   - Mark Read
   - Delete Notification

If Supabase blocks an action, run SUPABASE_FINAL_DEMO_POLICIES.sql.
