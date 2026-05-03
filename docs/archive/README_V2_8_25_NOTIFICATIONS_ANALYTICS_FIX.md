# GCFind v2.8.25 Notifications + Analytics Fix

## What was fixed

### 1. Notification delete
- Delete buttons now show clearer errors when RLS blocks the action.
- New role-based notifications are now generated per user when possible, so deleting one notification will not remove it for everyone in the same role.
- User dashboard, navbar dropdown, staff panel, and admin panel notification delete flows were hardened.

### 2. Analytics computation
Analytics now recalculates from **all current report records** instead of only reacting to the last action.

Report analytics uses workflow milestones:
- Pending = reports still pending
- Approved = reports approved, claimed, or returned
- Rejected = rejected reports
- Claimed = claimed or returned reports
- Returned = returned reports

This means previous workflow progress does not disappear when an item moves from Approved to Claimed or Returned. Percentages are always computed as:

`category count / total reports * 100`

Example: if there are 4 reports and 1 is claimed, Claimed = 25%. If that claimed report was previously approved, Approved also remains included as a workflow milestone.

## Required Supabase step
Run this SQL once in Supabase SQL Editor:

`supabase-v2-8-25-notifications-analytics-fix.sql`

## Brevo configuration
No Brevo changes are required.

## Deployment
Upload the contents of `GCFIND-demo` to the same GitHub repository. Vercel will auto redeploy.
