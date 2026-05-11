
async function fetchAllReports() {
  if (!requireSupabase()) return [];
  const { data, error } = await sb
    .from('item_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const ids = [...new Set(data.map(r => r.user_id).filter(Boolean))];
  const profileMap = await fetchProfileMapByIds(ids);
  return data.map(r => mapReportRow(r, profileMap));
}

async function fetchAllClaims() {
  if (!requireSupabase()) return [];
  const { data, error } = await sb
    .from('claim_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const claimantIds = [...new Set(data.map(c => c.claimant_id).filter(Boolean))];
  const profileMap = await fetchProfileMapByIds(claimantIds);

  return data.map(c => ({
    id: c.id,
    reportId: c.report_id,
    claimantId: c.claimant_id,
    claimantEmail: profileMap[c.claimant_id]?.email || c.claimant_id,
    claimantName: profileMap[c.claimant_id]?.full_name || profileMap[c.claimant_id]?.email || c.claimant_id,
    claimantRole: profileMap[c.claimant_id]?.role || '',
    message: c.claim_message,
    status: c.status,
    createdAt: c.created_at
  }));
}



function normalizeReportStatus(status) {
  const raw = String(status || 'Pending').trim().toLowerCase();
  if (raw === 'approved' || raw === 'verified') return 'Approved';
  if (raw === 'rejected' || raw === 'declined') return 'Rejected';
  if (raw === 'claimed') return 'Claimed';
  if (raw === 'returned' || raw === 'resolved') return 'Returned';
  return 'Pending';
}

function normalizeClaimStatus(status) {
  const raw = String(status || 'Pending').trim().toLowerCase();
  if (raw === 'approved' || raw === 'verified') return 'Approved';
  if (raw === 'rejected' || raw === 'declined') return 'Rejected';
  return 'Pending';
}

function buildReportAnalytics(reports) {
  /*
    GCFind workflow analytics is calculated from ALL current report records.
    Important: Approved, Claimed, and Returned are cumulative workflow milestones.
    Example: a Claimed item has already been Approved, so it is counted in both
    approved and claimed. This prevents previous progress from disappearing when
    a report moves to the next step. Percentages are always count / total reports.
  */
  const counts = { total: reports.length, pending: 0, approved: 0, rejected: 0, claimed: 0, returned: 0 };
  reports.forEach(report => {
    const status = normalizeReportStatus(report.status);
    if (status === 'Pending') counts.pending++;
    if (status === 'Rejected') counts.rejected++;
    if (status === 'Approved' || status === 'Claimed' || status === 'Returned') counts.approved++;
    if (status === 'Claimed' || status === 'Returned') counts.claimed++;
    if (status === 'Returned') counts.returned++;
  });
  return counts;
}

function buildClaimAnalytics(claims) {
  const counts = { total: claims.length, pending: 0, approved: 0, rejected: 0 };
  claims.forEach(claim => {
    const status = normalizeClaimStatus(claim.status);
    if (status === 'Pending') counts.pending++;
    if (status === 'Approved') counts.approved++;
    if (status === 'Rejected') counts.rejected++;
  });
  return counts;
}

async function refreshAdminAnalyticsViews() {
  if (typeof renderAdminAnalyticsCharts === 'function') {
    await renderAdminAnalyticsCharts();
  }
  return Promise.resolve();
}

function withSmoothSectionUpdate(sectionSelector, task) {
  const section = document.querySelector(sectionSelector);
  if (section) section.classList.add('gc-page-transition-out');
  return new Promise(resolve => setTimeout(resolve, 120))
    .then(task)
    .finally(() => {
      const updatedSection = document.querySelector(sectionSelector);
      if (updatedSection) {
        updatedSection.classList.remove('gc-page-transition-out');
        updatedSection.classList.add('gc-page-transition-in');
        setTimeout(() => updatedSection.classList.remove('gc-page-transition-in'), 260);
      }
    });
}

function isRawIdentifier(value) {
  const text = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

function cleanAuditAction(action = '') {
  const raw = String(action || '').trim();
  const normalized = raw.toLowerCase();
  const map = {
    'account created by system administrator': 'Created Account',
    'password reset sent by system administrator': 'Sent Password Reset',
    'report submitted': 'Submitted Report',
    'report approved': 'Approved Report',
    'report rejected': 'Rejected Report',
    'report claimed': 'Marked Report as Claimed',
    'report returned': 'Marked Report as Returned',
    'report deleted': 'Deleted Report',
    'report restored': 'Restored Report',
    'claim approved': 'Approved Claim',
    'claim rejected': 'Rejected Claim',
    'claim request deleted': 'Deleted Claim Request',
    'request ticket submitted': 'Submitted Request Ticket',
    'request ticket responded': 'Replied to Request Ticket',
    'request ticket resolved': 'Resolved Request Ticket',
    'request ticket deleted': 'Deleted Request Ticket'
  };
  if (map[normalized]) return map[normalized];
  return raw.replace(/\bCSSU\b/g, 'Security / Lost & Found Office').replace(/_/g, ' ');
}

function cleanAuditDetails(log = {}) {
  const action = cleanAuditAction(log.action);
  const details = String(log.details || '').trim();
  const targetType = String(log.target_type || '').replace(/_/g, ' ');

  if (!details || details === 'null' || isRawIdentifier(details)) {
    if (action.includes('Claim')) return 'Claim request updated.';
    if (action.includes('Report')) return 'Report status updated.';
    if (action.includes('Account')) return 'User account record updated.';
    if (action.includes('Password')) return 'Password recovery email requested.';
    if (targetType) return `${targetType.charAt(0).toUpperCase() + targetType.slice(1)} updated.`;
    return 'System action completed.';
  }

  if (details.length > 90) return `${details.slice(0, 90)}...`;
  return details;
}

function isImportantAuditLog(log = {}) {
  const action = String(log.action || '').toLowerCase();
  const allowed = [
    'account created',
    'password reset',
    'report approved',
    'report rejected',
    'report claimed',
    'report returned',
    'report deleted',
    'report restored',
    'claim approved',
    'claim rejected',
    'claim request deleted',
    'request ticket'
  ];
  return allowed.some(key => action.includes(key));
}

function updateAnalyticsCards(counts) {
  setRing(document.querySelector('[data-stat-ring="total"]'), counts.total, Math.max(1, counts.total), '#0f172a');
  setRing(document.querySelector('[data-stat-ring="pending"]'), counts.pending, Math.max(1, counts.total), '#d97706');
  setRing(document.querySelector('[data-stat-ring="approved"]'), counts.approved, Math.max(1, counts.total), '#059669');
  setRing(document.querySelector('[data-stat-ring="rejected"]'), counts.rejected, Math.max(1, counts.total), '#dc2626');
  setRing(document.querySelector('[data-stat-ring="claimed"]'), counts.claimed, Math.max(1, counts.total), '#059669');
  setRing(document.querySelector('[data-stat-ring="returned"]'), counts.returned, Math.max(1, counts.total), '#475569');
}

async function renderAdminReports() {
  const tbody = $('#adminReportsBody');
  if (!tbody) return;

  const reports = await fetchAllReports();
  const counts = buildReportAnalytics(reports);

  if ($('#statTotalReports')) $('#statTotalReports').textContent = counts.total;
  if ($('#statPendingReports')) $('#statPendingReports').textContent = counts.pending;
  if ($('#statApprovedReports')) $('#statApprovedReports').textContent = counts.approved;
  if ($('#statRejectedReports')) $('#statRejectedReports').textContent = counts.rejected;
  if ($('#statClaimedReports')) $('#statClaimedReports').textContent = counts.claimed;
  if ($('#statReturnedReports')) $('#statReturnedReports').textContent = counts.returned;
  updateAnalyticsCards(counts);

  const pageData = paginate(reports, APP_STATE.adminReportsPage, APP_STATE.adminPerPage);
  APP_STATE.adminReportsPage = pageData.page;

  if (!pageData.items.length) {
    tbody.innerHTML = `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="7">No submitted reports yet.</td></tr>`;
    renderPagination('adminReportsPagination', pageData,
      () => withSmoothSectionUpdate('#adminReportsBody', () => { APP_STATE.adminReportsPage--; return renderAdminReports(); }),
      () => withSmoothSectionUpdate('#adminReportsBody', () => { APP_STATE.adminReportsPage++; return renderAdminReports(); })
    );
    return;
  }

  tbody.innerHTML = pageData.items.map(r => `
    <tr class="border-t border-slate-200">
      <td class="px-4 py-3">
        <button type="button" class="admin-report-photo-btn h-12 w-12 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200 transition hover:ring-2 hover:ring-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500" data-admin-report-photo="${escapeHtml(r.imageDataUrl || '../assets/img/fallback.jpg')}" data-admin-report-title="${escapeHtml(r.itemName || 'Reported item')}">
          <img src="${escapeHtml(r.imageDataUrl || '../assets/img/fallback.jpg')}" class="h-full w-full object-cover" alt="${escapeHtml(r.itemName || 'Reported item photo')}" onerror="this.onerror=null;this.src='../assets/img/fallback.jpg';">
        </button>
      </td>
      <td class="px-4 py-3 text-sm font-semibold text-slate-900">${escapeHtml(r.itemName)}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(r.type)}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(r.submittedByName || r.submittedBy)}</td>
      <td class="px-4 py-3 text-sm">${statusPill(r.status)}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(r.location)}</td>
      <td class="px-4 py-3 text-sm"><div class="flex flex-wrap gap-2">
        <button data-report-action="approve" data-report-id="${r.id}" class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
        <button data-report-action="reject" data-report-id="${r.id}" class="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">Reject</button>
        <button data-report-action="claimed" data-report-id="${r.id}" class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Mark Claimed</button>
        <button data-report-action="returned" data-report-id="${r.id}" class="rounded-lg bg-slate-600 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">Mark Returned</button>
        <button data-report-action="delete" data-report-id="${r.id}" class="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700">Delete</button>
      </div></td>
    </tr>`).join('');
  renderPagination('adminReportsPagination', pageData,
      () => withSmoothSectionUpdate('#adminReportsBody', () => { APP_STATE.adminReportsPage--; return renderAdminReports(); }),
      () => withSmoothSectionUpdate('#adminReportsBody', () => { APP_STATE.adminReportsPage++; return renderAdminReports(); })
    );
}

async function renderAdminClaims() {
  const tbody = $('#adminClaimsBody');
  if (!tbody) return;

  const claims = await fetchAllClaims();
  const reportMap = {};
  const reports = await fetchAllReports();
  reports.forEach(r => { reportMap[r.id] = r; });
  const pageData = paginate(claims, APP_STATE.adminClaimsPage, APP_STATE.adminPerPage);
  APP_STATE.adminClaimsPage = pageData.page;

  if (!pageData.items.length) {
    tbody.innerHTML = `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="6">No claim requests yet.</td></tr>`;
    renderPagination('adminClaimsPagination', pageData,
      () => withSmoothSectionUpdate('#adminClaimsBody', () => { APP_STATE.adminClaimsPage--; return renderAdminClaims(); }),
      () => withSmoothSectionUpdate('#adminClaimsBody', () => { APP_STATE.adminClaimsPage++; return renderAdminClaims(); })
    );
    return;
  }

  tbody.innerHTML = pageData.items.map(c => {
    const report = reportMap[c.reportId];
    return `<tr class="border-t border-slate-200">
      <td class="px-4 py-3 text-sm font-semibold text-slate-900">${escapeHtml(report?.itemName || 'Unknown Item')}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(c.claimantName || c.claimantEmail)}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(c.message)}</td>
      <td class="px-4 py-3 text-sm">${statusPill(c.status)}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${formatDateTime(c.createdAt)}</td>
      <td class="px-4 py-3 text-sm"><div class="flex flex-wrap gap-2">
        <button data-claim-action="approve" data-claim-id="${c.id}" data-report-id="${c.reportId}" class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
        <button data-claim-action="reject" data-claim-id="${c.id}" data-report-id="${c.reportId}" class="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700">Reject</button>
        <button data-claim-action="delete" data-claim-id="${c.id}" data-report-id="${c.reportId}" class="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
  renderPagination('adminClaimsPagination', pageData,
      () => withSmoothSectionUpdate('#adminClaimsBody', () => { APP_STATE.adminClaimsPage--; return renderAdminClaims(); }),
      () => withSmoothSectionUpdate('#adminClaimsBody', () => { APP_STATE.adminClaimsPage++; return renderAdminClaims(); })
    );
}

async function renderAdminLogs() {
  const tbody = $('#adminLogsBody');
  if (!tbody || !requireSupabase()) return;

  const { data, error } = await sb
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) {
    tbody.innerHTML = `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="4">No audit logs yet.</td></tr>`;
    return;
  }

  const cleanLogs = (data || []).filter(isImportantAuditLog);
  const actorMap = await fetchProfileMapByIds(cleanLogs.map(l => l.actor_id).filter(Boolean));
  const pageData = paginate(cleanLogs, APP_STATE.adminLogsPage, APP_STATE.adminPerPage);
  APP_STATE.adminLogsPage = pageData.page;

  tbody.innerHTML = pageData.items.length ? pageData.items.map(log => `
    <tr class="border-t border-slate-200">
      <td class="px-4 py-3 text-sm text-slate-900 font-medium">${escapeHtml(cleanAuditAction(log.action))}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(cleanAuditDetails(log))}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(actorMap[log.actor_id]?.full_name || actorMap[log.actor_id]?.email || 'System')}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${formatDateTime(log.created_at)}</td>
    </tr>`).join('') : `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="4">No audit logs yet.</td></tr>`;
  renderPagination('adminLogsPagination', pageData,
      () => withSmoothSectionUpdate('#adminLogsBody', () => { APP_STATE.adminLogsPage--; return renderAdminLogs(); }),
      () => withSmoothSectionUpdate('#adminLogsBody', () => { APP_STATE.adminLogsPage++; return renderAdminLogs(); })
    );
}



function getHiddenTicketUpdateIds() {
  try { return JSON.parse(localStorage.getItem('gcfind_hidden_ticket_update_ids') || '[]'); }
  catch (_) { return []; }
}
function getReadTicketUpdateIds() {
  try { return JSON.parse(localStorage.getItem('gcfind_read_ticket_update_ids') || '[]'); }
  catch (_) { return []; }
}
function hideTicketUpdateLocally(ticketId) {
  if (!ticketId) return;
  const list = getHiddenTicketUpdateIds();
  if (!list.includes(String(ticketId))) list.push(String(ticketId));
  localStorage.setItem('gcfind_hidden_ticket_update_ids', JSON.stringify(list));
}
function markTicketUpdateReadLocally(ticketId) {
  if (!ticketId) return;
  const list = getReadTicketUpdateIds();
  const id = String(ticketId);
  if (!list.includes(id)) list.push(id);
  localStorage.setItem('gcfind_read_ticket_update_ids', JSON.stringify(list));
}


function getSystemAdminHiddenTicketIds() {
  try { return JSON.parse(localStorage.getItem('gcfind_system_admin_hidden_ticket_ids') || '[]'); }
  catch (_) { return []; }
}
function hideSystemAdminTicketLocally(ticketId) {
  if (!ticketId) return;
  const list = getSystemAdminHiddenTicketIds();
  const id = String(ticketId);
  if (!list.includes(id)) list.push(id);
  localStorage.setItem('gcfind_system_admin_hidden_ticket_ids', JSON.stringify(list));
}
function getSystemAdminTicketReadIds() {
  try { return JSON.parse(localStorage.getItem('gcfind_system_admin_ticket_read_ids') || '[]'); }
  catch (_) { return []; }
}
function markSystemAdminTicketReadLocally(ticketId) {
  if (!ticketId) return;
  const list = getSystemAdminTicketReadIds();
  const id = String(ticketId);
  if (!list.includes(id)) list.push(id);
  localStorage.setItem('gcfind_system_admin_ticket_read_ids', JSON.stringify(list));
}
function getSystemAdminHiddenTicketNotificationIds() {
  try { return JSON.parse(localStorage.getItem('gcfind_system_admin_hidden_ticket_notification_ids') || '[]'); }
  catch (_) { return []; }
}
function hideSystemAdminTicketNotificationLocally(ticketId) {
  if (!ticketId) return;
  const list = getSystemAdminHiddenTicketNotificationIds();
  const id = String(ticketId);
  if (!list.includes(id)) list.push(id);
  localStorage.setItem('gcfind_system_admin_hidden_ticket_notification_ids', JSON.stringify(list));
}

async function renderAdminTicketNotifications() {
  const panel = document.getElementById('adminTicketNotifications');
  const list = document.getElementById('adminTicketNotificationsList');
  if (!panel || !list || !requireSupabase()) return;
  const user = getUser();
  let tickets = [];
  try {
    const all = await fetchRequestTickets();
    const hiddenTickets = new Set(getHiddenTicketUpdateIds().map(String));
    const readTickets = new Set(getReadTicketUpdateIds().map(String));
    tickets = all
      .filter(t => (t.requester_email || '').toLowerCase() === (user?.email || '').toLowerCase())
      .map(t => ({ ...t, _is_read_local: readTickets.has(String(t.id)) }))
      .filter(t => !hiddenTickets.has(String(t.id)))
      .slice(0, 5);
  } catch (err) {
    tickets = [];
  }
  if (!tickets.length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  list.innerHTML = tickets.map(t => `
    <article class="p-4 ${(String(t.status || '').toLowerCase() === 'resolved' || t._is_read_local) ? 'bg-white' : 'bg-emerald-50/60'}">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-extrabold text-slate-900">${escapeHtml(t.message || 'Request ticket')}</div>
          <div class="mt-2 rounded-2xl ${t.admin_response ? 'bg-white ring-emerald-100 text-emerald-900' : 'bg-amber-50 ring-amber-100 text-amber-800'} p-3 text-sm ring-1">
            <b>${t.admin_response ? 'System Administrator Response:' : 'Status:'}</b> ${escapeHtml(t.admin_response || 'Waiting for System Administrator response.')}
          </div>
          <div class="mt-2 text-xs text-slate-500">Updated: ${formatDateTime(t.updated_at || t.created_at)}</div>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          ${statusPill(t.status || 'Pending')}
          ${!t._is_read_local ? `<button type="button" class="rounded-xl bg-white px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50" data-admin-ticket-update-read="${escapeHtml(t.id)}">Mark read</button>` : ''}
          <button type="button" class="rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50" data-admin-ticket-update-delete="${escapeHtml(t.id)}">Delete</button>
        </div>
      </div>
    </article>`).join('');

  list.querySelectorAll('[data-admin-ticket-update-read]').forEach(btn => btn.addEventListener('click', async () => {
    const ticketId = btn.dataset.adminTicketUpdateRead;
    markTicketUpdateReadLocally(ticketId);
    btn.closest('article')?.classList.remove('bg-emerald-50/60');
    btn.closest('article')?.classList.add('bg-white');
    btn.remove();
    showSuccess('Notification marked as read.', { position: 'top-right' });
    if (typeof renderAdminTicketNotifications === 'function') await renderAdminTicketNotifications();
  }));

  list.querySelectorAll('[data-admin-ticket-update-delete]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await appConfirm('Delete this request ticket update from your dashboard?');
    if (!ok) return;
    try {
      const ticketId = btn.dataset.adminTicketUpdateDelete;
      if (typeof saveDeletedRequestTicketId === 'function') saveDeletedRequestTicketId(ticketId);
      hideTicketUpdateLocally(ticketId);
      btn.closest('article')?.remove();
      const { error } = await sb.from('request_tickets').delete().eq('id', ticketId);
      if (error) console.warn('Request ticket update DB delete blocked, local hide applied:', error.message);
      showSuccess('Request ticket update deleted.', { position: 'top-right' });
      await renderAdminTicketNotifications();
    } catch (err) {
      const ticketId = btn.dataset.adminTicketUpdateDelete;
      if (typeof saveDeletedRequestTicketId === 'function') saveDeletedRequestTicketId(ticketId);
      hideTicketUpdateLocally(ticketId);
      btn.closest('article')?.remove();
      showSuccess('Request ticket update removed from this dashboard.', { position: 'top-right' });
      await renderAdminTicketNotifications();
    }
  }));
}

async function createNotification({
  recipientUserId,
  recipientEmail,
  recipientRole,
  title,
  message,
  type = 'system',
  relatedId = null
}) {
  if (!requireSupabase()) return null;

  const payload = {
    recipient_user_id: recipientUserId || null,
    recipient_role: recipientRole || null,
    title,
    message,
    type,
    related_id: relatedId,
    is_read: false
  };

  // Match the actual Supabase notifications schema:
  // id, recipient_user_id, recipient_role, title, message, type, related_id, is_read, created_at
  // Do NOT insert fallback columns like email, receiver_email, target_role because they do not exist.
  const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));

  try {
    const { data, error } = await sb.from('notifications').insert(cleanPayload).select();
    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('Unable to create notification:', err.message);
    return null;
  }
}

async function fetchNotificationsForCurrentUser(limit = 8) {
  if (!requireSupabase()) return [];
  const user = getUser(); const authUser = await getAuthUser(); const role = user?.role || ''; const uid = authUser?.id || user?.id || null;
  try {
    let q = sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
    if (uid && role) q = q.or(`recipient_user_id.eq.${uid},recipient_role.eq.${role}`); else if (uid) q = q.eq('recipient_user_id', uid); else if (role) q = q.eq('recipient_role', role);
    const { data, error } = await q; if (error) throw error; const hiddenA = typeof getHiddenNotificationIds === 'function' ? getHiddenNotificationIds().map(String) : []; const hiddenB = typeof getPanelHiddenNotificationIds === 'function' ? getPanelHiddenNotificationIds().map(String) : []; const hidden = new Set([...hiddenA, ...hiddenB]); return (data || []).filter(n => !hidden.has(String(n.id)));
  } catch (err) { console.warn('Unable to fetch notifications:', err.message); return []; }
}
async function markNotificationRead(notificationId) {
  if (!notificationId) return;
  const id = String(notificationId);
  const isRealUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  try {
    const key = 'gcfind_read_notifications';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if (!list.includes(id)) list.push(id);
    localStorage.setItem(key, JSON.stringify(list));
  } catch (_) {}
  if (!requireSupabase() || !isRealUuid) return;
  try { await sb.from('notifications').update({ is_read: true }).eq('id', id); }
  catch (err) { console.warn('Unable to mark notification read:', err.message); }
}
async function deleteNotificationRow(notificationId) {
  if (!notificationId) return false;

  // Hide immediately in this browser so it will not return after rerender/refresh,
  // even if Supabase RLS blocks the actual database DELETE.
  try {
    if (typeof hidePanelNotificationLocally === 'function') hidePanelNotificationLocally(notificationId);
    if (typeof hideNotificationLocally === 'function') hideNotificationLocally(notificationId);
  } catch (_) {}

  if (!requireSupabase()) return true;

  try {
    const { error } = await sb.from('notifications').delete().eq('id', notificationId);
    if (error) console.warn('Notification DB delete blocked, local hide applied:', error.message);
    return true;
  } catch (err) {
    console.warn('Unable to delete notification, local hide applied:', err.message);
    return true;
  }
}

function notificationCard(n) { return `<article class="p-4 ${n.is_read ? 'bg-white' : 'bg-emerald-50/60'}"><div class="gc-notification-row"><div class="gc-notification-content"><div class="font-extrabold text-slate-900">${escapeHtml(n.title || 'Notification')}</div><div class="mt-1 text-sm text-slate-600 break-words">${escapeHtml(n.message || '')}</div><div class="mt-2 text-xs text-slate-500">${formatDateTime(n.created_at)}</div></div><div class="gc-notification-actions">${!n.is_read ? `<button class="rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200" data-notification-read="${escapeHtml(n.id)}">Mark read</button>` : ''}<button class="rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50" data-notification-delete="${escapeHtml(n.id)}">Delete</button></div></div></article>`; }
async function bindNotificationReadButtons(scope, rerender) {
  scope.querySelectorAll('[data-notification-read]').forEach(btn => btn.addEventListener('click', async () => {
    await markNotificationRead(btn.dataset.notificationRead);
    const card = btn.closest('article');
    card?.classList.remove('bg-emerald-50/60');
    card?.classList.add('bg-white');
    btn.remove();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
    if (typeof rerender === 'function') await rerender();
  }));

  scope.querySelectorAll('[data-notification-delete]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await appConfirm('Delete this notification?');
    if (!ok) return;
    await deleteNotificationRow(btn.dataset.notificationDelete);
    btn.closest('article')?.remove();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
    if (typeof rerender === 'function') await rerender();
  }));
}


/* ===================== STAFF PANEL DIRECT FETCH FIX ===================== */
async function fetchStaffPendingReportsDirect() {
  if (!requireSupabase()) return { rows: [], error: null };
  try {
    const { data, error } = await sb
      .from('item_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { rows: [], error };

    const mapped = await Promise.all((data || []).map(async row => {
      try {
        const mappedRow = typeof mapReportRow === 'function' ? mapReportRow(row, {}) : row;
        return mappedRow;
      } catch (_) {
        return {
          id: row.id,
          itemName: row.item_name || row.itemName || row.name || 'Reported item',
          type: row.type || row.report_type || '',
          location: row.location || '',
          status: row.status || 'Pending',
          imageDataUrl: row.image_url || row.imageDataUrl || row.photo_url || row.photo || row.image || '../assets/img/fallback.jpg',
          submittedByName: row.reporter_name || row.submitted_by_name || row.submittedByName || row.reporter_email || row.user_id || 'Student',
          submittedBy: row.reporter_email || row.submitted_by || row.user_id || '',
          reporterId: row.user_id || row.reporter_id || null,
          createdAt: row.created_at || row.createdAt
        };
      }
    }));

    return {
      rows: mapped.filter(r => String(r.status || 'Pending').trim().toLowerCase() === 'pending'),
      error: null
    };
  } catch (error) {
    return { rows: [], error };
  }
}

async function fetchStaffPendingClaimsDirect() {
  if (!requireSupabase()) return { rows: [], error: null };
  try {
    const { data, error } = await sb
      .from('claim_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { rows: [], error };

    const rawClaims = data || [];

    const reportIds = [...new Set(rawClaims.map(c => c.report_id).filter(Boolean))];
    const claimantIds = [...new Set(rawClaims.map(c => c.claimant_id).filter(Boolean))];

    let reportMap = {};
    if (reportIds.length) {
      try {
        const { data: reports } = await sb
          .from('item_reports')
          .select('*')
          .in('id', reportIds);
        reportMap = Object.fromEntries((reports || []).map(r => [String(r.id), r]));
      } catch (_) {}
    }

    let profileMap = {};
    if (claimantIds.length) {
      try {
        let { data: profiles, error: profileError } = await sb
          .from('profiles')
          .select('*')
          .in('id', claimantIds);

        if (profileError && /column/i.test(profileError.message || '')) {
          const retry = await sb
            .from('profiles')
            .select('*')
            .in('id', claimantIds);
          profiles = retry.data;
        }

        profileMap = Object.fromEntries((profiles || []).map(p => [String(p.id), p]));
      } catch (_) {}
    }

    const looksUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));

    const rows = rawClaims.map(c => {
      const report = reportMap[String(c.report_id)] || {};
      const profile = profileMap[String(c.claimant_id)] || {};

      const rawClaimantName =
        c.claimant_name ||
        c.full_name ||
        c.claimant_full_name ||
        c.name ||
        profile.full_name ||
        profile.name ||
        profile.email ||
        c.claimant_email ||
        c.email ||
        '';

      const claimantName = rawClaimantName && !looksUuid(rawClaimantName)
        ? rawClaimantName
        : (c.claimant_email || profile.email || 'Unknown claimant');

      return {
        id: c.id,
        reportId: c.report_id,
        itemName: report.item_name || report.name || report.title || c.item_name || 'Reported item',
        claimantId: c.claimant_id,
        claimantEmail: c.claimant_email || c.email || profile.email || '',
        claimantName,
        message: c.claim_message || c.message || 'No message provided.',
        status: c.status || 'Pending',
        createdAt: c.created_at || c.createdAt
      };
    });

    return {
      rows: rows.filter(c => String(c.status || 'Pending').trim().toLowerCase() === 'pending'),
      error: null
    };
  } catch (error) {
    return { rows: [], error };
  }
}
function getProcessedStaffClaimIds() {
  try {
    const keys = ['gcfind_processed_staff_claims', 'gcfind_hidden_staff_claim_ids'];
    return [...new Set(keys.flatMap(k => JSON.parse(localStorage.getItem(k) || '[]')).map(String))];
  } catch (_) {
    return [];
  }
}

function markStaffClaimProcessedLocally(claimId) {
  if (!claimId) return;
  try {
    const key = 'gcfind_processed_staff_claims';
    const list = JSON.parse(localStorage.getItem(key) || '[]').map(String);
    if (!list.includes(String(claimId))) list.push(String(claimId));
    localStorage.setItem(key, JSON.stringify(list));
    const notifKey = 'gcfind_deleted_staff_notifications';
    const nlist = JSON.parse(localStorage.getItem(notifKey) || '[]').map(String);
    const syntheticId = `staff-claim-${claimId}`;
    if (!nlist.includes(syntheticId)) nlist.push(syntheticId);
    localStorage.setItem(notifKey, JSON.stringify(nlist));
  } catch (_) {}
}

function buildStaffSyntheticNotificationsFromTasks(pendingReports = [], pendingClaims = []) {
  const readIds = JSON.parse(localStorage.getItem('gcfind_staff_read_alerts') || '[]');
  const alerts = [];

  pendingReports.forEach(r => alerts.push({
    id: `staff-report-${r.id}`,
    title: 'New Pending Report',
    message: `${r.itemName || 'A reported item'} needs staff verification${r.location ? ` at ${r.location}` : ''}.`,
    type: 'report',
    is_read: false,
    synthetic: true,
    created_at: r.createdAt || new Date().toISOString()
  }));

  pendingClaims.forEach(c => alerts.push({
    id: `staff-claim-${c.id}`,
    title: 'New Claim Request',
    message: `${c.claimantName || c.claimantEmail || 'A student'} submitted a claim request that needs staff verification.`,
    type: 'claim',
    is_read: false,
    synthetic: true,
    created_at: c.createdAt || new Date().toISOString()
  }));

  const deletedIds = new Set(getDeletedStaffNotificationIds().map(String));
  return alerts
    .filter(a => !deletedIds.has(String(a.id)))
    .map(a => ({ ...a, is_read: readIds.includes(String(a.id)) }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function renderStaffPanel() {
  const mount = $('#staffPanelMount');
  if (!mount) return;
  const user = getUser();
  if (user?.role !== 'faculty_staff') {
    mount.innerHTML = `<div class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 text-sm text-slate-600">This page is available for faculty and staff only.</div>`;
    return;
  }
  mount.innerHTML = `<div class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 text-sm text-slate-600">Loading staff dashboard...</div>`;
  const [reportResult, claimResult, notifications] = await Promise.all([
    fetchStaffPendingReportsDirect(),
    fetchStaffPendingClaimsDirect(),
    fetchNotificationsForCurrentUser(8)
  ]);

  const pendingReports = reportResult.rows || [];
  const processedClaimIds = new Set(getProcessedStaffClaimIds().map(String));
  const pendingClaims = (claimResult.rows || []).filter(c => !processedClaimIds.has(String(c.id)));
  const staffAlerts = buildStaffSyntheticNotificationsFromTasks(pendingReports, pendingClaims);
  const combinedNotifications = [...notifications, ...staffAlerts]
    .filter((n, index, arr) => arr.findIndex(x => String(x.id) === String(n.id)) === index)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  const staffDataError = reportResult.error || claimResult.error;
  mount.innerHTML = `
    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="analytics-card staff-stat-card"><span class="staff-stat-label">Pending Reports</span><span class="staff-stat-value">${pendingReports.length}</span></div>
      <div class="analytics-card staff-stat-card"><span class="staff-stat-label">Pending Claims</span><span class="staff-stat-value">${pendingClaims.length}</span></div>
      <div class="analytics-card staff-stat-card"><span class="staff-stat-label">Unread Notifications</span><span class="staff-stat-value">${combinedNotifications.filter(n => !n.is_read).length}</span></div>
    </section>
    ${staffDataError ? `<section class="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Staff data access warning:</strong> The system could not read pending reports or claims. Please apply the provided Supabase RLS policies for faculty_staff access.</section>` : ''}
    <section class="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start system-admin-grid">
      <section class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden"><div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-list-check mr-2 text-emerald-600"></i>Pending Report Items</h2><p class="mt-1 text-sm text-slate-600">Reports needing staff verification or assistance.</p></div><div id="staffPendingReports" class="divide-y divide-slate-200"></div></section>
      <div class="space-y-6"><section class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden"><div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-handshake-angle mr-2 text-emerald-600"></i>Claim Verification Support</h2><p class="mt-1 text-sm text-slate-600">Assist CSSU by reviewing active claim requests.</p></div><div id="staffPendingClaims" class="divide-y divide-slate-200"></div></section><section class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden"><div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-bell mr-2 text-emerald-600"></i>Notifications</h2><p class="mt-1 text-sm text-slate-600">Updates for reports, claims, and admin responses.</p></div><div id="staffNotifications" class="divide-y divide-slate-200"></div></section></div>
    </section>`;
  const reportsBox = document.getElementById('staffPendingReports');
  reportsBox.innerHTML = pendingReports.length ? pendingReports.map(r => `<article class="p-4"><div class="flex gap-4"><div class="h-20 w-20 shrink-0 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-1 flex items-center justify-center overflow-hidden"><img src="${escapeHtml(r.imageDataUrl || '../assets/img/fallback.jpg')}" alt="${escapeHtml(r.itemName || 'Report image')}" class="max-h-full max-w-full object-contain" onerror="this.onerror=null;this.src='../assets/img/fallback.jpg';"></div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h3 class="font-extrabold text-slate-900">${escapeHtml(r.itemName)}</h3>${statusPill(r.status)}</div><p class="mt-1 text-sm text-slate-600">${escapeHtml(r.type)} • ${escapeHtml(r.location || 'No location')} • Posted by ${escapeHtml(r.submittedByName || r.submittedBy || 'Unknown')}</p><p class="mt-1 text-xs text-slate-500">${formatDateTime(r.createdAt)}</p><div class="mt-3 flex flex-wrap gap-2"><button class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700" data-staff-report="approve" data-report-id="${escapeHtml(r.id)}">Verify / Approve</button><button class="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700" data-staff-report="reject" data-report-id="${escapeHtml(r.id)}">Reject</button></div></div></div></article>`).join('') : `<div class="p-5 text-sm text-slate-600">No pending reports found.</div>`;
  const claimsBox = document.getElementById('staffPendingClaims');
  claimsBox.innerHTML = pendingClaims.length ? pendingClaims.map(c => `<article class="p-4"><div class="font-extrabold text-slate-900">${escapeHtml(c.itemName || 'Reported item')}</div><div class="mt-1 text-sm text-slate-600"><strong>Claimant:</strong> ${escapeHtml(c.claimantName || c.claimantEmail || 'Claimant')}</div><div class="mt-1 text-sm text-slate-600">${escapeHtml(c.message || 'No message provided.')}</div><div class="mt-2 text-xs text-slate-500">${formatDateTime(c.createdAt)}</div><div class="mt-2">${statusPill(c.status)}</div><div class="mt-3 flex flex-wrap gap-2"><button class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700" data-staff-claim="approve" data-claim-id="${escapeHtml(c.id)}">Verify / Approve Claim</button><button class="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700" data-staff-claim="reject" data-claim-id="${escapeHtml(c.id)}">Reject Claim</button></div></article>`).join('') : `<div class="p-5 text-sm text-slate-600">No pending claim verification tasks.</div>`;
  const notificationBox = document.getElementById('staffNotifications'); notificationBox.innerHTML = combinedNotifications.length ? combinedNotifications.map(n => n.synthetic ? `<article class="p-4 ${n.is_read ? 'bg-white' : 'bg-emerald-50/60'}"><div class="gc-notification-row"><div class="gc-notification-content"><h3 class="font-extrabold text-slate-900">${escapeHtml(n.title)}</h3><p class="mt-1 text-sm text-slate-600 break-words">${escapeHtml(n.message)}</p><p class="mt-2 text-xs text-slate-500">${formatDateTime(n.created_at)}</p></div><div class="gc-notification-actions"><span class="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Pending</span>${!n.is_read ? `<button class="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50" data-staff-alert-read="${escapeHtml(n.id)}">Mark read</button>` : ''}<button class="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50" data-staff-alert-delete="${escapeHtml(n.id)}">Delete</button></div></div></article>` : notificationCard(n)).join('') : `<div class="p-5 text-sm text-slate-600">No notifications yet.</div>`;
  await bindNotificationReadButtons(mount, renderStaffPanel);

  notificationBox?.querySelectorAll('[data-staff-alert-read]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.staffAlertRead;
    const key = 'gcfind_staff_read_alerts';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if (!list.includes(id)) list.push(id);
    localStorage.setItem(key, JSON.stringify(list));
    btn.closest('article')?.remove();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
    await renderStaffPanel();
    showSuccess('Notification marked as read.', { position: 'top-right' });
  }));
  notificationBox?.querySelectorAll('[data-staff-alert-delete]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await appConfirm('Delete this notification?');
    if (!ok) return;
    const id = btn.dataset.staffAlertDelete;
    const key = 'gcfind_staff_read_alerts';
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if (!list.includes(id)) list.push(id);
    localStorage.setItem(key, JSON.stringify(list));
    btn.closest('article')?.remove();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
    await renderStaffPanel();
    showSuccess('Notification deleted.', { position: 'top-right' });
  }));

  // Staff claim approve/reject is handled by assets/js/gcfind-actions-fix.js v3.68.
  // Old inline handler removed to prevent duplicate confirmation modals.
  mount.insertAdjacentHTML('beforeend', `
    <div id="staffReviewModal" class="fixed inset-0 z-[9999] hidden items-center justify-center gc-modal-overlay px-4">
      <div class="w-full max-w-xl rounded-3xl bg-white shadow-2xl ring-1 ring-emerald-100 overflow-hidden">
        <div class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h3 id="staffReviewTitle" class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-clipboard-check mr-2 text-emerald-600"></i>Review report</h3>
              <p id="staffReviewSubtext" class="mt-1 text-sm text-slate-600">Add an optional note for the student before submitting your review.</p>
            </div>
            <button type="button" class="rounded-xl p-2 text-slate-500 hover:bg-slate-100" data-staff-review-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>
        <div class="p-5">
          <label for="staffReviewNote" class="text-sm font-semibold text-slate-700">Verification note <span class="font-normal text-slate-500">(optional)</span></label>
          <div class="mt-2 relative">
            <i class="fa-solid fa-pen-to-square absolute left-4 top-4 text-slate-400"></i>
            <textarea id="staffReviewNote" rows="5" class="w-full rounded-2xl bg-white pl-11 pr-4 py-3 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Example: Item details verified. Please proceed with the claim process."></textarea>
          </div>
          <p class="mt-2 text-xs text-slate-500">This note will be saved in the audit log and sent to the student as a dashboard notification.</p>
        </div>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" class="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" data-staff-review-close>Cancel</button>
          <button type="button" id="staffReviewSubmit" class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">Submit review</button>
        </div>
      </div>
    </div>`);

  const modal = document.getElementById('staffReviewModal');
  const modalTitle = document.getElementById('staffReviewTitle');
  const modalSubtext = document.getElementById('staffReviewSubtext');
  const modalNote = document.getElementById('staffReviewNote');
  const modalSubmit = document.getElementById('staffReviewSubmit');
  let selectedReview = null;

  function closeStaffReviewModal() {
    selectedReview = null;
    modal?.classList.add('hidden');
    modal?.classList.remove('flex');
    if (modalNote) modalNote.value = '';
  }

  mount.querySelectorAll('[data-staff-review-close]').forEach(btn => btn.addEventListener('click', closeStaffReviewModal));

  reportsBox.querySelectorAll('[data-staff-report]').forEach(btn => btn.addEventListener('click', () => {
    const nextStatus = btn.dataset.staffReport === 'approve' ? 'Approved' : 'Rejected';
    selectedReview = { reportId: btn.dataset.reportId, nextStatus };
    if (modalTitle) modalTitle.textContent = nextStatus === 'Approved' ? 'Verify / Approve Report' : 'Reject Report';
    if (modalSubtext) modalSubtext.textContent = nextStatus === 'Approved'
      ? 'Add a short verification note before approving this report.'
      : 'Add a short reason before rejecting this report.';
    if (modalSubmit) {
      modalSubmit.textContent = nextStatus === 'Approved' ? 'Approve report' : 'Reject report';
      modalSubmit.className = nextStatus === 'Approved'
        ? 'rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700'
        : 'rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700';
    }
    modal?.classList.remove('hidden');
    modal?.classList.add('flex');
    setTimeout(() => modalNote?.focus(), 50);
  }));

  modalSubmit?.addEventListener('click', async () => {
    if (!selectedReview) return;
    const { reportId, nextStatus } = selectedReview;
    const note = (modalNote?.value || '').trim();
    const report = pendingReports.find(r => String(r.id) === String(reportId));
    try {
      const { data: updatedReport, error } = await sb
        .from('item_reports')
        .update({ status: nextStatus })
        .eq('id', reportId)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!updatedReport || String(updatedReport.status || '') !== nextStatus) {
        throw new Error('Report update did not apply due to policy restrictions. Please apply the latest staff-panel RLS SQL.');
      }
      await createAuditLog(`Staff Report ${nextStatus}`, 'item_report', reportId, note || nextStatus);
      const staffName = user.name || user.email || 'Faculty / Staff';
      const noteText = note ? ` Note: ${note}` : '';
      await createNotification({ recipientRole: 'admin', title: `Report ${nextStatus} by Staff`, message: `${staffName} updated ${report?.itemName || 'a report'} to ${nextStatus}.${noteText}`, type: 'report', relatedId: reportId });
      await createNotification({ recipientRole: 'system_admin', title: `Report ${nextStatus} by Staff`, message: `${staffName} updated ${report?.itemName || 'a report'} to ${nextStatus}.${noteText}`, type: 'report', relatedId: reportId });
      if (report?.reporterId) {
        await createNotification({ recipientUserId: report.reporterId, title: `Your report was ${nextStatus}`, message: `${report.itemName || 'Your item report'} was reviewed by Faculty / Staff.${noteText}`, type: 'report', relatedId: reportId });
      }
      closeStaffReviewModal();
      showSuccess(`Report marked as ${nextStatus}.`, { position: 'top-right' });
      await renderStaffPanel();
    } catch (err) {
      showError(err.message || 'Unable to update report.', { position: 'top-right' });
    }
  });
}





