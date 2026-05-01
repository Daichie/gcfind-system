# GCFind v2.8.18 Admin Tools Deployment Notes

## What was fixed
- Create Account now calls a secure Vercel serverless function.
- Send Reset Password now calls a secure Vercel serverless function.
- Recover Account now has working per-account actions:
  - Send Reset Link
  - Copy Email
- Recover Deleted Data now restores archived deleted reports, as long as the archive SQL has been installed.

## Required Vercel Environment Variables
Add these in Vercel Project Settings > Environment Variables:

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SITE_URL

SITE_URL example:
https://your-gcfind-site.vercel.app

Never place the service role key in frontend JS.

## Required Supabase SQL
Run this once in Supabase SQL Editor:

supabase-v2-8-18-admin-tools.sql

## Important Security Note
If your Brevo SMTP key was shown in screenshots or chat, revoke/delete that SMTP key in Brevo and generate a fresh one before final deployment.
