# GCFind v2.8.24 — Analytics, Admin Actions, and Password Reset Flow

## What changed

### 1. Analytics consistency
- Report analytics now normalize report statuses before counting.
- Percentages are computed from total submitted reports:
  - Pending % = pending reports / total reports × 100
  - Approved % = approved reports / total reports × 100
  - Rejected % = rejected reports / total reports × 100
  - Claimed % = claimed reports / total reports × 100
  - Returned % = returned reports / total reports × 100
- Claim overview remains separate and is computed from total claim requests only.
- Admin dashboard now has a realtime refresh subscription for `item_reports` and `claim_requests`.

> Note: If there is only 1 record and it is Claimed, the Claimed percentage will correctly show 100%. Once more records exist, the percentage will distribute based on the total.

### 2. System Administrator tools
- Create Account and Send Password Reset continue to use secure Vercel API routes.
- Recover Account can send password reset emails from the user list.
- Recover Deleted Data remains connected to the archive table.

### 3. Password reset page
- Added `reset-password.html`.
- Password reset emails should redirect users to `/reset-password.html` so they can set a new password.

## Required Vercel Environment Variables
Add these in Vercel → Project → Settings → Environment Variables:

```text
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxxxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxxxx
SITE_URL=https://your-vercel-domain.vercel.app
```

Important:
- `SUPABASE_URL` is the base Supabase URL only. Do not include `/rest/v1/`.
- `SUPABASE_ANON_KEY` is the publishable key.
- `SUPABASE_SERVICE_ROLE_KEY` is secret. Never put it in frontend code or GitHub.
- `SITE_URL` must be your deployed Vercel URL.

## Required Supabase Auth URL Configuration
Go to Supabase → Authentication → URL Configuration:

```text
Site URL:
https://your-vercel-domain.vercel.app
```

Add Redirect URLs:

```text
https://your-vercel-domain.vercel.app/login.html
https://your-vercel-domain.vercel.app/reset-password.html
https://your-vercel-domain.vercel.app/*
```

## Required Brevo Configuration
No new Brevo changes are required if SMTP is already working.

Recommended final check:
- Brevo sender is verified.
- Supabase SMTP is enabled.
- Supabase SMTP password uses your active Brevo SMTP key.

## SQL changes
No new SQL is required for this update if you already ran:
- `supabase-v2-8-18-admin-tools.sql`
- `supabase-v2-8-21-delete-archive-fix.sql`
- `supabase-v2-8-23-notification-delete-policy.sql`

## Testing checklist
1. Open Admin dashboard.
2. Approve/reject/claim/return reports.
3. Confirm cards and charts update without page refresh.
4. Open System Admin dashboard.
5. Test Create Account.
6. Test Send Password Reset.
7. Open the reset email and confirm it redirects to `reset-password.html`.
8. Update password and login again.