function ensureAdminPhotoPreviewModal() {
  let modal = document.getElementById('adminPhotoPreviewModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'adminPhotoPreviewModal';
  modal.className = 'hidden';
  modal.innerHTML = `
    <div class="admin-photo-preview-card relative w-full rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
      <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h3 id="adminPhotoPreviewTitle" class="text-lg font-extrabold text-slate-900">Reported item photo</h3>
          <p class="mt-1 text-sm text-slate-600">Full-screen preview for verification.</p>
        </div>
        <button type="button" class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200" data-admin-photo-close aria-label="Close photo preview">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="admin-photo-preview-body flex items-center justify-center bg-slate-50 p-4">
        <img id="adminPhotoPreviewImage" src="" alt="Report photo preview" class="admin-photo-preview-img rounded-2xl object-contain shadow-sm">
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-admin-photo-close]')) {
      closeAdminPhotoPreview();
    }
  });

  return modal;
}

function openAdminPhotoPreview(src, title = 'Reported item photo') {
  const modal = ensureAdminPhotoPreviewModal();
  const img = document.getElementById('adminPhotoPreviewImage');
  const heading = document.getElementById('adminPhotoPreviewTitle');
  if (img) img.src = src || '../assets/img/fallback.jpg';
  if (heading) heading.textContent = title || 'Reported item photo';
  if (typeof gcfindOpenModalFixed === 'function') gcfindOpenModalFixed(modal);
  else {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeAdminPhotoPreview() {
  const modal = document.getElementById('adminPhotoPreviewModal');
  if (!modal) return;
  if (typeof gcfindCloseModalFixed === 'function') gcfindCloseModalFixed(modal);
  else {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}


function initAdminActions() {
  const reportsTable = $('#adminReportsTable');
  reportsTable?.addEventListener('click', async (e) => {
    const photoBtn = e.target.closest('[data-admin-report-photo]');
    if (photoBtn) {
      e.preventDefault();
      e.stopPropagation();
      openAdminPhotoPreview(photoBtn.dataset.adminReportPhoto, photoBtn.dataset.adminReportTitle);
      return;
    }

    const btn = e.target.closest('button[data-report-action]');
    if (!btn || !requireSupabase()) return;

    const action = btn.dataset.reportAction;
    const id = btn.dataset.reportId;

    if (action === 'delete') {
      const ok = await appConfirm('Delete this report? It will be moved to recovery archive first.');
      if (!ok) return;

      try {
        await archiveReportBeforeDelete(id);
        const { error } = await sb.from('item_reports').delete().eq('id', id);
        if (error) throw error;
        await createAuditLog('Report Deleted', 'item_report', id, id);
        showSuccess('Report deleted and saved for recovery.', { position: 'top-right' });
        await renderAdminReports();
        await refreshAdminAnalyticsViews();
      } catch (err) {
        showError(err.message || 'Unable to delete/archive report.', { position: 'top-right', duration: 5200 });
      }
      return;
    }

    const nextStatus = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : action === 'claimed' ? 'Claimed' : 'Returned';

    let reportRecord = null;
    try {
      const { data } = await sb.from('item_reports').select('*').eq('id', id).maybeSingle();
      reportRecord = data || null;
    } catch (_) {}

    const { data: updatedReport, error } = await sb
      .from('item_reports')
      .update({ status: nextStatus })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) { showError(error.message, { position: 'top-right' }); return; }
    if (!updatedReport || String(updatedReport.status || '') !== nextStatus) {
      showError('Report update did not apply. Please check Supabase RLS for item_reports update access.', { position: 'top-right' });
      return;
    }

    await createAuditLog(`Report ${nextStatus}`, 'item_report', id, nextStatus);

    const itemName = reportRecord?.item_name || 'Your item report';
    const title = `Your report was ${nextStatus}`;
    const message = nextStatus === 'Approved'
      ? `${itemName} was approved and is now visible in the item listings.`
      : nextStatus === 'Rejected'
        ? `${itemName} was reviewed and rejected. Please coordinate with the Security / Lost & Found Office for clarification.`
        : `${itemName} was updated to ${nextStatus}.`;

    if (reportRecord?.user_id) {
      await createNotification({ recipientUserId: reportRecord.user_id, title, message, type: 'report', relatedId: id });
    } else if (null) {
      await createNotification({ recipientEmail: reportRecord.reporter_email, title, message, type: 'report', relatedId: id });
    }

    await renderAdminReports();
    await refreshAdminAnalyticsViews();
  });

  document.getElementById('requestTicketBtn')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const modal = document.getElementById('requestTicketModal');
    if (typeof gcfindOpenModalFixed === 'function') gcfindOpenModalFixed(modal);
    else modal?.classList.remove('hidden');
  });
  document.getElementById('requestTicketCancel')?.addEventListener('click', () => {
    const modal = document.getElementById('requestTicketModal');
    if (typeof gcfindCloseModalFixed === 'function') gcfindCloseModalFixed(modal);
    else modal?.classList.add('hidden');
  });
  document.getElementById('requestTicketSubmit')?.addEventListener('click', async () => {
    const txt = document.getElementById('requestTicketText')?.value?.trim();
    if (!txt) return showError('Please describe the issue.', { position:'top-right' });
    try {
      await createRequestTicket(txt);
      showSuccess('Request ticket submitted to System Administrator.', { position:'top-right' });
      if (typeof gcfindCloseModalFixed === 'function') gcfindCloseModalFixed(document.getElementById('requestTicketModal')); else document.getElementById('requestTicketModal')?.classList.add('hidden');
      document.getElementById('requestTicketText').value = '';
    } catch (err) {
      showInfo('Ticket was saved to audit logs. Run request_tickets SQL for full ticket inbox.', { position:'top-right', duration: 3500 });
      if (typeof gcfindCloseModalFixed === 'function') gcfindCloseModalFixed(document.getElementById('requestTicketModal')); else document.getElementById('requestTicketModal')?.classList.add('hidden');
    }
  });

  const claimsTable = $('#adminClaimsTable');
  claimsTable?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-claim-action]');
    if (!btn || !requireSupabase()) return;

    const action = btn.dataset.claimAction;
    const claimId = btn.dataset.claimId;
    const reportId = btn.dataset.reportId;

    if (action === 'delete') {
      const ok = await appConfirm('Delete this claim request? This will remove the claim update notification from the user dashboard.');
      if (!ok) return;

      const { error } = await sb.from('claim_requests').delete().eq('id', claimId);
      if (error) { showError(error.message, { position: 'top-right' }); return; }

      await createAuditLog('Claim Request Deleted', 'claim_request', claimId, reportId || '');
      showSuccess('Claim request deleted.', { position: 'top-right' });
      await renderAdminClaims();
      if (typeof renderAdminAnalyticsCharts === 'function') await renderAdminAnalyticsCharts();
      return;
    }

    const nextStatus = action === 'approve' ? 'Approved' : 'Rejected';

    let claimRecord = null;
    let reportRecord = null;
    try {
      const { data: claimData } = await sb.from('claim_requests').select('*').eq('id', claimId).single();
      claimRecord = claimData || null;
    } catch (_) {}
    try {
      const targetReportId = reportId || claimRecord?.report_id;
      if (targetReportId) {
        const { data: reportData } = await sb.from('item_reports').select('*').eq('id', targetReportId).maybeSingle();
        reportRecord = reportData || null;
      }
    } catch (_) {}

    const { data: updatedClaim, error } = await sb
      .from('claim_requests')
      .update({ status: nextStatus })
      .eq('id', claimId)
      .select('*')
      .maybeSingle();
    if (error) { showError(error.message, { position: 'top-right' }); return; }
    if (!updatedClaim || String(updatedClaim.status || '') !== nextStatus) {
      showError('Claim update did not apply. Please check Supabase RLS for claim_requests update access.', { position: 'top-right' });
      return;
    }

    await createAuditLog(`Claim ${nextStatus}`, 'claim_request', claimId, reportId || '');

    const itemName = reportRecord?.item_name || 'your claim request';
    const notificationTitle = nextStatus === 'Approved' ? 'Claim Request Approved' : 'Claim Request Rejected';
    const notificationMessage = nextStatus === 'Approved'
      ? `${itemName} has been approved. Please proceed to the Security / Lost & Found Office for verification and release.`
      : `${itemName} was not approved. Please coordinate with the Security / Lost & Found Office if you need clarification.`;

    if (claimRecord?.claimant_id) {
      await createNotification({ recipientUserId: claimRecord.claimant_id, title: notificationTitle, message: notificationMessage, type: 'claim', relatedId: claimId });
    } else if (claimRecord?.claimant_email) {
      await createNotification({ recipientEmail: claimRecord.claimant_email, title: notificationTitle, message: notificationMessage, type: 'claim', relatedId: claimId });
    }

    if (nextStatus === 'Approved' && (reportId || claimRecord?.report_id)) {
      const targetReportId = reportId || claimRecord?.report_id;
      await sb.from('item_reports').update({ status: 'Claimed' }).eq('id', targetReportId);
      await createAuditLog('Report Claimed', 'item_report', targetReportId, targetReportId);
      if (reportRecord?.user_id && reportRecord.user_id !== claimRecord?.claimant_id) {
        await createNotification({
          recipientUserId: reportRecord.user_id,
          title: 'Your Report Has a Claimed Item',
          message: `${itemName} has an approved claim and was marked as claimed.`,
          type: 'report',
          relatedId: targetReportId
        });
      }
      await renderAdminReports();
    }

    showSuccess(`Claim ${nextStatus.toLowerCase()} and notification sent.`, { position: 'top-right' });
    await renderAdminClaims();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
    if (typeof loadUserClaimNotifications === 'function') await loadUserClaimNotifications();
    if (typeof renderAdminAnalyticsCharts === 'function') await renderAdminAnalyticsCharts();
  });
}




function getDeletedRequestTicketIds() {
  try { return JSON.parse(localStorage.getItem('gcfind_deleted_request_ticket_ids') || '[]').map(String); }
  catch (_) { return []; }
}
function saveDeletedRequestTicketId(id) {
  if (!id) return;
  const list = getDeletedRequestTicketIds();
  if (!list.includes(String(id))) list.push(String(id));
  localStorage.setItem('gcfind_deleted_request_ticket_ids', JSON.stringify(list));
}

async function fetchRequestTickets() {
  if (!requireSupabase()) return [];
  const { data, error } = await sb
    .from('request_tickets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('request_tickets not available yet:', error.message);
    return [];
  }
  const hidden = new Set(getDeletedRequestTicketIds());
  return (data || []).filter(t => !hidden.has(String(t.id)));
}

async function createRequestTicket(message) {
  const authUser = await getAuthUser(); const sessionUser = getUser();
  const payload = { requested_by: authUser?.id || null, requester_email: sessionUser?.email || authUser?.email || '', requester_name: sessionUser?.name || '', requester_role: sessionUser?.role || '', message, status: 'Pending' };
  const { data, error } = await sb.from('request_tickets').insert(payload).select().single();
  if (error) { await createAuditLog('Request Ticket Submitted','ticket','',message); throw error; }
  await createAuditLog('Request Ticket Submitted','ticket', data?.id || '', message);
  await createNotification({ recipientRole: 'system_admin', title: 'New CSSU Request Ticket', message, type: 'ticket', relatedId: data?.id || null });
  await createNotification({ recipientUserId: authUser?.id || null, recipientEmail: sessionUser?.email || authUser?.email || null, title: 'Request Ticket Submitted', message: 'Your request ticket is pending System Administrator response.', type: 'ticket', relatedId: data?.id || null });
  if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
  return data;
}
async function updateRequestTicket(ticketId, status, response) {
  let ticket = null; try { const { data } = await sb.from('request_tickets').select('*').eq('id', ticketId).single(); ticket = data || null; } catch (_) {}
  const { error } = await sb.from('request_tickets').update({ status, admin_response: response || null, updated_at: new Date().toISOString() }).eq('id', ticketId);
  if (error) throw error;
  await createAuditLog(`Request Ticket ${status}`, 'ticket', ticketId, response || status);
  const notificationTitle = status === 'Resolved' ? 'Request Ticket Marked as Resolved' : 'New Reply from System Administrator';
  const notificationMessage = status === 'Resolved'
    ? (response || 'Your request ticket has been marked as resolved by the System Administrator.')
    : (response || 'Your request ticket received a reply from the System Administrator.');
  if (ticket?.requested_by) {
    await createNotification({ recipientUserId: ticket.requested_by, title: notificationTitle, message: notificationMessage, type: 'ticket', relatedId: ticketId });
  } else {
    await createNotification({ recipientRole: 'admin', title: notificationTitle, message: notificationMessage, type: 'ticket', relatedId: ticketId });
  }
  await createNotification({
    recipientRole: 'system_admin',
    title: status === 'Resolved' ? 'Ticket marked as resolved' : 'System Administrator response sent',
    message: response || status,
    type: 'ticket',
    relatedId: ticketId
  });
  if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
  if (typeof renderAdminTicketNotifications === 'function') await renderAdminTicketNotifications();
}
async function deleteRequestTicket(ticketId) {
  if (!ticketId) return true;

  // Always hide locally first so UI stays fixed even when RLS blocks DB delete.
  try {
    saveDeletedRequestTicketId(ticketId);
    if (typeof hideSystemAdminTicketLocally === 'function') hideSystemAdminTicketLocally(ticketId);
    if (typeof hideSystemAdminTicketNotificationLocally === 'function') hideSystemAdminTicketNotificationLocally(ticketId);
    if (typeof hideTicketUpdateLocally === 'function') hideTicketUpdateLocally(ticketId);
  } catch (_) {}

  let ticket = null;
  try {
    const { data } = await sb.from('request_tickets').select('*').eq('id', ticketId).single();
    ticket = data || null;
  } catch (_) {}

  try {
    const { error } = await sb.from('request_tickets').delete().eq('id', ticketId);
    if (error) console.warn('Request ticket DB delete blocked, local hide applied:', error.message);
  } catch (err) {
    console.warn('Request ticket delete fallback applied:', err.message);
  }

  try { await createAuditLog('Request Ticket Deleted', 'ticket', ticketId, ticket?.message || 'Deleted ticket'); } catch (_) {}
  return true;
}


async function fetchAllProfiles() {
  if (!requireSupabase()) return [];
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

function downloadBlob(filename, content, mime='text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(rows) {
  if (!rows || !rows.length) return 'No data\n';
  const keys = Array.from(rows.reduce((set, row) => { Object.keys(row || {}).forEach(k => set.add(k)); return set; }, new Set()));
  const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}


function formatPdfDate() {
  return new Date().toLocaleString();
}

function getJsPDF() {
  return window.jspdf?.jsPDF || window.jsPDF || null;
}

function makeSafeFileName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function exportRowsToPdf(filename, title, columns, rows) {
  const JSPDF = getJsPDF();
  if (!JSPDF || typeof window.jspdf === 'undefined' && typeof window.jsPDF === 'undefined') {
    alert('PDF library is not loaded yet. Please reload the page and try again.');
    return;
  }
  const doc = new JSPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated by GCFind System Administrator • ${formatPdfDate()}`, 40, 60);

  const body = rows.map(row => columns.map(col => String(row[col.key] ?? '—')));
  doc.autoTable({
    startY: 80,
    head: [columns.map(col => col.label)],
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 5, overflow: 'linebreak' },
    headStyles: { fillColor: [4, 120, 87], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: 40, right: 40 },
    didDrawPage: function (data) {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber} of ${pageCount}`, pageWidth - 90, doc.internal.pageSize.getHeight() - 20);
    }
  });
  doc.save(`${makeSafeFileName(filename)}.pdf`);
}

async function exportSystemData(kind) {
  if (kind === 'reports') {
    const rows = await fetchAllReports();
    exportRowsToPdf(
      'gcfind-reports',
      'GCFind Report Records',
      [
        { key: 'itemName', label: 'Item Name' },
        { key: 'type', label: 'Type' },
        { key: 'category', label: 'Category' },
        { key: 'location', label: 'Location' },
        { key: 'date', label: 'Date Reported' },
        { key: 'status', label: 'Status' },
        { key: 'submittedByName', label: 'Submitted By' },
        { key: 'submittedBy', label: 'Submitter Email / ID' }
      ],
      rows
    );
  } else if (kind === 'claims') {
    const rows = await fetchAllClaims();
    exportRowsToPdf(
      'gcfind-claims',
      'GCFind Claim Request Records',
      [
        { key: 'claimantName', label: 'Claimant' },
        { key: 'claimantEmail', label: 'Claimant Email / ID' },
        { key: 'message', label: 'Claim Message' },
        { key: 'status', label: 'Status' },
        { key: 'createdAt', label: 'Requested At' },
        { key: 'reportId', label: 'Report ID' }
      ],
      rows
    );
  } else if (kind === 'profiles') {
    const rows = await fetchAllProfiles();
    exportRowsToPdf(
      'gcfind-users',
      'GCFind User / Account Records',
      [
        { key: 'full_name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role' },
        { key: 'department', label: 'Department / Program' },
        { key: 'created_at', label: 'Created At' }
      ],
      rows
    );
  }
}




/* ===================== SYSTEM ADMIN ACTIONS v2.8 ===================== */
async function callAdminApi(endpoint, payload) {
  const { data: sessionData } = await sb.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Admin action failed.');
  return data;
}

function ensureSystemAdminModal() {
  let modal = document.getElementById('systemAdminModal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'systemAdminModal';
  modal.className = 'gc-admin-modal';
  modal.innerHTML = `
    <div class="gc-admin-modal-backdrop" data-sysadmin-close></div>
    <div class="gc-admin-modal-card">
      <div id="systemAdminModalBody"></div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-sysadmin-close]').forEach(el => el.addEventListener('click', closeSystemAdminModal));
  return modal;
}

