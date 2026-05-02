# GCFind v2.8.26 Cleanup: Notifications, Claim Updates, Pagination, Audit Logs

## What changed

1. User dashboard notifications now support delete and remove instantly from the UI.
2. Claim update cards now have a Delete button. Deleting hides the update from the user's dashboard while keeping the original claim record for admin/security accountability.
3. Pagination transitions were applied consistently to Submitted Reports, Claim Requests, Audit Logs, Account List, and System Admin Audit Logs.
4. Audit logs are now cleaned for presentation:
   - user-friendly action labels
   - cleaned details
   - no raw UUIDs shown as user names
   - important logs only

## Required Supabase SQL

Run this file in Supabase SQL Editor:

```sql
supabase-v2-8-26-cleanup-notifications-audit.sql
```

## Brevo

No Brevo changes are required for this update.

## Deployment steps

1. Upload the contents of `GCFIND-demo` to your existing GitHub repo.
2. Commit changes.
3. Wait for Vercel auto redeploy.
4. Refresh the deployed site with Ctrl + F5.
5. Test:
   - notification delete
   - claim update delete
   - Submitted Reports pagination
   - Claim Requests pagination
   - Audit Logs pagination
   - System Admin Audit Logs display

## Notes

Claim updates are hidden using `claim_requests.user_deleted_at` instead of physically deleting the record. This keeps admin/security records complete while removing clutter from the user's dashboard.
