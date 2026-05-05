
GCFind v2.58 FORCE-FIRST ACTION FIX

This patch directly targets the remaining problem:
- Buttons showing in UI but not firing real actions.
- Older broken event listeners blocking newer fixes.
- Remaining item_reports select column 400 errors.

What changed:
- A force-first capture click handler is placed at the TOP of admin.js.
- It handles Staff claim approve/reject before old handlers can block it.
- It handles Staff notification mark read/delete, including synthetic IDs.
- It handles CSSU Request Ticket Updates delete.
- It handles System Admin request ticket delete.
- It handles Recover Deleted Data restore/delete.
- It handles Submitted Reports status/delete.
- Main project table selects are changed to select('*') to avoid missing-column 400 errors.

Instructions:
1. Use this ZIP.
2. Run SUPABASE_V2_58_FORCE_FIRST_ACTION_FIX.sql only if needed.
3. Close old local tab.
4. Reopen with Go Live.
5. Press Ctrl + F5.
6. Test Staff Panel first.