function openSystemAdminModal(html) {
  const modal = ensureSystemAdminModal();
  const body = document.getElementById('systemAdminModalBody');
  body.innerHTML = html;
  if (typeof gcfindOpenModalFixed === 'function') gcfindOpenModalFixed(modal);
  else modal.classList.add('is-open');
}

function closeSystemAdminModal() {
  const modal = document.getElementById('systemAdminModal');
  if (typeof gcfindCloseModalFixed === 'function') gcfindCloseModalFixed(modal);
  else modal?.classList.remove('is-open');
}

function getPasswordSetupRedirectUrl() {
  const origin = window.location.origin;
  // Local server commonly serves the project folder path; production Vercel uses root.
  if (origin.includes('127.0.0.1') || origin.includes('localhost')) {
    const basePath = window.location.pathname.includes('/GCFIND-Demo/') ? '/GCFIND-Demo' : '';
    return `${origin}${basePath}/pages/reset-password.html`;
  }
  return `${origin}/pages/reset-password.html`;
}

function generateInitialPassword() {
  if (crypto?.getRandomValues) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, n => chars[n % chars.length]).join('');
  }
  return `GCFind-${Date.now()}!`;
}



function enhanceSystemAdminRoleSelect(select) {
  if (!select || select.dataset.gcCustomSelectReady === 'true') return;
  select.dataset.gcCustomSelectReady = 'true';
  select.classList.add('gc-select-enhanced-source');

  const wrapper = document.createElement('div');
  wrapper.className = 'gc-custom-select gc-system-admin-role-select';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gc-custom-select-button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-chevron-down';
  button.append(label, icon);

  const list = document.createElement('div');
  list.className = 'gc-custom-select-list hidden';
  list.setAttribute('role', 'listbox');

  wrapper.append(button, list);
  select.insertAdjacentElement('afterend', wrapper);

  function currentText() {
    return select.options[select.selectedIndex]?.textContent || 'Select role';
  }

  function rebuild() {
    label.textContent = currentText();
    list.innerHTML = '';
    Array.from(select.options).forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'gc-custom-select-option';
      item.textContent = option.textContent || '';
      item.dataset.value = option.value;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close();
        rebuild();
      });
      list.appendChild(item);
    });
  }

  function open() {
    document.querySelectorAll('.gc-custom-select.open').forEach((other) => {
      if (other !== wrapper) {
        other.classList.remove('open');
        other.querySelector('.gc-custom-select-list')?.classList.add('hidden');
        other.querySelector('.gc-custom-select-button')?.setAttribute('aria-expanded', 'false');
      }
    });
    wrapper.classList.add('open');
    list.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
  }

  function close() {
    wrapper.classList.remove('open');
    list.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    wrapper.classList.contains('open') ? close() : open();
  });

  select.addEventListener('change', rebuild);
  rebuild();
}



