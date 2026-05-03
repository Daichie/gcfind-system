# GCFind v2.8.34 Account Recovery Fix

Updated:
- Removed Temporary Password field from System Administrator Create Account modal.
- Create Account now creates the account and sends a password setup/reset link to the user.
- Reset Password UI remains unchanged at `/pages/reset-password.html`.
- Recover Account modal now only has Copy Email.
- Removed duplicate Send Password Reset button from Recover Account results.

Recommended Supabase Redirect URL:
https://gcfind-system.vercel.app/pages/reset-password.html
