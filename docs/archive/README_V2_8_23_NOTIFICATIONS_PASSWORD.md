# GCFind v2.8.23 - Notifications + Password Visibility Fix

## Fixed
- Added notification bell icon in the navigation bar.
- Notification dropdown shows account notifications.
- Users can mark notifications as read.
- Users can delete individual notifications.
- User dashboard notification panel also supports notification delete.
- Staff/admin notification cards also support delete.
- Password visibility eye icon now works on login and register forms.
- Works without changing Brevo configuration.

## Required Supabase SQL
Run this file once in Supabase SQL Editor:

`supabase-v2-8-23-notification-delete-policy.sql`

This adds the delete policy for notifications.

## Brevo
No changes required. Existing Brevo SMTP setup remains valid.

## Deployment
1. Extract this package.
2. Open `GCFIND-demo`.
3. Upload/overwrite the contents to the existing GitHub repo.
4. Commit changes.
5. Vercel will redeploy automatically.
6. After deploy, hard refresh the browser with Ctrl + F5.