function enhanceSystemAdminRoleSelectFinal(select) {
  if (!select || select.dataset.gcSystemAdminRoleReady === 'true') return;
  select.dataset.gcSystemAdminRoleReady = 'true';

  select.classList.add('gc-select-enhanced-source');

  const wrapper = document.createElement('div');
  wrapper.className = 'gc-custom-select gc-system-admin-role-select';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gc-custom-select-button';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  const icon = document.createElement('i');
  icon.className = 'fa-solid fa-chevron-down';
  button.append(label, icon);

  const list = document.createElement('div');
  list.className = 'gc-custom-select-list hidden';
  list.setAttribute('role', 'listbox');

  wrapper.append(button, list);
  select.insertAdjacentElement('afterend', wrapper);

  function closeAllExceptCurrent() {
    document.querySelectorAll('.gc-custom-select.open').forEach((other) => {
      if (other !== wrapper) {
        other.classList.remove('open');
        other.querySelector('.gc-custom-select-list')?.classList.add('hidden');
        other.querySelector('.gc-custom-select-button')?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function currentText() {
    return select.options[select.selectedIndex]?.textContent || 'Select role';
  }

  function rebuild() {
    label.textContent = currentText();
    list.innerHTML = '';
    Array.from(select.options).forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'gc-custom-select-option';
      item.textContent = option.textContent || '';
      item.dataset.value = option.value || '';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close();
        rebuild();
      });
      list.appendChild(item);
    });
  }

  function open() {
    closeAllExceptCurrent();
    wrapper.classList.add('open');
    list.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
  }

  function close() {
    wrapper.classList.remove('open');
    list.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
  }

  button.addEventListener('click', (event) => {
    event.preventDefault();
    wrapper.classList.contains('open') ? close() : open();
  });

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) close();
  });

  select.addEventListener('change', rebuild);
  new MutationObserver(rebuild).observe(select, { childList: true });
  rebuild();
}

