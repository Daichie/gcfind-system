GCFind v3.77 System Admin Confirm Layer Fix

Fix:
- Confirmation modal now forces z-index 2147483647 with !important.
- Confirmation overlay is re-appended to the end of document.body each time it opens.
- Target issue: System Administration > Create Account > Create Account confirmation appearing behind the Create Account modal.

No changes were made to the working account creation/password flow.
