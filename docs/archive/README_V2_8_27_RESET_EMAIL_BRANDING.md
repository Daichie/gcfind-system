# GCFind v2.8.27 — Reset Password + Email Branding Fix

## What changed
- Improved `reset-password.html` so users see a proper reset UI.
- Added reset-link status message: checking, verified, expired/missing.
- Added show/hide password buttons on the reset password form.
- Removed the unnecessary green environment-variable notice from Create Account.
- Added show/hide password button to the System Administrator Create Account modal.

## Required Supabase configuration
Go to **Supabase Dashboard → Authentication → URL Configuration**.

Set **Site URL** to:

```text
https://gcfind-system.vercel.app
```

Add these **Redirect URLs**:

```text
https://gcfind-system.vercel.app/reset-password.html
https://gcfind-system.vercel.app/login.html
https://gcfind-system.vercel.app/*
```

Important: if Site URL still says `http://localhost:3000`, reset links will open localhost and users will see `ERR_CONNECTION_REFUSED`.

## Required Vercel environment variables
Make sure these exist in Vercel:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SITE_URL
```

`SITE_URL` should be:

```text
https://gcfind-system.vercel.app
```

After editing Vercel environment variables, redeploy the project.

## Supabase email templates
Go to **Supabase Dashboard → Authentication → Email Templates**.

### Password Reset subject
```text
Reset Your GCFind Password
```

### Password Reset body
```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #d9eee4;border-radius:16px;background:#ffffff;color:#0f172a;">
  <div style="text-align:center;margin-bottom:20px;">
    <h2 style="margin:0;color:#047857;">GCFind Password Reset</h2>
    <p style="margin:6px 0 0;color:#475569;">Gordon College Lost and Found Management System</p>
  </div>
  <p>Hello,</p>
  <p>We received a request to reset your GCFind account password. Click the button below to create a new password.</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:bold;">Reset Password</a>
  </p>
  <p style="font-size:13px;color:#64748b;">If you did not request this, you may safely ignore this email.</p>
  <p style="font-size:13px;color:#64748b;">GCFind Support<br/>Gordon College</p>
</div>
```

### Account Verification subject
```text
Confirm Your GCFind Account
```

### Account Verification body
```html
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #d9eee4;border-radius:16px;background:#ffffff;color:#0f172a;">
  <div style="text-align:center;margin-bottom:20px;">
    <h2 style="margin:0;color:#047857;">Welcome to GCFind</h2>
    <p style="margin:6px 0 0;color:#475569;">Gordon College Lost and Found Management System</p>
  </div>
  <p>Hello,</p>
  <p>Please confirm your email address to activate your GCFind account.</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:bold;">Confirm Account</a>
  </p>
  <p style="font-size:13px;color:#64748b;">If you did not create this account, you may ignore this email.</p>
  <p style="font-size:13px;color:#64748b;">GCFind Support<br/>Gordon College</p>
</div>
```

## Brevo sender branding
If Brevo SMTP is already working, no code change is needed.

To improve sender name:
1. Supabase → Authentication → Email SMTP / Custom SMTP
2. Sender name: `GCFind`
3. Sender email: use your verified sender email

A sender profile image/avatar is usually controlled by the mailbox provider and domain reputation/BIMI, not by Supabase or Brevo SMTP alone. The reliable option is to place the GCFind logo inside the email body/template.

## How the reset password flow works
1. System Admin clicks Send Reset Password or Recover Account.
2. `/api/admin-reset-password.js` asks Supabase to send the reset email.
3. Supabase sends the email through Brevo SMTP.
4. User clicks the reset link.
5. Supabase redirects to `/reset-password.html` with recovery tokens.
6. The reset page verifies the session and lets the user set a new password.
7. Supabase updates the password and redirects the user back to login.