function initSystemAdminRoleDropdownFinal() {
  enhanceSystemAdminRoleSelectFinal(document.getElementById('sysCreateRole'));
}

function openCreateAccountModal() {
  openSystemAdminModal(`
    <h3>Create Account</h3>
    <p class="mt-1 text-sm text-slate-600">Create a new GCFind user account. Set a temporary password for the user.</p>
    <form id="sysCreateAccountForm">
      <label>Full Name</label>
      <input id="sysCreateName" required placeholder="e.g., Juan Dela Cruz" />
      <label>Email</label>
      <input id="sysCreateEmail" type="email" required placeholder="user@gordoncollege.edu.ph" />
      <label>Role</label>
      <select id="sysCreateRole" required>
        <option value="student">Student</option>
        <option value="faculty_staff">Faculty / Staff</option>
        <option value="admin">Security / Lost & Found Office</option>
        <option value="system_admin">System Administrator</option>
      </select>
      <label>Department / Program</label>
      <input id="sysCreateDepartment" placeholder="e.g., CCSE / CCS" />

      <label>Temporary Password</label>
      <div class="relative">
        <input id="sysCreatePassword" type="password" required placeholder="e.g., GCFind@2026!" autocomplete="new-password" />
        <button type="button" id="toggleSysPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-700">Show</button>
      </div>
      <div id="sysPasswordStrength" class="gc-password-strength gc-password-strength-empty" aria-live="polite">
        <div class="gc-password-strength-track"><span></span></div>
        <div class="gc-password-strength-label">Enter a password</div>
      </div>
      <div class="gc-muted-note">Password must contain uppercase, lowercase, number, special character, and at least 8 characters. User can change it later using Forgot Password.</div>
      <div class="gc-muted-note">After creating the account, provide the temporary password to the user. They can change it later using Forgot Password.</div>
      <div class="gc-admin-modal-actions">
        <button type="button" class="rounded-xl px-4 py-2 text-sm font-semibold gc-secondary-btn" onclick="closeSystemAdminModal()">Cancel</button>
        <button type="submit" class="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Create Account</button>
      </div>
    </form>`);

  const toggleSysPassword = document.getElementById('toggleSysPassword');
  const sysCreatePassword = document.getElementById('sysCreatePassword');
  if (toggleSysPassword && sysCreatePassword) {
    toggleSysPassword.addEventListener('click', () => {
      const showing = sysCreatePassword.type === 'text';
      sysCreatePassword.type = showing ? 'password' : 'text';
      toggleSysPassword.textContent = showing ? 'Show' : 'Hide';
    });
  }

  const sysPasswordStrength = document.getElementById('sysPasswordStrength');
  function updateSysPasswordStrength() {
    if (!sysCreatePassword || !sysPasswordStrength) return;
    const value = sysCreatePassword.value || '';
    let score = 0;
    if (value.length >= 8) score++;
    if (/[a-z]/.test(value)) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/\d/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;

    sysPasswordStrength.classList.remove('gc-password-strength-empty', 'gc-password-strength-weak', 'gc-password-strength-medium', 'gc-password-strength-strong');
    if (!value) {
      sysPasswordStrength.classList.add('gc-password-strength-empty');
      sysPasswordStrength.querySelector('.gc-password-strength-label').textContent = 'Enter a password';
    } else if (score <= 2) {
      sysPasswordStrength.classList.add('gc-password-strength-weak');
      sysPasswordStrength.querySelector('.gc-password-strength-label').textContent = 'Weak';
    } else if (score <= 4) {
      sysPasswordStrength.classList.add('gc-password-strength-medium');
      sysPasswordStrength.querySelector('.gc-password-strength-label').textContent = 'Medium';
    } else {
      sysPasswordStrength.classList.add('gc-password-strength-strong');
      sysPasswordStrength.querySelector('.gc-password-strength-label').textContent = 'Strong';
    }
  }
  sysCreatePassword?.addEventListener('input', updateSysPasswordStrength);
  updateSysPasswordStrength();

  document.getElementById('sysCreateAccountForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('sysCreateEmail').value.trim().toLowerCase();
    const payload = {
      full_name: document.getElementById('sysCreateName').value.trim(),
      email,
      password: document.getElementById('sysCreatePassword').value.trim(),
      role: document.getElementById('sysCreateRole').value,
      department: document.getElementById('sysCreateDepartment').value.trim() || 'General'
    };

    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
    if (!passwordPattern.test(payload.password)) {
      showError('Password must contain uppercase, lowercase, number, special character, and at least 8 characters.', { position: 'top-right', duration: 7000 });
      return;
    };

    try {
      showLoading('Creating account...');
      let created = false;

      try {
        await callAdminApi('/api/admin-create-account', payload);
        created = true;
      } catch (apiErr) {
        console.warn('Admin create API unavailable, using Supabase signup fallback:', apiErr.message);
        const { data, error } = await sb.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            data: {
              full_name: payload.full_name,
              role: payload.role,
              department: payload.department
            }
          }
        });
        if (error) throw error;

        if (data?.user?.id) {
          try {
            await sb.from('profiles').upsert({
              id: data.user.id,
              full_name: payload.full_name,
              email: payload.email,
              role: payload.role,
              department: payload.department
            }, { onConflict: 'id' });
          } catch (profileErr) {
            console.warn('Profile upsert skipped:', profileErr.message);
          }
        }
        created = true;
      }

      hideLoading();
      showSuccess('Account created. A password setup link has been sent to the user.', { position: 'top-right', duration: 4200 });
      closeSystemAdminModal();
      await renderSystemAdmin();
    } catch (err) {
      hideLoading();
      showError(`Create account failed: ${err.message}`, { position: 'top-right', duration: 5200 });
    }
  });
}


