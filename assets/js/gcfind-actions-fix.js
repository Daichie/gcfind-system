
// GCFind v3.71 Staff Panel Clean Final
(function () {
  if (window.__GCFIND_ACTION_FIX_V370__) return;
  window.__GCFIND_ACTION_FIX_V370__ = true;
  window.GCFIND_ACTION_HOTFIX_VERSION = "gcfind-actions-fix-loaded-v3.73";
  console.log("[GCFind] gcfind-actions-fix.js loaded v3.71");

  
function gcfindIsSyntheticNotificationId(id) {
  const value = String(id || '');
  return value.startsWith('staff-') || value.startsWith('report-') || value.startsWith('claim-');
}

function client() {
    return window.supabaseClient || window.sb || null;
  }

  function closestRow(btn) {
    return btn.closest("article, tr, .notification-card, .gc-notification-card, .request-ticket-card, .ticket-card, .border-t, .p-4");
  }

  async function ask(message, confirmText = "Confirm", tone = "default") {
    if (typeof window.appConfirm === "function") {
      return await window.appConfirm(message, { confirmText, tone });
    }
    return window.confirm(message);
  }

  function success(message) {
    if (typeof window.showSuccess === "function") return window.showSuccess(message, { position: "top-right" });
    console.log(message);
  }

  function fail(message) {
    if (typeof window.showError === "function") return window.showError(message, { position: "top-right", duration: 7000 });
    alert(message);
  }

  function saveHidden(key, id) {
    if (!id) return;
    try {
      const arr = JSON.parse(localStorage.getItem(key) || "[]").map(String);
      if (!arr.includes(String(id))) arr.push(String(id));
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (_) {}
  }

  function markClaimProcessed(id) {
    saveHidden("gcfind_processed_staff_claims", id);
    saveHidden("gcfind_hidden_staff_claim_ids", id);
    saveHidden("gcfind_deleted_staff_notifications", `staff-claim-${id}`);
    saveHidden("gcfind_staff_deleted_alerts", `staff-claim-${id}`);
  }

  async function writeAudit(action, entityType, entityId, details) {
    const sb = client();
    if (!sb) return;
    try {
      const user = (typeof window.getUser === "function" ? window.getUser() : null) || {};
      await sb.from("audit_logs").insert({
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        actor_email: user.email || null,
        actor_role: user.role || null,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.warn("[GCFind v3.71] audit log skipped:", err.message || err);
    }
  }

  async function updateClaim(id, status, btn) {
    console.log("[GCFind v3.71] updateClaim", { id, status });
    const isApprove = status === "Approved";
    const ok = await ask(
      `${isApprove ? "Approve" : "Reject"} this claim request?`,
      isApprove ? "Approve Claim" : "Reject Claim",
      isApprove ? "default" : "danger"
    );
    if (!ok) return;

    const sb = client();
    if (!sb) return fail("Supabase client not loaded.");

    let { error } = await sb.from("claim_requests").update({
      status,
      updated_at: new Date().toISOString()
    }).eq("id", id);

    if (error && /updated_at|column/i.test(error.message || "")) {
      const retry = await sb.from("claim_requests").update({ status }).eq("id", id);
      error = retry.error;
    }

    if (error) {
      console.error("[GCFind v3.71] claim update failed", error);
      return fail(error.message || "Claim update failed.");
    }

    markClaimProcessed(id);
    closestRow(btn)?.remove();
    document.querySelectorAll(`[data-staff-alert-delete="staff-claim-${CSS.escape(id)}"], [data-staff-alert-read="staff-claim-${CSS.escape(id)}"]`)
      .forEach(el => closestRow(el)?.remove());

    await writeAudit(`Staff Claim ${status}`, "claim_request", id, `Faculty/Staff marked claim request as ${status}.`);
    success(`Claim ${status}.`);

    setTimeout(() => {
      try { if (typeof window.renderStaffPanel === "function") window.renderStaffPanel(); } catch (_) {}
    }, 250);
  }

  async function deleteNotification(id, btn) {
    const ok = await ask("Delete this notification?", "Delete", "danger");
    if (!ok) return;

    saveHidden("gcfind_deleted_notifications", id);
    saveHidden("gcfind_hidden_notifications", id);
    saveHidden("gcfind_deleted_staff_notifications", id);
    saveHidden("gcfind_staff_deleted_alerts", id);

    const sb = client();
    const isRealUUID = /^[0-9a-f-]{36}$/i.test(String(id)) && !String(id).startsWith("staff-");
    if (sb && isRealUUID) {
      const { error } = gcfindIsSyntheticNotificationId(id) ? { error: null } : await sb.from("notifications").delete().eq("id", id);
      if (error) console.warn("[GCFind v3.71] DB notification delete warning:", error.message);
    }

    closestRow(btn)?.remove();
    await writeAudit("Staff Notification Deleted", "notification", id, "Faculty/Staff deleted a notification.");
    success("Notification deleted.");
  }

  async function markNotificationRead(id, btn) {
    saveHidden("gcfind_read_notifications", id);
    saveHidden("gcfind_staff_read_alerts", id);

    const sb = client();
    const isRealUUID = /^[0-9a-f-]{36}$/i.test(String(id)) && !String(id).startsWith("staff-");
    if (sb && isRealUUID) {
      const { error } = gcfindIsSyntheticNotificationId(id) ? { error: null } : await sb.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) console.warn("[GCFind v3.71] DB notification read warning:", error.message);
    }

    btn.remove();
    success("Notification marked as read.");
  }

  document.addEventListener("click", async function (event) {
    const btn = event.target.closest && event.target.closest("button");
    if (!btn) return;

    if (btn.dataset.staffClaim && btn.dataset.claimId) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await updateClaim(btn.dataset.claimId, btn.dataset.staffClaim === "approve" ? "Approved" : "Rejected", btn);
      return;
    }

    if (btn.dataset.staffAlertDelete) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await deleteNotification(btn.dataset.staffAlertDelete, btn);
      return;
    }

    if (btn.dataset.staffAlertRead) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await markNotificationRead(btn.dataset.staffAlertRead, btn);
      return;
    }

    if (btn.dataset.notificationDelete) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await deleteNotification(btn.dataset.notificationDelete, btn);
      return;
    }

    if (btn.dataset.notificationRead) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await markNotificationRead(btn.dataset.notificationRead, btn);
      return;
    }
  }, true);
})();
