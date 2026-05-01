# GCFind v2.8.20 Recover Account UI Fix

Changes:
- Recover Account modal now explains what each action does.
- `Send Reset Link` renamed to `Send Password Reset`.
- `Send Password Reset` and `Copy Email` buttons are aligned in one row on wider screens.
- Emails wrap properly so long account emails do not break the modal layout.
- Recovery toast/loading text updated for clarity.

Note:
- `Send Password Reset` sends a Supabase Auth password reset email using the deployed admin API.
- `Copy Email` only copies the account email address for manual follow-up.