function openResetPasswordModal() {
  openSystemAdminModal(`
    <h3>Send Password Reset</h3>
    <p class="mt-1 text-sm text-slate-600">Send a reset password email to a registered account.</p>
    <form id="sysResetPasswordForm">
      <label>User Email</label>
      <input id="sysResetEmail" type="email" required placeholder="user@gordoncollege.edu.ph" />
      <div class="gc-muted-note">This will send a password reset email to the selected user.</div>
      <div class="gc-admin-modal-actions">
        <button type="button" class="rounded-xl px-4 py-2 text-sm font-semibold gc-secondary-btn" onclick="closeSystemAdminModal()">Cancel</button>
        <button type="submit" class="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Send Password Reset</button>
      </div>
    </form>`);
  document.getElementById('sysResetPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('sysResetEmail').value.trim().toLowerCase();
    try {
      showLoading('Sending password reset email...');
      await callAdminApi('/api/admin-reset-password', { email });
      hideLoading();
      showSuccess('Password reset email sent.', { position: 'top-right' });
      closeSystemAdminModal();
    } catch (err) {
      hideLoading();
      try {
        // safe fallback for local testing; uses public Supabase reset flow
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password.html` });
        if (error) throw error;
        showSuccess('Password reset email requested.', { position: 'top-right' });
        closeSystemAdminModal();
      } catch (fallbackErr) {
        showError(fallbackErr.message || err.message, { position: 'top-right', duration: 4200 });
      }
    }
  });
}

async function openRecoverAccountModal() {
  const profiles = await fetchAllProfiles();
  openSystemAdminModal(`
    <h3>Recover Account</h3>
    <p class="mt-1 text-sm text-slate-600">Search an account record and copy the user email for recovery support.</p>
    <div class="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      Use <strong>Copy Email</strong>, then use the main <strong>Send Reset Password</strong> tool if the user needs password recovery.
    </div>
    <label>Search Email or Name</label>
    <input id="sysRecoverSearch" placeholder="Type email or name..." />
    <div id="sysRecoverResults" class="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200"></div>
    <div class="gc-admin-modal-actions">
      <button type="button" class="rounded-xl px-4 py-2 text-sm font-semibold gc-secondary-btn" onclick="closeSystemAdminModal()">Close</button>
    </div>`);
  const render = () => {
    const q = (document.getElementById('sysRecoverSearch').value || '').toLowerCase();
    const matches = profiles.filter(p => `${p.full_name || ''} ${p.email || ''} ${p.role || ''} ${p.department || ''}`.toLowerCase().includes(q)).slice(0, 20);
    document.getElementById('sysRecoverResults').innerHTML = matches.length ? matches.map(p => {
      const safeEmail = escapeHtml(p.email || '');
      return `
      <div class="border-b border-slate-200 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div class="min-w-0 flex-1">
          <div class="font-extrabold text-slate-900">${escapeHtml(p.full_name || 'Unnamed Account')}</div>
          <div class="break-all text-sm text-slate-600">${escapeHtml(p.email || '—')}</div>
          <div class="mt-1 text-xs font-bold text-emerald-800">${escapeHtml(friendlyRole(p.role || ''))} • ${escapeHtml(p.department || 'General')}</div>
        </div>
        <div class="mt-3 flex shrink-0 items-center gap-2 sm:mt-0">
          <button type="button" class="whitespace-nowrap rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800" title="Copy this user email address" onclick="navigator.clipboard?.writeText('${safeEmail}'); showSuccess('Email copied.', { position: 'top-right' });">Copy Email</button>
        </div>
      </div>`;
    }).join('') : '<div class="p-4 text-sm text-slate-600">No matching account found.</div>';
  };
  document.getElementById('sysRecoverSearch')?.addEventListener('input', render);
  render();
}


function getHiddenArchiveIds() {
  try { return JSON.parse(localStorage.getItem('gcfind_hidden_archive_ids') || '[]').map(String); }
  catch (_) { return []; }
}
function hideArchiveLocally(id) {
  if (!id) return;
  const list = getHiddenArchiveIds();
  if (!list.includes(String(id))) list.push(String(id));
  localStorage.setItem('gcfind_hidden_archive_ids', JSON.stringify(list));
}

async function openRecoverDataModal() {
  let archives = [];
  try {
    const { data } = await sb.from('deleted_records_archive').select('*').is('restored_at', null).order('deleted_at', { ascending: false });
    archives = (data || []).filter(a => !getHiddenArchiveIds().includes(String(a.id)));
  } catch (err) {
    archives = [];
  }

  const rows = archives.length ? archives.map(a => {
    const rec = a.record_data || {};
    return `<div class="border-b border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div class="min-w-0">
        <div class="font-extrabold text-slate-900">${escapeHtml(rec.item_name || rec.itemName || a.original_record_id || 'Deleted record')}</div>
        <div class="text-sm text-slate-600">${escapeHtml(a.source_table || 'table')} • ${escapeHtml(formatDateTime(a.deleted_at))}</div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button class="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition" data-archive-restore="${escapeHtml(a.id)}">Restore</button>
        <button class="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 transition" data-archive-delete="${escapeHtml(a.id)}">Delete</button>
      </div>
    </div>`;
  }).join('') : '<div class="p-4 text-sm text-slate-600">No deleted reports available.</div>';

  openSystemAdminModal(`
    <h3>Restore Deleted Data</h3>
    <p class="mt-1 text-sm text-slate-600">Recover archived deleted reports. This is a System Administrator action, not a request message.</p>
    <div class="mt-3 rounded-xl border border-slate-200 max-h-80 overflow-y-auto">${rows}</div>
    <div class="gc-muted-note">Deleted reports can only be restored if they were saved before deletion.</div>
    <div class="gc-admin-modal-actions">
      <button type="button" class="rounded-xl px-4 py-2 text-sm font-semibold gc-secondary-btn" onclick="closeSystemAdminModal()">Close</button>
    </div>`);
}


let GC_CURRENT_TICKET_ID = null;
function openTicketReplyModal(ticketId, existingResponse = '') {
  GC_CURRENT_TICKET_ID = ticketId;
  let modal = document.getElementById('ticketReplyModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ticketReplyModal';
    modal.className = 'fixed inset-0 z-[70] hidden';
    modal.innerHTML = `
      <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" data-ticket-reply-close></div>
      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-xl rounded-3xl bg-white shadow-soft ring-1 ring-slate-200 overflow-hidden">
          <div class="border-b border-slate-200 bg-emerald-50 px-5 py-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-reply mr-2 text-emerald-700"></i>Reply to CSSU Request Ticket</h3>
                <p class="mt-1 text-sm text-slate-600">Write a clear admin response. CSSU will see this update in their dashboard.</p>
              </div>
              <button class="rounded-xl bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200" data-ticket-reply-close>×</button>
            </div>
          </div>
          <div class="p-5">
            <label class="text-sm font-bold text-slate-700" for="ticketReplyText">Response message</label>
            <textarea id="ticketReplyText" class="mt-2 w-full rounded-2xl border border-slate-300 p-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" rows="6" placeholder="Type the response for CSSU..."></textarea>
            <div class="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button class="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50" data-ticket-reply-close>Cancel</button>
              <button id="ticketReplySendBtn" class="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><i class="fa-solid fa-paper-plane mr-2"></i>Send Reply</button>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll('[data-ticket-reply-close]').forEach(el => el.addEventListener('click', closeTicketReplyModal));
    modal.querySelector('#ticketReplySendBtn')?.addEventListener('click', submitTicketReplyModal);
  }
  modal.querySelector('#ticketReplyText').value = existingResponse || '';
  modal.classList.remove('hidden');
  setTimeout(() => modal.querySelector('#ticketReplyText')?.focus(), 50);
}
function closeTicketReplyModal() {
  document.getElementById('ticketReplyModal')?.classList.add('hidden');
  GC_CURRENT_TICKET_ID = null;
}
async function submitTicketReplyModal() {
  if (!GC_CURRENT_TICKET_ID) return;
  const response = document.getElementById('ticketReplyText')?.value?.trim();
  if (!response) return showError('Please type a response before sending.', { position: 'top-right' });
  try {
    await updateRequestTicket(GC_CURRENT_TICKET_ID, 'Responded', response);
    showSuccess('Ticket response sent. CSSU has been notified.', { position: 'top-right' });
    closeTicketReplyModal();
    await renderSystemAdmin();
  } catch (err) {
    showError(err.message || 'Unable to send reply.', { position: 'top-right' });
  }
}


function ticketNotificationCard(t, variant = 'ticket') {
  const status = String(t.status || 'Pending');
  const responded = Boolean(t.admin_response);
  const isResolved = status.toLowerCase() === 'resolved';
  const isRead = Boolean(t._is_read_local);
  const title = isResolved
    ? 'Ticket marked as resolved'
    : responded
      ? 'System Administrator response sent'
      : 'New CSSU request ticket received';
  const message = responded
    ? (t.admin_response || 'A response was sent to CSSU.')
    : (t.message || 'A new request ticket was submitted by CSSU.');
  const badgeClass = isResolved ? 'bg-emerald-100 text-emerald-800' : responded ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800';

  return `
    <article class="p-4 ${isRead ? 'bg-white' : 'bg-emerald-50/60'}">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="font-extrabold text-slate-900">${escapeHtml(title)}</h3>
            <span class="inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${badgeClass}">${escapeHtml(status)}</span>
          </div>
          <p class="mt-1 text-sm text-slate-600">${escapeHtml(message)}</p>
          <p class="mt-2 text-xs text-slate-500">${escapeHtml(t.requester_email || 'CSSU')} • ${escapeHtml(formatDateTime(t.updated_at || t.created_at))}</p>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          ${!isRead ? `<button type="button" class="rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50" data-system-ticket-notif-read="${escapeHtml(t.id)}">Mark read</button>` : ''}
          <button type="button" class="rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50" data-system-ticket-notif-delete="${escapeHtml(t.id)}">Delete</button>
        </div>
      </div>
    </article>`;
}

async function fetchSystemAdminTicketNotifications(limit = 8) {
  let notifications = [];
  try {
    notifications = await fetchNotificationsForCurrentUser(limit);
  } catch (err) {
    console.warn('Unable to fetch system admin notification rows:', err.message);
    notifications = [];
  }

  let tickets = [];
  try {
    tickets = await fetchRequestTickets();
  } catch (err) {
    console.warn('Unable to fetch ticket notification fallback:', err.message);
    tickets = [];
  }

  const notificationCards = (notifications || []).map(n => ({
    id: `n-${n.id}`,
    created_at: n.created_at,
    html: typeof notificationCard === 'function' ? notificationCard(n) : `
      <article class="p-4">
        <h3 class="font-extrabold text-slate-900">${escapeHtml(n.title || 'Notification')}</h3>
        <p class="mt-1 text-sm text-slate-600">${escapeHtml(n.message || '')}</p>
        <p class="mt-2 text-xs text-slate-500">${escapeHtml(formatDateTime(n.created_at))}</p>
      </article>`
  }));

  const hiddenTicketNotifications = new Set(getSystemAdminHiddenTicketNotificationIds().map(String));
  const readTicketNotifications = new Set(getSystemAdminTicketReadIds().map(String));
  const ticketCards = (tickets || [])
    .filter(t => !hiddenTicketNotifications.has(String(t.id)))
    .map(t => ({
    id: `t-${t.id}`,
    created_at: t.updated_at || t.created_at,
    html: ticketNotificationCard({ ...t, _is_read_local: readTicketNotifications.has(String(t.id)) })
  }));

  return [...notificationCards, ...ticketCards]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, limit);
}

async function renderSystemAdmin() {
  const mount = document.getElementById('systemAdminMount');
  if (!mount) return;
  const user = getUser();
  if (user?.role !== 'system_admin') {
    mount.innerHTML = `<div class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 text-sm text-slate-600">This page is available for the System Administrator only.</div>`;
    return;
  }
  const [profiles, reports, claims] = await Promise.all([fetchAllProfiles(), fetchAllReports(), fetchAllClaims()]);
  mount.innerHTML = `
    <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <div class="analytics-card"><div><div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Users</div><div class="mt-2 text-3xl font-extrabold text-slate-900">${profiles.length}</div></div></div>
      <div class="analytics-card"><div><div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Reports</div><div class="mt-2 text-3xl font-extrabold text-emerald-600">${reports.length}</div></div></div>
      <div class="analytics-card"><div><div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Claims</div><div class="mt-2 text-3xl font-extrabold text-emerald-600">${claims.length}</div></div></div>
      <div class="analytics-card"><div><div class="text-xs font-semibold uppercase tracking-wide text-slate-500">System Status</div><div class="mt-2 text-lg font-bold text-slate-900">Operational</div></div></div>
    </section>
    <section class="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900">System Administrator</h2><p class="mt-1 text-sm text-slate-600">Manage accounts, access controls, password recovery, and administrative recovery requests.</p></div>
        <div class="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700" data-admin-tool="create-account">Create Account</button>
          <button class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700" data-admin-tool="recover-account">Recover Account</button>
          <button class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700" data-admin-tool="reset-password">Send Reset Password</button>
          <button class="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700" data-admin-tool="recover-data">Recover Deleted Data</button>
        </div>
      </div>
      <div class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900">Data Backup and Recovery</h2><p class="mt-1 text-sm text-slate-600">Export core records for backup and administrative review.</p></div>
        <div class="p-5 grid grid-cols-2 gap-3">
          <button class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" data-export="profiles">Export Users</button>
          <button class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" data-export="reports">Export Reports</button>
          <button class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" data-export="claims">Export Claims</button>
          <button class="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" data-export="profiles">Export Accounts</button>
        </div>
      </div>
    </section>
    <section class="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <section class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900">Request Tickets from CSSU</h2><p class="mt-1 text-sm text-slate-600">System-related assistance requests, accidental deletion concerns, and account recovery messages from CSSU.</p></div>
        <div id="systemAdminTicketsBody" class="divide-y divide-slate-200"></div>
      </section>
      <section class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900">Notifications</h2><p class="mt-1 text-sm text-slate-600">Latest system and ticket updates.</p></div>
        <div id="systemAdminNotifications" class="divide-y divide-slate-200"></div>
      </section>
      <section class="system-admin-wide-section rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900">Account List</h2><p class="mt-1 text-sm text-slate-600">View all created accounts and assigned roles.</p></div>
        <div class="system-admin-table-wrap overflow-x-auto"><table class="system-admin-readable-table min-w-full"><thead class="bg-slate-50"><tr class="text-left text-xs font-extrabold uppercase tracking-wide text-slate-600"><th class="px-4 py-3">Name</th><th class="px-4 py-3">Email</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">Department</th></tr></thead><tbody id="systemAdminUsersBody"></tbody></table></div>
        <div id="systemAdminUsersPagination" class="p-4 border-t border-slate-200"></div>
      </section>
      <section class="system-admin-wide-section rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900">Audit Trail Logging</h2><p class="mt-1 text-sm text-slate-600">Recent system actions and changes monitored by the administrator.</p></div>
        <div class="system-admin-table-wrap overflow-x-auto"><table class="system-admin-readable-table system-admin-logs-table min-w-full"><thead class="bg-slate-50"><tr class="text-left text-xs font-extrabold uppercase tracking-wide text-slate-600"><th class="px-4 py-3">Action</th><th class="px-4 py-3">Details</th><th class="px-4 py-3">User</th><th class="px-4 py-3">Date</th></tr></thead><tbody id="systemAdminLogsBody"></tbody></table></div>
        <div id="systemAdminLogsPagination" class="p-4 border-t border-slate-200"></div>
      </section>
    </section>`;

  mount.querySelectorAll('[data-export]').forEach(btn => btn.addEventListener('click', () => exportSystemData(btn.dataset.export)));
  mount.querySelectorAll('[data-admin-tool]').forEach(btn => btn.addEventListener('click', async () => {
    const tool = btn.dataset.adminTool;
    if (tool === 'create-account') return openCreateAccountModal();
    if (tool === 'reset-password') return openResetPasswordModal();
    if (tool === 'recover-account') return openRecoverAccountModal();
    if (tool === 'recover-data') return openRecoverDataModal();
  }));

  
  const ticketBody = document.getElementById('systemAdminTicketsBody');
  if (ticketBody) {
    const allTickets = await fetchRequestTickets();
    const hiddenSystemTickets = new Set(getSystemAdminHiddenTicketIds().map(String));
    const tickets = allTickets.filter(t => !hiddenSystemTickets.has(String(t.id)));
    ticketBody.innerHTML = tickets.length ? tickets.slice(0, 6).map(t => `
      <article class="p-4">
        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <div class="font-extrabold text-slate-900">${escapeHtml(t.requester_name || t.requester_email || 'CSSU Request')}</div>
              ${statusPill(t.status || 'Pending')}
            </div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(t.requester_email || '')} • ${escapeHtml(formatDateTime(t.created_at))}</div>
            <div class="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-200"><span class="font-bold text-slate-900">Request:</span> ${escapeHtml(t.message || '')}</div>
            ${t.admin_response ? `<div class="mt-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-100"><div class="font-extrabold"><i class="fa-solid fa-reply mr-2"></i>System Administrator Response</div><div class="mt-1">${escapeHtml(t.admin_response)}</div></div>` : `<div class="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-100">No admin response yet.</div>`}
          </div>
          <div class="flex flex-wrap lg:justify-end gap-2">
            <button class="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800" data-ticket-reply="${escapeHtml(t.id)}" data-ticket-response="${escapeHtml(t.admin_response || '')}">Reply</button>
            <button class="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800" data-ticket-resolve="${escapeHtml(t.id)}">Mark Resolved</button>
            <button class="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700" data-ticket-delete="${escapeHtml(t.id)}">Delete</button>
          </div>
        </div>
      </article>`).join('') : `<div class="p-5 text-sm text-slate-600">No request tickets yet.</div>`;

    ticketBody.querySelectorAll('[data-ticket-reply]').forEach(btn => btn.addEventListener('click', () => {
      openTicketReplyModal(btn.dataset.ticketReply, btn.dataset.ticketResponse || '');
    }));
    ticketBody.querySelectorAll('[data-ticket-resolve]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await updateRequestTicket(btn.dataset.ticketResolve, 'Resolved', 'This request ticket has been marked as resolved by the System Administrator.');
        showSuccess('Ticket marked resolved.', { position: 'top-right' });
        await renderSystemAdmin();
      } catch (err) {
        showError(err.message, { position: 'top-right' });
      }
    }));
    ticketBody.querySelectorAll('[data-ticket-delete]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await appConfirm('Delete this request ticket?'); if (!ok) return;
      const ticketId = btn.dataset.ticketDelete;
      try { await deleteRequestTicket(ticketId); showSuccess('Ticket deleted.', { position: 'top-right' }); }
      catch (err) { console.warn('Ticket delete blocked, hiding locally:', err.message); hideSystemAdminTicketLocally(ticketId); showSuccess('Ticket removed from this dashboard.', { position: 'top-right' }); }
      await renderSystemAdmin();
    }));
  }


  const adminNotifBox = document.getElementById('systemAdminNotifications');
  if (adminNotifBox) {
    const systemNotifications = await fetchSystemAdminTicketNotifications(8);
    adminNotifBox.innerHTML = systemNotifications.length
      ? systemNotifications.map(n => n.html).join('')
      : `<div class="p-5 text-sm text-slate-600">No notifications yet.</div>`;
    try { await bindNotificationReadButtons(mount, renderSystemAdmin); } catch (e) { console.warn('bindNotificationReadButtons skipped:', e.message); }
    adminNotifBox.querySelectorAll('[data-system-ticket-notif-read]').forEach(btn => btn.addEventListener('click', async () => {
      const ticketId = btn.dataset.systemTicketNotifRead;
      markSystemAdminTicketReadLocally(ticketId);
      showSuccess('Notification marked as read.', { position: 'top-right' });
      await renderSystemAdmin();
    }));
    adminNotifBox.querySelectorAll('[data-system-ticket-notif-delete]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await appConfirm('Delete this ticket notification?');
      if (!ok) return;
      const ticketId = btn.dataset.systemTicketNotifDelete;
      try {
        const { error } = await sb.from('request_tickets').delete().eq('id', ticketId);
        if (error) throw error;
      } catch (err) {
        console.warn('System notification delete blocked, hiding locally:', err.message);
      }
      hideSystemAdminTicketNotificationLocally(ticketId);
      btn.closest('article')?.remove();
      showSuccess('Notification deleted.', { position: 'top-right' });
      await renderSystemAdmin();
    }));
  }

  const usersBody = document.getElementById('systemAdminUsersBody');
  const renderUsersPage = () => {
    const usersPageData = paginate(profiles, APP_STATE.systemAdminUsersPage, APP_STATE.systemAdminPerPage);
    APP_STATE.systemAdminUsersPage = usersPageData.page;
    usersBody.innerHTML = usersPageData.items.length ? usersPageData.items.map(profile => `<tr class="border-t border-slate-200 gc-fade-row"><td class="px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(profile.full_name || '—')}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(profile.email || '—')}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(friendlyRole(profile.role || ''))}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(profile.department || '—')}</td></tr>`).join('') : `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="4">No accounts found.</td></tr>`;
    renderPagination('systemAdminUsersPagination', usersPageData,
      () => withSmoothSectionUpdate('#systemAdminUsersBody', () => { APP_STATE.systemAdminUsersPage--; renderUsersPage(); }),
      () => withSmoothSectionUpdate('#systemAdminUsersBody', () => { APP_STATE.systemAdminUsersPage++; renderUsersPage(); })
    );
  };
  renderUsersPage();

  const logsBody = document.getElementById('systemAdminLogsBody');
  const { data: logs } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false });
  const cleanLogs = (logs || []).filter(isImportantAuditLog);
  const actorMap = await fetchProfileMapByIds(cleanLogs.map(l => l.actor_id).filter(Boolean));
  const renderLogsPage = () => {
    const pageData = paginate(cleanLogs, APP_STATE.systemAdminLogsPage, APP_STATE.systemAdminPerPage);
    APP_STATE.systemAdminLogsPage = pageData.page;
    logsBody.innerHTML = pageData.items.length ? pageData.items.map(log => `<tr class="border-t border-slate-200 gc-fade-row"><td class="px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(cleanAuditAction(log.action))}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(cleanAuditDetails(log))}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(actorMap[log.actor_id]?.full_name || actorMap[log.actor_id]?.email || 'System')}</td><td class="px-4 py-3 text-sm text-slate-700">${formatDateTime(log.created_at)}</td></tr>`).join('') : `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="4">No audit logs yet.</td></tr>`;
    renderPagination('systemAdminLogsPagination', pageData,
      () => withSmoothSectionUpdate('#systemAdminLogsBody', () => { APP_STATE.systemAdminLogsPage--; renderLogsPage(); }),
      () => withSmoothSectionUpdate('#systemAdminLogsBody', () => { APP_STATE.systemAdminLogsPage++; renderLogsPage(); })
    );
  };
  renderLogsPage();
}


