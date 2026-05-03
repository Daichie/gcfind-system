# GCFind v2.8.30 - Landing Page + Feedback Messages

## Added
- New public landing page at `index.html` before login.
- Original student/user dashboard moved to `dashboard.html`.
- Landing page includes:
  - GCFind branding
  - Welcome section
  - Short system description
  - Get Started/Login button
  - Create Account button
  - Responsive layout
  - Background image support via `assets/img/landing-bg.jpg`

## Updated
- User login now redirects to `dashboard.html` after successful login.
- Dashboard/home navigation links updated from `index.html` to `dashboard.html`.
- Role-aware dashboard redirects updated to preserve admin/system-admin routing.
- Added/kept loading, success, and error feedback for key actions:
  - Login
  - Account creation
  - Password reset
  - Report submission
  - Claim request
  - Admin account creation
  - Password reset email sending

## Background Image
- Current landing background uses `assets/img/landing-bg.jpg`.
- Replace this file with your preferred background image using the same filename to keep the page working.

## Deployment Notes
- Re-upload/redeploy the full project to Vercel.
- Supabase Site URL may stay as your Vercel domain.
- Redirect URLs should still include:
  - `https://YOUR-DOMAIN.vercel.app`
  - `https://YOUR-DOMAIN.vercel.app/reset-password.html`
