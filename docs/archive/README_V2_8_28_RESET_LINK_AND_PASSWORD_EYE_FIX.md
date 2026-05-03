# GCFind v2.8.28 — Reset Link + Password Eye Fix

## Fixed
- Reset password page now supports Supabase recovery links with either hash tokens (`#access_token`) or PKCE code links (`?code=`).
- Reset page waits longer for Supabase to restore the recovery session before showing an expired-link message.
- Browser-native password reveal controls are hidden on the reset page so only one GCFind eye icon appears.
- Show/hide password buttons remain functional for both New Password and Confirm Password fields.

## Important Supabase configuration
Go to **Supabase → Authentication → URL Configuration** and set:

### Site URL
```text
https://gcfind-system.vercel.app
```

### Redirect URLs
```text
https://gcfind-system.vercel.app/reset-password.html
https://gcfind-system.vercel.app/login.html
https://gcfind-system.vercel.app/*
```

## Important note about expired links
Old reset emails that were already sent before updating the Site URL may still point to `localhost:3000` or may already be expired/used. After uploading this version and updating Supabase URL configuration, send a new reset password email and test using the new email link.

## Brevo
No new Brevo SMTP change is required. Sender name can remain `GCFind`.
