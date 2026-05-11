
/*
  GCFind v2.61 Clean Action Hotfix
  Purpose: wire broken buttons without rewriting the app.
  Verify in Console:
    window.GCFIND_ACTION_HOTFIX_VERSION
*/
(() => {
  if (window.__GCFIND_ACTION_HOTFIX_V261__) return;
  window.__GCFIND_ACTION_HOTFIX_V261__ = true;
  window.GCFIND_ACTION_HOTFIX_VERSION = "v2.61-clean-action-hotfix-loaded";
  console.info("[GCFind] v2.61 Clean Action Hotfix loaded");

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const qs = (sel, root = document) => root.querySelector(sel);

  function db() {
    return window.supabaseClient || window.sb || window.supabase || null;
  }

  function isUuid(value) {
    return UUID_RE.test(String(value || ""));
  }

  function notify(message, type = "success") {
    try {
      if (type === "error" && typeof window.showError === "function") return window.showError(message, { position: "top-right", duration: 7000 });
      if (type === "success" && typeof window.showSuccess === "function") return window.showSuccess(message, { position: "top-right" });
    } catch (_) {}
    if (type === "error") console.error(message);
    else console.log(message);
  }

  async function ask(message) {
    try {
      if (typeof window.appConfirm === "function") return await window.appConfirm(message);
    } catch (_) {}
    return window.confirm(message);
  }

  function getList(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]").map(String); }
    catch (_) { return []; }
  }

  function addList(key, id) {
    if (!id) return;
    const list = getList(key);
    const sid = String(id);
    if (!list.includes(sid)) list.push(sid);
    localStorage.setItem(key, JSON.stringify(list));
  }

  function removeContainer(btn) {
    const el = btn?.closest("article, tr, .card, .notification-card, .gc-notification-card, .request-ticket-card, .ticket-card, .border-t, .rounded-2xl, .p-4");
    if (el) el.remove();
  }

  async function refreshVisible() {
    try { if (typeof window.refreshGlobalNotifications === "function") await window.refreshGlobalNotifications(); } catch (_) {}
    try { if (typeof window.loadUserClaimNotifications === "function") await window.loadUserClaimNotifications(); } catch (_) {}
    try { if (typeof window.renderStaffPanel === "function" && qs("#staffPanelMount")) await window.renderStaffPanel(); } catch (_) {}
    try { if (typeof window.renderAdminTicketNotifications === "function" && qs("#adminTicketNotifications")) await window.renderAdminTicketNotifications(); } catch (_) {}
    try { if (typeof window.renderSystemAdmin === "function" && qs("#systemAdminMount")) await window.renderSystemAdmin(); } catch (_) {}
  }

  async function updateById(table, id, payload) {
    const client = db();
    if (!client) return { error: new Error("Supabase client not found.") };
    if (!id || !isUuid(id)) return { skipped: true };
    try { return await client.from(table).update(payload).eq("id", id); }
    catch (error) { return { error }; }
  }

  async function deleteById(table, id) {
    const client = db();
    if (!client) return { error: new Error("Supabase client not found.") };
    if (!id || !isUuid(id)) return { skipped: true };
    try { return await client.from(table).delete().eq("id", id); }
    catch (error) { return { error }; }
  }

  async function selectOne(table, id) {
    const client = db();
    if (!client) return { error: new Error("Supabase client not found.") };
    if (!id || !isUuid(id)) return { data: null, skipped: true };
    try { return await client.from(table).select("*").eq("id", id).maybeSingle(); }
    catch (error) { return { data: null, error }; }
  }

  async function handleNotificationRead(id, btn) {
    addList("gcfind_read_notifications", id);
    addList("gcfind_staff_read_alerts", id);

    if (isUuid(id)) {
      const result = await updateById("notifications", id, { is_read: true });
      if (result.error) console.warn("[GCFind] mark read DB warning:", result.error.message || result.error);
    }

    const card = btn.closest("article");
    if (card) {
      card.classList.remove("bg-emerald-50/60");
      card.classList.add("bg-white");
    }
    btn.remove();
    notify("Notification marked as read.");
    await refreshVisible();
  }

  async function handleNotificationDelete(id, btn) {
    const ok = await ask("Delete this notification?");
    if (!ok) return;

    addList("gcfind_deleted_notifications", id);
    addList("gcfind_hidden_notifications", id);
    addList("gcfind_hidden_notification_ids", id);
    addList("gcfind_deleted_staff_notifications", id);
    addList("gcfind_staff_deleted_alerts", id);
    addList("gcfind_deleted_student_notifications", id);

    if (isUuid(id)) {
      const result = await deleteById("notifications", id);
      if (result.error) console.warn("[GCFind] notification delete DB warning:", result.error.message || result.error);
    }

    removeContainer(btn);
    notify("Notification deleted.");
    await refreshVisible();
  }

  async function handleClaimStatus(id, status, btn) {
    const ok = await ask(`${status === "Approved" ? "Approve" : "Reject"} this claim request?`);
    if (!ok) return;

    const payload = { status };
    payload.updated_at = new Date().toISOString();

    const result = await updateById("claim_requests", id, payload);
    if (result.error) {
      notify(result.error.message || "Unable to update claim request.", "error");
      return;
    }

    removeContainer(btn);
    notify(`Claim marked as ${status}.`);
    await refreshVisible();
  }

  async function handleTicketDelete(id, btn) {
    const ok = await ask("Delete this request ticket?");
    if (!ok) return;

    addList("gcfind_deleted_request_ticket_ids", id);
    addList("gcfind_deleted_request_tickets", id);
    addList("gcfind_hidden_request_tickets", id);
    addList("gcfind_hidden_ticket_update_ids", id);

    const result = await deleteById("request_tickets", id);
    if (result.error) {
      notify(result.error.message || "Unable to delete request ticket.", "error");
      return;
    }

    removeContainer(btn);
    notify("Request ticket deleted.");
    await refreshVisible();
  }

  async function handleReportDelete(id, btn) {
    const ok = await ask("Delete this report?");
    if (!ok) return;

    const result = await deleteById("item_reports", id);
    if (result.error) {
      notify(result.error.message || "Unable to delete report.", "error");
      return;
    }

    removeContainer(btn);
    notify("Report deleted.");
    await refreshVisible();
  }

  async function handleReportStatus(id, status, btn) {
    const ok = await ask(`Mark this report as ${status}?`);
    if (!ok) return;

    const payload = { status };
    payload.updated_at = new Date().toISOString();

    const result = await updateById("item_reports", id, payload);
    if (result.error) {
      notify(result.error.message || "Unable to update report.", "error");
      return;
    }

    notify(`Report marked as ${status}.`);
    await refreshVisible();
  }

  async function handleArchiveDelete(id, btn) {
    const ok = await ask("Permanently delete this archived record?");
    if (!ok) return;

    addList("gcfind_hidden_archive_ids", id);

    const result = await deleteById("deleted_records_archive", id);
    if (result.error) {
      notify(result.error.message || "Unable to delete archived record.", "error");
      return;
    }

    removeContainer(btn);
    notify("Archived record deleted.");
    await refreshVisible();
  }

  async function handleArchiveRestore(id, btn) {
    const ok = await ask("Restore this archived record?");
    if (!ok) return;

    const client = db();
    if (!client) {
      notify("Supabase client not found.", "error");
      return;
    }

    const current = await selectOne("deleted_records_archive", id);
    if (current.error) {
      notify(current.error.message || "Unable to read archived record.", "error");
      return;
    }

    const archive = current.data;
    if (!archive) {
      notify("Archived record not found.", "error");
      return;
    }

    let record = archive.record_data || archive.data || archive.deleted_data || archive.payload;
    if (typeof record === "string") {
      try { record = JSON.parse(record); } catch (_) {}
    }
    if (!record || typeof record !== "object") {
      notify("Archive record_data is missing.", "error");
      return;
    }

    const table = archive.source_table || archive.table_name || "item_reports";
    record = { ...record };
    delete record.id;
    delete record.created_at;
    delete record.updated_at;
    delete record.deleted_at;
    delete record.restored_at;
    delete record.reporter_email;
    delete record.reporter_name;
    if (!record.status) record.status = "Pending";

    let insertResult = await client.from(table).insert(record);
    if (insertResult.error && /foreign key|user_id/i.test(insertResult.error.message || "")) {
      delete record.user_id;
      delete record.reporter_id;
      insertResult = await client.from(table).insert(record);
    }
    if (insertResult.error) {
      notify(insertResult.error.message || "Unable to restore record.", "error");
      return;
    }

    await deleteById("deleted_records_archive", id);
    removeContainer(btn);
    notify("Record restored.");
    await refreshVisible();
  }

  function getTicketId(btn) {
    return btn.dataset.ticketDelete ||
      btn.dataset.adminTicketDelete ||
      btn.dataset.requestTicketDelete ||
      btn.dataset.adminTicketUpdateDelete ||
      btn.dataset.systemTicketDelete ||
      btn.dataset.ticketId;
  }

  function getReportId(btn) {
    return btn.dataset.reportId ||
      btn.dataset.adminReportId ||
      btn.dataset.itemReportId;
  }

  document.addEventListener("click", async (event) => {
    const btn = event.target.closest?.("button");
    if (!btn) return;

    const notificationRead = btn.dataset.notificationRead ||
      btn.dataset.staffAlertRead ||
      btn.dataset.userNotificationRead ||
      btn.dataset.globalNotifRead;

    const notificationDelete = btn.dataset.notificationDelete ||
      btn.dataset.staffAlertDelete ||
      btn.dataset.userNotificationDelete ||
      btn.dataset.globalNotifDelete;

    if (notificationRead) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await handleNotificationRead(notificationRead, btn);
      return;
    }

    if (notificationDelete) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await handleNotificationDelete(notificationDelete, btn);
      return;
    }

    if (btn.dataset.staffClaim && btn.dataset.claimId) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const status = btn.dataset.staffClaim === "approve" ? "Approved" : "Rejected";
      await handleClaimStatus(btn.dataset.claimId, status, btn);
      return;
    }

    if (btn.dataset.claimAction && btn.dataset.claimId) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const status = btn.dataset.claimAction === "approve" ? "Approved" : "Rejected";
      await handleClaimStatus(btn.dataset.claimId, status, btn);
      return;
    }

    const ticketId = getTicketId(btn);
    const isTicketDelete = ticketId && (
      btn.matches("[data-ticket-delete], [data-admin-ticket-delete], [data-request-ticket-delete], [data-admin-ticket-update-delete], [data-system-ticket-delete]") ||
      /delete/i.test(btn.textContent || "")
    );
    if (isTicketDelete) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await handleTicketDelete(ticketId, btn);
      return;
    }

    if (btn.dataset.archiveRestore) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await handleArchiveRestore(btn.dataset.archiveRestore, btn);
      return;
    }

    if (btn.dataset.archiveDelete) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await handleArchiveDelete(btn.dataset.archiveDelete, btn);
      return;
    }

    const reportId = getReportId(btn);
    const reportAction = btn.dataset.reportAction || btn.dataset.adminReport || btn.dataset.staffReport;
    if (reportId && reportAction) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const normalized = String(reportAction).toLowerCase();
      if (normalized === "delete") await handleReportDelete(reportId, btn);
      else {
        const statusMap = { approve: "Approved", reject: "Rejected", claimed: "Claimed", returned: "Returned" };
        await handleReportStatus(reportId, statusMap[normalized] || reportAction, btn);
      }
      return;
    }

    if (btn.dataset.action === "delete" && btn.dataset.table && btn.dataset.id) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const table = btn.dataset.table;
      if (table === "notifications") await handleNotificationDelete(btn.dataset.id, btn);
      else if (table === "request_tickets") await handleTicketDelete(btn.dataset.id, btn);
      else if (table === "item_reports") await handleReportDelete(btn.dataset.id, btn);
      else if (table === "deleted_records_archive") await handleArchiveDelete(btn.dataset.id, btn);
      return;
    }
  }, true);
})();
