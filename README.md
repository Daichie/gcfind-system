# GCFind

GCFind is a Lost and Found Management System for Gordon College. It allows users to report lost or found items, browse approved listings, submit claim requests, and receive claim/report updates.

## Project Structure

```text
GCFIND-Demo/
├── index.html                 # Landing page / first page users see
├── reset-password.html        # Supabase redirect bridge for password recovery
├── pages/                     # Main HTML pages
├── assets/
│   ├── css/                   # Global and page-specific styles
│   ├── img/                   # Logos, fallback image, and landing background
│   └── js/                    # App scripts and feature modules
├── api/                       # Vercel serverless API routes
├── supabase/                  # Supabase config and SQL files
├── docs/                      # Archived documentation
└── package.json
```

## Landing Page

The landing page is `index.html`. It appears first before the login page and includes:

- Official GCFind logo
- Gordon College background image with overlay effect
- About GCFind section
- Key Features section
- How It Works section
- Get Started/Login button that redirects to `pages/login.html`

## Supabase Redirect URL

For password reset, keep this redirect URL in Supabase:

```text
https://gcfind-system.vercel.app/reset-password.html
```

If testing locally, also add:

```text
http://localhost:3000/reset-password.html
```

## Deployment

1. Upload or push this project to Vercel.
2. Make sure Supabase URL Configuration uses the correct Site URL:

```text
https://gcfind-system.vercel.app
```

3. Add the password reset redirect URL shown above.
4. Test login, registration, forgot password, reset password, reporting, dashboard, and admin/staff pages.

## Notes

- The root `reset-password.html` file is intentionally kept because Supabase password reset links redirect there.
- Main working pages are inside the `/pages` folder.
- Assets are centralized under `/assets`.