/* ===================== ADMIN ANALYTICS CHARTS ===================== */
function gcfindEmptyChartText(chart, message = 'No data available yet') {
  const { ctx, chartArea } = chart;
  if (!chartArea) return;
  ctx.save();
  ctx.font = '700 13px Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
  ctx.restore();
}

const gcfindEmptyChartPlugin = {
  id: 'gcfindEmptyChartPlugin',
  afterDraw(chart) {
    const datasets = chart.data?.datasets || [];
    const hasData = datasets.some(ds => Array.isArray(ds.data) && ds.data.some(v => Number(v) > 0));
    if (!hasData) gcfindEmptyChartText(chart);
  }
};

function destroyGcfindChart(key) {
  if (APP_STATE.charts && APP_STATE.charts[key]) {
    APP_STATE.charts[key].destroy();
    APP_STATE.charts[key] = null;
  }
}

function groupReportsByDate(reports) {
  const grouped = {};
  reports.forEach(r => {
    const key = String(r.date || r.createdAt || r.created_at || '').slice(0, 10) || 'No date';
    grouped[key] = (grouped[key] || 0) + 1;
  });
  const labels = Object.keys(grouped).sort();
  return { labels, values: labels.map(label => grouped[label]) };
}


function getPercentLabel(value, total) {
  const n = Number(value) || 0;
  const t = Number(total) || 0;
  if (!t) return '0%';
  return `${Math.round((n / t) * 100)}%`;
}

function chartTooltipWithPercentage(totalGetter) {
  return {
    callbacks: {
      label(context) {
        const label = context.label || context.dataset?.label || 'Record';
        const value = Number(context.parsed?.y ?? context.parsed ?? 0) || 0;
        const total = typeof totalGetter === 'function' ? totalGetter() : 0;
        return `${label}: ${value} (${getPercentLabel(value, total)})`;
      }
    }
  };
}
async function renderAdminAnalyticsCharts() {
  if (!document.getElementById('reportsTrendChart') && !document.getElementById('statusBarChart') && !document.getElementById('claimsPieChart')) return;
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js is not loaded. Analytics charts skipped.');
    return;
  }

  const reports = await fetchAllReports();
  const claims = await fetchAllClaims();

  const reportSnapshot = buildReportAnalytics(reports);
  const claimSnapshot = buildClaimAnalytics(claims);

  const statusCounts = {
    Pending: reportSnapshot.pending,
    Approved: reportSnapshot.approved,
    Rejected: reportSnapshot.rejected,
    Claimed: reportSnapshot.claimed,
    Returned: reportSnapshot.returned
  };

  const claimCounts = {
    Pending: claimSnapshot.pending,
    Approved: claimSnapshot.approved,
    Rejected: claimSnapshot.rejected
  };
  const totalReportsForPercent = reportSnapshot.total;
  const totalClaimsForPercent = claimSnapshot.total;

  const trend = groupReportsByDate(reports);
  const trendLabels = trend.labels.length ? trend.labels : ['No Data'];
  const trendValues = trend.values.length ? trend.values : [0];

  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#334155', font: { size: 12, weight: '600' } } },
      tooltip: { enabled: true }
    }
  };

  const trendCanvas = document.getElementById('reportsTrendChart');
  if (trendCanvas) {
    destroyGcfindChart('reportsTrendChart');
    APP_STATE.charts.reportsTrendChart = new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [{
          label: 'Reports',
          data: trendValues,
          borderColor: '#047857',
          backgroundColor: 'rgba(16, 185, 129, 0.18)',
          fill: true,
          tension: 0.35,
          pointRadius: 4
        }]
      },
      options: { ...baseOptions, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
      plugins: [gcfindEmptyChartPlugin]
    });
  }

  const statusCanvas = document.getElementById('statusBarChart');
  if (statusCanvas) {
    destroyGcfindChart('statusBarChart');
    APP_STATE.charts.statusBarChart = new Chart(statusCanvas, {
      type: 'bar',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          label: 'Reports',
          data: Object.values(statusCounts),
          backgroundColor: ['#b7791f', '#047857', '#b91c1c', '#059669', '#64748b'],
          borderRadius: 4
        }]
      },
      options: {
        ...baseOptions,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        plugins: { ...baseOptions.plugins, tooltip: chartTooltipWithPercentage(() => totalReportsForPercent) }
      },
      plugins: [gcfindEmptyChartPlugin]
    });
  }

  const claimsCanvas = document.getElementById('claimsPieChart');
  if (claimsCanvas) {
    destroyGcfindChart('claimsPieChart');
    APP_STATE.charts.claimsPieChart = new Chart(claimsCanvas, {
      type: 'doughnut',
      data: {
        labels: Object.keys(claimCounts),
        datasets: [{
          label: 'Claims',
          data: Object.values(claimCounts),
          backgroundColor: ['#b7791f', '#047857', '#b91c1c'],
          borderColor: '#ffffff',
          borderWidth: 3
        }]
      },
      options: { ...baseOptions, cutout: '58%', plugins: { ...baseOptions.plugins, tooltip: chartTooltipWithPercentage(() => totalClaimsForPercent) } },
      plugins: [gcfindEmptyChartPlugin]
    });
  }
}


function initAdminRealtimeAnalytics() {
  if (!requireSupabase() || window.GC_ADMIN_REALTIME_READY) return;
  if (!['admin', 'system-admin'].includes(document.body?.dataset?.page || '')) return;
  window.GC_ADMIN_REALTIME_READY = true;

  const safeRefresh = async () => {
    try {
      await renderAdminReports();
      await renderAdminClaims();
      await refreshAdminAnalyticsViews();
    } catch (err) {
      console.warn('Admin realtime refresh skipped:', err.message);
    }
  };

  try {
    sb.channel('gcfind-admin-live-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_reports' }, safeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claim_requests' }, safeRefresh)
      .subscribe();
  } catch (err) {
    console.warn('Realtime dashboard subscription unavailable:', err.message);
  }
}


async function archiveReportBeforeDelete(id){
  const { data, error: fetchError } = await sb.from('item_reports').select('*').eq('id',id).single();
  if(fetchError) throw fetchError;
  if(!data) throw new Error('Report not found.');

  const archivePayload = {
    source_table: 'item_reports',
    original_record_id: String(id),
    record_data: data
  };

  let { error: archiveError } = await sb.from('deleted_records_archive').insert(archivePayload);

  // Backward-compatible fallback for databases that have an older archive table
  // without the original_record_id column. Run the v2.8.21 SQL fix to fully update the table.
  if (archiveError && /original_record_id/i.test(archiveError.message || '')) {
    const fallbackPayload = {
      source_table: 'item_reports',
      record_data: data
    };
    const fallback = await sb.from('deleted_records_archive').insert(fallbackPayload);
    archiveError = fallback.error;
  }

  if(archiveError) throw archiveError;
  return true;
}

async function restoreArchivedRecord(id){
  const ok = await appConfirm('Restore this archived report?');
  if (!ok) return;
  try {
    showLoading('Restoring report...');
    const { data, error: readError } = await sb.from('deleted_records_archive').select('*').eq('id',id).single();
    if(readError) throw readError;
    if(!data?.record_data) throw new Error('Archived record data is missing.');

    const restoredRecord = { ...data.record_data };

    // Remove archive-only fields and avoid duplicate primary key conflicts.
    delete restoredRecord.deleted_at;
    delete restoredRecord.restored_at;

    let recordToRestore = { ...restoredRecord };
    let { error: insertError } = await sb.from('item_reports').insert(recordToRestore);

    // Retry 1: if the old ID still exists or conflicts, restore with a fresh ID.
    if (insertError && /duplicate key|already exists|violates unique constraint/i.test(String(insertError.message || ''))) {
      recordToRestore = { ...restoredRecord };
      delete recordToRestore.id;
      const retry = await sb.from('item_reports').insert(recordToRestore);
      insertError = retry.error;
    }

    // Retry 2: if user_id no longer exists, keep reporter info but remove invalid user_id.
    if (insertError && /foreign key constraint|item_reports_user_id_fkey|violates foreign key/i.test(String(insertError.message || ''))) {
      recordToRestore = { ...recordToRestore };
      delete recordToRestore.user_id;
      delete recordToRestore.reporter_id;
      if (!recordToRestore.status) recordToRestore.status = 'Pending';
      const retry = await sb.from('item_reports').insert(recordToRestore);
      insertError = retry.error;
    }

    // Retry 3: remove common generated/system fields that may conflict with schema.
    if (insertError) {
      recordToRestore = { ...recordToRestore };
      ['id','created_at','updated_at','deleted_at','restored_at'].forEach(k => delete recordToRestore[k]);
      if (!recordToRestore.status) recordToRestore.status = 'Pending';
      const retry = await sb.from('item_reports').insert(recordToRestore);
      insertError = retry.error;
    }

    if(insertError) throw insertError;
    let { error: updateError } = await sb.from('deleted_records_archive').update({restored_at:new Date().toISOString()}).eq('id',id);
    if(updateError) {
      // If archive update is blocked, keep UI usable but tell user through console.
      console.warn('Archive restored_at update blocked:', updateError.message);
    }
    hideArchiveLocally(id);
    hideLoading();
    showSuccess('Deleted report restored successfully.', { position: 'top-right' });
    await openRecoverDataModal();
    await renderSystemAdmin();
  } catch (err) {
    hideLoading();
    showError(err.message || 'Unable to restore deleted report.', { position: 'top-right', duration: 5200 });
  }
}

async function permanentlyDeleteArchivedRecord(id){
  const ok = await appConfirm('Permanently delete this archived report? This action cannot be undone.');
  if (!ok) return;
  try {
    showLoading('Permanently deleting report...');
    hideArchiveLocally(id);

    try {
      const { error } = await sb.from('deleted_records_archive').delete().eq('id', id);
      if (error) {
        console.warn('Archive DB delete blocked, trying restored_at fallback:', error.message);
        const fallback = await sb.from('deleted_records_archive').update({ restored_at: new Date().toISOString() }).eq('id', id);
        if (fallback.error) console.warn('Archive fallback update also blocked, local hide applied:', fallback.error.message);
      }
    } catch (dbErr) {
      console.warn('Archive permanent delete fallback applied:', dbErr.message);
    }

    hideLoading();
    showSuccess('Archived report removed from recovery list.', { position: 'top-right' });
    await openRecoverDataModal();
    await renderSystemAdmin();
  } catch (err) {
    hideLoading();
    showError(err.message || 'Unable to permanently delete archived report.', { position: 'top-right', duration: 5200 });
  }
}


















// Expose these because Restore Deleted Data modal buttons may be rendered dynamically.
try {
  window.openRecoverDataModal = openRecoverDataModal;
  window.restoreArchivedRecord = restoreArchivedRecord;
  window.permanentlyDeleteArchivedRecord = permanentlyDeleteArchivedRecord;
} catch (_) {}


/* =========================================================
   GCFind v2.42 FINAL Modal Centering Controller
   Overlay covers viewport. Card is fixed at viewport center.
   ========================================================= */
function gcfindLockPageScroll(lock) {
  document.documentElement.classList.toggle('modal-open', !!lock);
  document.body.classList.toggle('modal-open', !!lock);
  document.documentElement.style.overflow = lock ? 'hidden' : '';
  document.body.style.overflow = lock ? 'hidden' : '';
}

function gcfindGetModalCard(modal) {
  const backdrop = modal.querySelector('.gc-admin-modal-backdrop, .confirm-backdrop');
  return modal.querySelector('.gc-admin-modal-card, .admin-photo-preview-card, .auth-modal-card, .confirm-card') ||
    Array.from(modal.children).find(child => child !== backdrop) ||
    modal.firstElementChild;
}

