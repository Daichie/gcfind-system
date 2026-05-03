# GCFind v2.8.31 Loading Freeze Fix

Fixed:
- Added safe boot try/catch/finally so the loading overlay cannot remain stuck during page initialization.
- Added loading fallback timeout.
- Wrapped user/admin login in try/catch/finally so loading always hides after success/error.
- Added profile fetch timeout to avoid infinite loading if Supabase profile query is slow.
- Added CSS safety override for hidden loading overlay.

If login still fails, open DevTools Console and check the specific error message.
