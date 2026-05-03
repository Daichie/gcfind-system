# GCFind v2.8.31 Urgent Fix

Fixed:
- Login page not opening due to JavaScript syntax error in `core.js`.
- Removed duplicate `async async function refreshGlobalNotifications()`.
- Fixed report notification variable issue by using `reportPayload.type`.
- Kept notification logic, Staff Panel, CSSU dashboard, and existing pages intact.

Supabase:
- If not yet done, run `supabase/supabase-v2-8-31-notification-full-fix.sql`.