function gcfindForceFixedModal(modal) {
  if (!modal) return;
  if (modal.parentElement !== document.body) document.body.appendChild(modal);

  const open = modal.classList.contains('is-open') || (!modal.classList.contains('hidden') && modal.style.display !== 'none');
  const isPhoto = modal.id === 'adminPhotoPreviewModal';

  Object.assign(modal.style, {
    position: 'fixed',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    inset: '0',
    width: '100vw',
    height: '100vh',
    minWidth: '100vw',
    minHeight: '100vh',
    zIndex: '100000',
    display: open ? 'block' : 'none',
    padding: '0',
    margin: '0',
    overflow: 'hidden',
    background: 'rgba(15, 23, 42, 0.32)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    boxSizing: 'border-box'
  });

  const backdrop = modal.querySelector('.gc-admin-modal-backdrop, .confirm-backdrop');
  if (backdrop) {
    Object.assign(backdrop.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      bottom: '0',
      left: '0',
      inset: '0',
      width: '100vw',
      height: '100vh',
      background: 'transparent',
      pointerEvents: 'auto'
    });
  }

  const card = gcfindGetModalCard(modal);
  if (card && card !== backdrop) {
    Object.assign(card.style, {
      position: 'fixed',
      top: '50vh',
      left: '50vw',
      right: 'auto',
      bottom: 'auto',
      transform: 'translate(-50%, -50%)',
      margin: '0',
      width: isPhoto ? 'min(92vw, 820px)' : (modal.id === 'confirmOverlay' ? 'min(92vw, 420px)' : 'min(92vw, 600px)'),
      maxWidth: isPhoto ? 'min(92vw, 820px)' : (modal.id === 'confirmOverlay' ? 'min(92vw, 420px)' : 'min(92vw, 600px)'),
      maxHeight: 'calc(100vh - 48px)',
      overflow: isPhoto ? 'hidden' : 'auto',
      zIndex: '100001',
      boxSizing: 'border-box'
    });
  }

  if (isPhoto) {
    const body = modal.querySelector('.admin-photo-preview-body');
    const img = modal.querySelector('.admin-photo-preview-img');
    if (body) Object.assign(body.style, { maxHeight: 'calc(100vh - 160px)', overflow: 'hidden' });
    if (img) Object.assign(img.style, {
      display: 'block',
      maxWidth: '100%',
      maxHeight: 'calc(100vh - 205px)',
      width: 'auto',
      height: 'auto',
      objectFit: 'contain'
    });
  }
}

function gcfindOpenModalFixed(modal) {
  if (!modal) return;
  if (modal.parentElement !== document.body) document.body.appendChild(modal);
  modal.classList.remove('hidden', 'flex');
  modal.classList.add('is-open');
  modal.style.display = 'block';
  gcfindForceFixedModal(modal);
  gcfindLockPageScroll(true);
}

function gcfindCloseModalFixed(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('is-open', 'flex');
  modal.style.display = 'none';

  const ids = ['requestTicketModal','staffReviewModal','systemAdminModal','adminPhotoPreviewModal','confirmOverlay','forgotPasswordModal'];
  const stillOpen = ids.some(id => {
    const el = document.getElementById(id);
    return el && el.classList.contains('is-open') && !el.classList.contains('hidden');
  });
  if (!stillOpen) gcfindLockPageScroll(false);
}

function initGcfindTrueFixedModals() {
  const ids = ['requestTicketModal','staffReviewModal','systemAdminModal','adminPhotoPreviewModal','confirmOverlay','forgotPasswordModal'];
  ids.forEach(id => {
    const modal = document.getElementById(id);
    if (!modal) return;
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    if (!modal.dataset.v242FinalModalReady) {
      modal.dataset.v242FinalModalReady = 'true';
      modal.addEventListener('click', (event) => {
        if (event.target === modal && id !== 'confirmOverlay') gcfindCloseModalFixed(modal);
      });
      const observer = new MutationObserver(() => {
        const open = modal.classList.contains('is-open') || (!modal.classList.contains('hidden') && modal.style.display !== 'none');
        if (open) gcfindForceFixedModal(modal);
      });
      observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  });

  window.addEventListener('resize', () => {
    ids.forEach(id => {
      const modal = document.getElementById(id);
      if (modal && modal.classList.contains('is-open')) gcfindForceFixedModal(modal);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    ids.forEach(id => {
      if (id === 'confirmOverlay') return;
      const modal = document.getElementById(id);
      if (modal && modal.classList.contains('is-open')) gcfindCloseModalFixed(modal);
    });
  });
}

setTimeout(initGcfindTrueFixedModals, 50);
setTimeout(initGcfindTrueFixedModals, 500);


/* v2.47 Request Ticket realtime fallback */
(function initRequestTicketRealtimeFallback() {
  document.addEventListener('DOMContentLoaded', () => {
    try {
      if (!window.sb || !window.sb.channel) return;
      const isAdminPage = !!document.getElementById('adminTicketNotifications');
      const isSystemAdminPage = !!document.getElementById('systemAdminMount');
      if (!isAdminPage && !isSystemAdminPage) return;
      window.sb.channel('gcfind-ticket-live-refresh-v247')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'request_tickets' }, async () => {
          try { if (typeof renderAdminTicketNotifications === 'function') await renderAdminTicketNotifications(); } catch (_) {}
          try { if (typeof renderSystemAdmin === 'function' && document.getElementById('systemAdminMount')) await renderSystemAdmin(); } catch (_) {}
          try { if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications(); } catch (_) {}
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, async () => {
          try { if (typeof renderAdminTicketNotifications === 'function') await renderAdminTicketNotifications(); } catch (_) {}
          try { if (typeof renderSystemAdmin === 'function' && document.getElementById('systemAdminMount')) await renderSystemAdmin(); } catch (_) {}
          try { if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications(); } catch (_) {}
        })
        .subscribe();
    } catch (err) {
      console.warn('Ticket realtime fallback skipped:', err);
    }
  });
})();



/* =========================================================
   GCFind v2.54 FINAL ACTION STABILIZER
   Fixes dynamic button clicks for Staff, CSSU/Admin notifications, Request Tickets,
   and Recover Deleted Data without touching unrelated features.
   ========================================================= */
(function gcfindFinalActionStabilizer(){
  if (window.__gcfindFinalActionStabilizer) return;
  window.__gcfindFinalActionStabilizer = true;

  function getBtn(target, selector) {
    return target && target.closest ? target.closest(selector) : null;
  }

  async function safeConfirm(message) {
    try {
      if (typeof appConfirm === 'function') return await appConfirm(message);
    } catch (_) {}
    return window.confirm(message);
  }

  async function safeRefresh() {
    try { if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications(); } catch (_) {}
    try { if (typeof renderStaffPanel === 'function' && document.getElementById('staffPanelMount')) await renderStaffPanel(); } catch (_) {}
    try { if (typeof renderSystemAdmin === 'function' && document.getElementById('systemAdminMount')) await renderSystemAdmin(); } catch (_) {}
    try { if (typeof renderAdminTicketNotifications === 'function') await renderAdminTicketNotifications(); } catch (_) {}
    try { if (typeof renderAdminDashboard === 'function' && document.getElementById('adminDashboardMount')) await renderAdminDashboard(); } catch (_) {}
  }

  async function markNotificationReadHard(id, btn) {
    if (!id) return;
    try { if (typeof markNotificationRead === 'function') await markNotificationRead(id); } catch (_) {}
    try { if (window.sb) await sb.from('notifications').update({ is_read: true }).eq('id', id); } catch (err) { console.warn('Read DB blocked:', err.message); }
    const card = btn?.closest('article, .notification-item, .gc-notification-card, div');
    card?.classList.remove('bg-emerald-50/60');
    card?.classList.add('bg-white');
    btn?.remove();
  }

  async function deleteNotificationHard(id, btn) {
    if (!id) return;
    try { if (typeof hidePanelNotificationLocally === 'function') hidePanelNotificationLocally(id); } catch (_) {}
    try { if (typeof hideNotificationLocally === 'function') hideNotificationLocally(id); } catch (_) {}
    try { if (typeof deleteNotificationRow === 'function') await deleteNotificationRow(id); } catch (_) {}
    try { if (window.sb) await sb.from('notifications').delete().eq('id', id); } catch (err) { console.warn('Notification DB delete blocked:', err.message); }
    btn?.closest('article, .notification-item, .gc-notification-card')?.remove();
  }

  async function updateClaimHard(id, status, btn) {
    if (!id) return;
    const ok = await safeConfirm(`${status === 'Approved' ? 'Approve' : 'Reject'} this claim request?`);
    if (!ok) return;
    try { if (typeof showLoading === 'function') showLoading(`${status === 'Approved' ? 'Approving' : 'Rejecting'} claim...`); } catch (_) {}

    let error = null;
    try {
      const result = await sb.from('claim_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      error = result.error;
    } catch (err) {
      error = err;
    }

    try { if (typeof hideLoading === 'function') hideLoading(); } catch (_) {}
    if (error) {
      console.warn('Claim update failed:', error.message || error);
      try { showError((error.message || 'Unable to update claim. Run the latest SQL file, then refresh.'), { position: 'top-right', duration: 7000 }); } catch (_) { alert(error.message || error); }
      return;
    }

    btn?.closest('article, tr, .claim-card')?.remove();
    try { showSuccess(`Claim marked as ${status}.`, { position: 'top-right' }); } catch (_) {}
    await safeRefresh();
  }

  async function deleteRequestTicketHard(id, btn) {
    if (!id) return;
    const ok = await safeConfirm('Delete this request ticket?');
    if (!ok) return;
    try { if (typeof saveDeletedRequestTicketId === 'function') saveDeletedRequestTicketId(id); } catch (_) {}
    try { if (typeof hideTicketUpdateLocally === 'function') hideTicketUpdateLocally(id); } catch (_) {}
    try { if (typeof hideSystemAdminTicketLocally === 'function') hideSystemAdminTicketLocally(id); } catch (_) {}
    try { if (typeof hideSystemAdminTicketNotificationLocally === 'function') hideSystemAdminTicketNotificationLocally(id); } catch (_) {}
    try { if (window.sb) await sb.from('request_tickets').delete().eq('id', id); } catch (err) { console.warn('Ticket DB delete blocked:', err.message); }
    btn?.closest('article, .ticket-card, .request-ticket-card, div.border-t')?.remove();
    try { showSuccess('Request ticket deleted.', { position: 'top-right' }); } catch (_) {}
    await safeRefresh();
  }

  async function restoreArchiveHard(id, btn) {
    if (!id) return;
    if (typeof restoreArchivedRecord === 'function') {
      await restoreArchivedRecord(id);
      return;
    }
  }

  async function deleteArchiveHard(id, btn) {
    if (!id) return;
    if (typeof permanentlyDeleteArchivedRecord === 'function') {
      await permanentlyDeleteArchivedRecord(id);
      return;
    }
  }

  document.addEventListener('click', async (event) => {
    const target = event.target;
    // Notifications and Staff claim buttons are handled by gcfind-actions-fix.js v3.70 only.

    const adminClaimBtn = getBtn(target, '[data-claim-action]');
    if (adminClaimBtn && ['approve','reject'].includes(adminClaimBtn.dataset.claimAction)) {
      event.preventDefault();
      event.stopPropagation();
      await updateClaimHard(adminClaimBtn.dataset.claimId, adminClaimBtn.dataset.claimAction === 'approve' ? 'Approved' : 'Rejected', adminClaimBtn);
      return;
    }

    const ticketDeleteBtn = getBtn(target,
      '[data-ticket-delete], [data-admin-ticket-delete], [data-request-ticket-delete], [data-admin-ticket-update-delete]'
    );
    if (ticketDeleteBtn) {
      event.preventDefault();
      event.stopPropagation();
      const id = ticketDeleteBtn.dataset.ticketDelete || ticketDeleteBtn.dataset.adminTicketDelete || ticketDeleteBtn.dataset.requestTicketDelete || ticketDeleteBtn.dataset.adminTicketUpdateDelete;
      await deleteRequestTicketHard(id, ticketDeleteBtn);
      return;
    }

    const archiveRestoreBtn = getBtn(target, '[data-archive-restore]');
    if (archiveRestoreBtn) {
      event.preventDefault();
      event.stopPropagation();
      await restoreArchiveHard(archiveRestoreBtn.dataset.archiveRestore, archiveRestoreBtn);
      return;
    }

    const archiveDeleteBtn = getBtn(target, '[data-archive-delete]');
    if (archiveDeleteBtn) {
      event.preventDefault();
      event.stopPropagation();
      await deleteArchiveHard(archiveDeleteBtn.dataset.archiveDelete, archiveDeleteBtn);
      return;
    }
  }, true);
})();





// GCFind FINAL System Admin Create Account Role Dropdown UI
// Converts #sysCreateRole native select into the same custom dropdown style used by dashboard filters.
(function () {
  function closeGcRoleDropdown(wrapper) {
    wrapper.classList.remove("open");
    wrapper.querySelector(".gc-custom-select-list")?.classList.add("hidden");
    wrapper.querySelector(".gc-custom-select-button")?.setAttribute("aria-expanded", "false");
  }

  function enhanceSysCreateRoleSelectFinal() {
    const select = document.getElementById("sysCreateRole");
    if (!select || select.dataset.gcFinalRoleDropdown === "true") return;

    select.dataset.gcFinalRoleDropdown = "true";
    select.classList.add("gc-select-enhanced-source");
    select.style.display = "none";

    const wrapper = document.createElement("div");
    wrapper.className = "gc-custom-select gc-system-admin-role-select";
    wrapper.dataset.forSelect = "sysCreateRole";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gc-custom-select-button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");

    const label = document.createElement("span");
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-chevron-down";
    button.append(label, icon);

    const list = document.createElement("div");
    list.className = "gc-custom-select-list hidden";
    list.setAttribute("role", "listbox");

    wrapper.append(button, list);
    select.insertAdjacentElement("afterend", wrapper);

    function rebuild() {
      label.textContent = select.options[select.selectedIndex]?.textContent || "Select role";
      list.innerHTML = "";

      Array.from(select.options).forEach((option) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "gc-custom-select-option";
        item.textContent = option.textContent || "";
        item.dataset.value = option.value || "";
        item.setAttribute("role", "option");
        item.setAttribute("aria-selected", option.value === select.value ? "true" : "false");

        item.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          rebuild();
          closeGcRoleDropdown(wrapper);
        });

        list.appendChild(item);
      });
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      document.querySelectorAll(".gc-custom-select.open").forEach((other) => {
        if (other !== wrapper) closeGcRoleDropdown(other);
      });

      const isOpen = wrapper.classList.toggle("open");
      list.classList.toggle("hidden", !isOpen);
      button.setAttribute("aria-expanded", String(isOpen));
    });

    select.addEventListener("change", rebuild);
    rebuild();
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".gc-system-admin-role-select")) {
      document.querySelectorAll(".gc-system-admin-role-select.open").forEach(closeGcRoleDropdown);
    }
  });

  document.addEventListener("DOMContentLoaded", enhanceSysCreateRoleSelectFinal);

  const observer = new MutationObserver(() => enhanceSysCreateRoleSelectFinal());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.GCFindEnhanceSysCreateRoleSelect = enhanceSysCreateRoleSelectFinal;
})();
