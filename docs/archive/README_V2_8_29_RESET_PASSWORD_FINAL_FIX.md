# GCFind v2.8.29 — Reset Password Final Fix

## Fixed files
- `reset-password.html`
- `assets/js/modules/auth.js`
- `assets/js/modules/core.js`
- `api/admin-reset-password.js`

## What was fixed
1. Reset Password UI now accepts both Supabase reset-link formats:
   - `?code=...` PKCE links
   - `#access_token=...&refresh_token=...` implicit recovery links
2. The false “expired link” state was reduced by manually restoring the Supabase recovery session before showing the form.
3. The duplicate Show Password / eye button was fixed. The global password-eye script now skips fields that already have a custom eye button.
4. The admin reset API now uses `SITE_URL` if available, otherwise it falls back to the current deployed domain origin.

## Supabase reminder before testing on Vercel
In Supabase Dashboard → Authentication → URL Configuration, make sure these are allowed:

- Site URL: your Vercel production URL
- Redirect URL: `https://YOUR-VERCEL-DOMAIN.vercel.app/reset-password.html`
- Optional local testing URL: `http://localhost:3000/reset-password.html`

If the Vercel domain changed after redeploy, update the Supabase redirect URL too.
