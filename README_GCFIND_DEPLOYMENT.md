# GCFind v2.8 Notes

## Important: Multiple accounts in one browser
Supabase stores the active login session in browser localStorage. If you login as CSSU in one tab and Student in another tab using the same browser/profile, the latest login can replace the previous session. This is normal.

For testing different roles at the same time, use:
- normal browser for student,
- incognito/private window for CSSU,
- another browser or another incognito session for System Administrator.

## Realtime updates
This version includes Supabase realtime refresh for reports, claims, and audit logs. Make sure Realtime is enabled for your tables in Supabase if you want automatic refresh.

## Vercel environment variables for real System Admin functions
Add these to Vercel Project Settings > Environment Variables:

SUPABASE_URL=your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=your Supabase service role key
SITE_URL=https://your-vercel-domain.vercel.app

Never place the service role key in frontend JavaScript.

## System Admin functions
- Create Account: uses /api/admin-create-account on Vercel.
- Send Reset Password: uses /api/admin-reset-password on Vercel, with public Supabase fallback.
- Recover Account: searches profile records locally.
- Recover Deleted Data: logs a recovery request and uses backups/audit/export workflow.
