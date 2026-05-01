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
  const counts = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'Pending').length,
    approved: reports.filter(r => r.status === 'Approved').length,
    rejected: reports.filter(r => r.status === 'Rejected').length,
    claimed: reports.filter(r => r.status === 'Claimed').length,
    returned: reports.filter(r => r.status === 'Returned').length,
  };

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
    renderPagination('adminReportsPagination', pageData, () => { APP_STATE.adminReportsPage--; renderAdminReports(); }, () => { APP_STATE.adminReportsPage++; renderAdminReports(); });
    return;
  }

  tbody.innerHTML = pageData.items.map(r => `
    <tr class="border-t border-slate-200">
      <td class="px-4 py-3"><div class="h-12 w-12 overflow-hidden rounded-xl ring-1 ring-slate-200 bg-slate-50"><img src="${escapeHtml(r.imageDataUrl || 'assets/img/fallback.jpg')}" class="h-full w-full object-cover" onerror="this.onerror=null;this.src='assets/img/fallback.jpg';"></div></td>
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
  renderPagination('adminReportsPagination', pageData, () => { APP_STATE.adminReportsPage--; renderAdminReports(); }, () => { APP_STATE.adminReportsPage++; renderAdminReports(); });
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
    renderPagination('adminClaimsPagination', pageData, () => { APP_STATE.adminClaimsPage--; renderAdminClaims(); }, () => { APP_STATE.adminClaimsPage++; renderAdminClaims(); });
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
  renderPagination('adminClaimsPagination', pageData, () => { APP_STATE.adminClaimsPage--; renderAdminClaims(); }, () => { APP_STATE.adminClaimsPage++; renderAdminClaims(); });
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

  const actorMap = await fetchProfileMapByIds(data.map(l => l.actor_id).filter(Boolean));
  const pageData = paginate(data, APP_STATE.adminLogsPage, APP_STATE.adminPerPage);
  APP_STATE.adminLogsPage = pageData.page;

  tbody.innerHTML = pageData.items.length ? pageData.items.map(log => `
    <tr class="border-t border-slate-200">
      <td class="px-4 py-3 text-sm text-slate-900 font-medium">${escapeHtml(log.action)}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(log.details || '—')}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(actorMap[log.actor_id]?.full_name || actorMap[log.actor_id]?.email || log.actor_id || 'system')}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${formatDateTime(log.created_at)}</td>
    </tr>`).join('') : `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="4">No audit logs yet.</td></tr>`;
  renderPagination('adminLogsPagination', pageData, () => { APP_STATE.adminLogsPage--; renderAdminLogs(); }, () => { APP_STATE.adminLogsPage++; renderAdminLogs(); });
}


async function renderAdminTicketNotifications() {
  const panel = document.getElementById('adminTicketNotifications');
  const list = document.getElementById('adminTicketNotificationsList');
  if (!panel || !list || !requireSupabase()) return;
  const user = getUser();
  let tickets = [];
  try {
    const all = await fetchRequestTickets();
    tickets = all.filter(t => (t.requester_email || '').toLowerCase() === (user?.email || '').toLowerCase()).slice(0, 5);
  } catch (err) {
    tickets = [];
  }
  if (!tickets.length) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  list.innerHTML = tickets.map(t => `
    <article class="p-4 ${String(t.status || '').toLowerCase() === 'resolved' ? 'bg-emerald-50/60' : 'bg-white'}">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-extrabold text-slate-900">${escapeHtml(t.message || 'Request ticket')}</div>
          <div class="mt-2 rounded-2xl ${t.admin_response ? 'bg-white ring-emerald-100 text-emerald-900' : 'bg-amber-50 ring-amber-100 text-amber-800'} p-3 text-sm ring-1">
            <b>${t.admin_response ? 'System Administrator Response:' : 'Status:'}</b> ${escapeHtml(t.admin_response || 'Waiting for System Administrator response.')}
          </div>
          <div class="mt-2 text-xs text-slate-500">Updated: ${formatDateTime(t.updated_at || t.created_at)}</div>
        </div>
        ${statusPill(t.status || 'Pending')}
      </div>
    </article>`).join('');
}

async function createNotification({ recipientUserId = null, recipientRole = null, title = 'Notification', message = '', type = 'info', relatedId = null } = {}) {
  if (!requireSupabase()) return null;
  try {
    const { data, error } = await sb.from('notifications').insert({ recipient_user_id: recipientUserId, recipient_role: recipientRole, title, message, type, related_id: relatedId, is_read: false }).select().single();
    if (error) throw error;
    return data;
  } catch (err) { console.warn('notifications table not available yet:', err.message); return null; }
}
async function fetchNotificationsForCurrentUser(limit = 8) {
  if (!requireSupabase()) return [];
  const user = getUser(); const authUser = await getAuthUser(); const role = user?.role || ''; const uid = authUser?.id || user?.id || null;
  try {
    let q = sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit);
    if (uid && role) q = q.or(`recipient_user_id.eq.${uid},recipient_role.eq.${role}`); else if (uid) q = q.eq('recipient_user_id', uid); else if (role) q = q.eq('recipient_role', role);
    const { data, error } = await q; if (error) throw error; return data || [];
  } catch (err) { console.warn('Unable to fetch notifications:', err.message); return []; }
}
async function markNotificationRead(notificationId) { if (!requireSupabase() || !notificationId) return; try { await sb.from('notifications').update({ is_read: true }).eq('id', notificationId); } catch (err) { console.warn('Unable to mark notification read:', err.message); } }
function notificationCard(n) { return `<article class="p-4 ${n.is_read ? 'bg-white' : 'bg-emerald-50/60'}"><div class="flex items-start justify-between gap-3"><div><div class="font-extrabold text-slate-900">${escapeHtml(n.title || 'Notification')}</div><div class="mt-1 text-sm text-slate-600">${escapeHtml(n.message || '')}</div><div class="mt-2 text-xs text-slate-500">${formatDateTime(n.created_at)}</div></div>${!n.is_read ? `<button class="rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200" data-notification-read="${escapeHtml(n.id)}">Mark read</button>` : ''}</div></article>`; }
async function bindNotificationReadButtons(scope, rerender) { scope.querySelectorAll('[data-notification-read]').forEach(btn => btn.addEventListener('click', async () => { await markNotificationRead(btn.dataset.notificationRead); if (typeof rerender === 'function') await rerender(); })); }

async function renderStaffPanel() {
  const mount = $('#staffPanelMount');
  if (!mount) return;
  const user = getUser();
  if (user?.role !== 'faculty_staff') {
    mount.innerHTML = `<div class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 text-sm text-slate-600">This page is available for faculty and staff only.</div>`;
    return;
  }
  mount.innerHTML = `<div class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 text-sm text-slate-600">Loading staff dashboard...</div>`;
  const [reports, claims, notifications] = await Promise.all([fetchAllReports(), fetchAllClaims(), fetchNotificationsForCurrentUser(8)]);
  const pendingReports = reports.filter(r => String(r.status || '').toLowerCase() === 'pending');
  const pendingClaims = claims.filter(c => String(c.status || '').toLowerCase() === 'pending');
  mount.innerHTML = `
    <section class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="analytics-card staff-stat-card"><span class="staff-stat-label">Pending Reports</span><span class="staff-stat-value">${pendingReports.length}</span></div>
      <div class="analytics-card staff-stat-card"><span class="staff-stat-label">Pending Claims</span><span class="staff-stat-value">${pendingClaims.length}</span></div>
      <div class="analytics-card staff-stat-card"><span class="staff-stat-label">Unread Notifications</span><span class="staff-stat-value">${notifications.filter(n => !n.is_read).length}</span></div>
    </section>
    <section class="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-start system-admin-grid">
      <section class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden"><div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-list-check mr-2 text-emerald-600"></i>Pending Report Items</h2><p class="mt-1 text-sm text-slate-600">Reports needing staff verification or assistance.</p></div><div id="staffPendingReports" class="divide-y divide-slate-200"></div></section>
      <div class="space-y-6"><section class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden"><div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-handshake-angle mr-2 text-emerald-600"></i>Claim Verification Support</h2><p class="mt-1 text-sm text-slate-600">Assist CSSU by reviewing active claim requests.</p></div><div id="staffPendingClaims" class="divide-y divide-slate-200"></div></section><section class="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden"><div class="p-5 border-b border-slate-200"><h2 class="text-lg font-extrabold text-slate-900"><i class="fa-solid fa-bell mr-2 text-emerald-600"></i>Notifications</h2><p class="mt-1 text-sm text-slate-600">Updates for reports, claims, and admin responses.</p></div><div id="staffNotifications" class="divide-y divide-slate-200"></div></section></div>
    </section>`;
  const reportsBox = document.getElementById('staffPendingReports');
  reportsBox.innerHTML = pendingReports.length ? pendingReports.map(r => `<article class="p-4"><div class="flex gap-4"><div class="h-20 w-20 shrink-0 rounded-xl bg-slate-50 ring-1 ring-slate-200 p-1 flex items-center justify-center overflow-hidden"><img src="${escapeHtml(r.imageDataUrl || 'assets/img/fallback.jpg')}" alt="${escapeHtml(r.itemName || 'Report image')}" class="max-h-full max-w-full object-contain" onerror="this.onerror=null;this.src='assets/img/fallback.jpg';"></div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h3 class="font-extrabold text-slate-900">${escapeHtml(r.itemName)}</h3>${statusPill(r.status)}</div><p class="mt-1 text-sm text-slate-600">${escapeHtml(r.type)} • ${escapeHtml(r.location || 'No location')} • Posted by ${escapeHtml(r.submittedByName || r.submittedBy || 'Unknown')}</p><p class="mt-1 text-xs text-slate-500">${formatDateTime(r.createdAt)}</p><div class="mt-3 flex flex-wrap gap-2"><button class="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700" data-staff-report="approve" data-report-id="${escapeHtml(r.id)}">Verify / Approve</button><button class="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700" data-staff-report="reject" data-report-id="${escapeHtml(r.id)}">Reject</button></div></div></div></article>`).join('') : `<div class="p-5 text-sm text-slate-600">No pending reports found.</div>`;
  const claimsBox = document.getElementById('staffPendingClaims');
  claimsBox.innerHTML = pendingClaims.length ? pendingClaims.map(c => `<article class="p-4"><div class="font-extrabold text-slate-900">${escapeHtml(c.claimantName || c.claimantEmail || 'Claimant')}</div><div class="mt-1 text-sm text-slate-600">${escapeHtml(c.message || 'No message provided.')}</div><div class="mt-2 text-xs text-slate-500">${formatDateTime(c.createdAt)}</div><div class="mt-2">${statusPill(c.status)}</div></article>`).join('') : `<div class="p-5 text-sm text-slate-600">No pending claim verification tasks.</div>`;
  const notificationBox = document.getElementById('staffNotifications'); notificationBox.innerHTML = notifications.length ? notifications.map(notificationCard).join('') : `<div class="p-5 text-sm text-slate-600">No notifications yet.</div>`;
  await bindNotificationReadButtons(mount, renderStaffPanel);
  mount.insertAdjacentHTML('beforeend', `
    <div id="staffReviewModal" class="fixed inset-0 z-[9999] hidden items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
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
      const { error } = await sb.from('item_reports').update({ status: nextStatus }).eq('id', reportId);
      if (error) throw error;
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


function initAdminActions() {
  const reportsTable = $('#adminReportsTable');
  reportsTable?.addEventListener('click', async (e) => {
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
      } catch (err) {
        showError(err.message || 'Unable to delete/archive report.', { position: 'top-right', duration: 5200 });
      }
      return;
    }

    const nextStatus = action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : action === 'claimed' ? 'Claimed' : 'Returned';
    const { error } = await sb.from('item_reports').update({ status: nextStatus }).eq('id', id);
    if (error) { showError(error.message, { position: 'top-right' }); return; }
    await createAuditLog(`Report ${nextStatus}`, 'item_report', id, nextStatus);
    await renderAdminReports();
  });

  document.getElementById('requestTicketBtn')?.addEventListener('click', () => document.getElementById('requestTicketModal')?.classList.remove('hidden'));
  document.getElementById('requestTicketCancel')?.addEventListener('click', () => document.getElementById('requestTicketModal')?.classList.add('hidden'));
  document.getElementById('requestTicketSubmit')?.addEventListener('click', async () => {
    const txt = document.getElementById('requestTicketText')?.value?.trim();
    if (!txt) return showError('Please describe the issue.', { position:'top-right' });
    try {
      await createRequestTicket(txt);
      showSuccess('Request ticket submitted to System Administrator.', { position:'top-right' });
      document.getElementById('requestTicketModal')?.classList.add('hidden');
      document.getElementById('requestTicketText').value = '';
    } catch (err) {
      showInfo('Ticket was saved to audit logs. Run request_tickets SQL for full ticket inbox.', { position:'top-right', duration: 3500 });
      document.getElementById('requestTicketModal')?.classList.add('hidden');
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
    const { error } = await sb.from('claim_requests').update({ status: nextStatus }).eq('id', claimId);
    if (error) { showError(error.message, { position: 'top-right' }); return; }

    await createAuditLog(`Claim ${nextStatus}`, 'claim_request', claimId, reportId || '');

    if (nextStatus === 'Approved' && reportId) {
      await sb.from('item_reports').update({ status: 'Claimed' }).eq('id', reportId);
      await createAuditLog('Report Claimed', 'item_report', reportId, reportId);
      await renderAdminReports();
    }

    await renderAdminClaims();
    if (typeof renderAdminAnalyticsCharts === 'function') await renderAdminAnalyticsCharts();
  });
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
  return data || [];
}

async function createRequestTicket(message) {
  const authUser = await getAuthUser(); const sessionUser = getUser();
  const payload = { requested_by: authUser?.id || null, requester_email: sessionUser?.email || authUser?.email || '', requester_name: sessionUser?.name || '', requester_role: sessionUser?.role || '', message, status: 'Pending' };
  const { data, error } = await sb.from('request_tickets').insert(payload).select().single();
  if (error) { await createAuditLog('Request Ticket Submitted','ticket','',message); throw error; }
  await createAuditLog('Request Ticket Submitted','ticket', data?.id || '', message);
  await createNotification({ recipientRole: 'system_admin', title: 'New CSSU Request Ticket', message, type: 'ticket', relatedId: data?.id || null });
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
}
async function deleteRequestTicket(ticketId) {
  let ticket = null; try { const { data } = await sb.from('request_tickets').select('*').eq('id', ticketId).single(); ticket = data || null; } catch (_) {}
  const { error } = await sb.from('request_tickets').delete().eq('id', ticketId); if (error) throw error;
  await createAuditLog('Request Ticket Deleted', 'ticket', ticketId, ticket?.message || 'Deleted ticket');
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
  modal.classList.add('is-open');
}

function closeSystemAdminModal() {
  document.getElementById('systemAdminModal')?.classList.remove('is-open');
}

function openCreateAccountModal() {
  openSystemAdminModal(`
    <h3>Create Account</h3>
    <p class="mt-1 text-sm text-slate-600">Create a new GCFind user account through the secure System Administrator API.</p>
    <form id="sysCreateAccountForm">
      <label>Full Name</label>
      <input id="sysCreateName" required placeholder="e.g., Juan Dela Cruz" />
      <label>Email</label>
      <input id="sysCreateEmail" type="email" required placeholder="user@gordoncollege.edu.ph" />
      <label>Temporary Password</label>
      <input id="sysCreatePassword" type="password" required placeholder="Temporary password" />
      <label>Role</label>
      <select id="sysCreateRole" required>
        <option value="student">Student</option>
        <option value="faculty_staff">Faculty / Staff</option>
        <option value="admin">Security / Lost & Found Office</option>
        <option value="system_admin">System Administrator</option>
      </select>
      <label>Department / Program</label>
      <input id="sysCreateDepartment" placeholder="e.g., CCSE / CCS" />
      <div class="gc-muted-note">This works after deployment when Vercel environment variables are configured: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SITE_URL.</div>
      <div class="gc-admin-modal-actions">
        <button type="button" class="rounded-xl px-4 py-2 text-sm font-semibold gc-secondary-btn" onclick="closeSystemAdminModal()">Cancel</button>
        <button type="submit" class="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Create Account</button>
      </div>
    </form>`);
  document.getElementById('sysCreateAccountForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      full_name: document.getElementById('sysCreateName').value.trim(),
      email: document.getElementById('sysCreateEmail').value.trim().toLowerCase(),
      password: document.getElementById('sysCreatePassword').value,
      role: document.getElementById('sysCreateRole').value,
      department: document.getElementById('sysCreateDepartment').value.trim() || 'General'
    };
    try {
      showLoading('Creating account...');
      await callAdminApi('/api/admin-create-account', payload);
      hideLoading();
      showSuccess('Account created successfully.', { position: 'top-right' });
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
        const { error } = await sb.auth.resetPasswordForEmail(email);
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
    <p class="mt-1 text-sm text-slate-600">Search an account record and send password recovery support when a user cannot access their GCFind account.</p>
    <div class="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      Use <strong>Send Password Reset</strong> if the user cannot access their account. Use <strong>Copy Email</strong> for manual follow-up.
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
          <button type="button" class="whitespace-nowrap rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800" title="Send a password reset email to this user" onclick="sendRecoveryReset('${safeEmail}')">Send Password Reset</button>
          <button type="button" class="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold gc-secondary-btn" title="Copy this user email address" onclick="navigator.clipboard?.writeText('${safeEmail}'); showSuccess('Email copied.', { position: 'top-right' });">Copy Email</button>
        </div>
      </div>`;
    }).join('') : '<div class="p-4 text-sm text-slate-600">No matching account found.</div>';
  };
  document.getElementById('sysRecoverSearch')?.addEventListener('input', render);
  render();
}

async function sendRecoveryReset(email) {
  if (!email) return showError('No email found for this account.', { position: 'top-right' });
  try {
    showLoading('Sending password reset email...');
    await callAdminApi('/api/admin-reset-password', { email });
    hideLoading();
    showSuccess(`Password reset email sent to ${email}.`, { position: 'top-right' });
  } catch (err) {
    hideLoading();
    showError(err.message || 'Unable to send recovery email.', { position: 'top-right', duration: 5200 });
  }
}

async function openRecoverDataModal() {
  let archives = [];
  try {
    const { data } = await sb.from('deleted_records_archive').select('*').is('restored_at', null).order('deleted_at', { ascending: false });
    archives = data || [];
  } catch (err) {
    archives = [];
  }

  const rows = archives.length ? archives.map(a => {
    const rec = a.record_data || {};
    return `<div class="border-b border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <div class="font-extrabold text-slate-900">${escapeHtml(rec.item_name || rec.itemName || a.original_record_id || 'Deleted record')}</div>
        <div class="text-sm text-slate-600">${escapeHtml(a.source_table || 'table')} • ${escapeHtml(formatDateTime(a.deleted_at))}</div>
      </div>
      <button class="rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white" onclick="restoreArchivedRecord('${escapeHtml(a.id)}')">Restore</button>
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
    const tickets = await fetchRequestTickets();
    ticketBody.innerHTML = tickets.length ? tickets.slice(0, 8).map(t => `
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
      try { await deleteRequestTicket(btn.dataset.ticketDelete); showSuccess('Ticket deleted.', { position: 'top-right' }); await renderSystemAdmin(); }
      catch (err) { showError(err.message, { position: 'top-right' }); }
    }));
  }


  const adminNotifBox = document.getElementById('systemAdminNotifications');
  if (adminNotifBox) {
    const notifications = await fetchNotificationsForCurrentUser(8);
    adminNotifBox.innerHTML = notifications.length ? notifications.map(notificationCard).join('') : `<div class="p-5 text-sm text-slate-600">No notifications yet.</div>`;
    await bindNotificationReadButtons(mount, renderSystemAdmin);
  }

  const usersBody = document.getElementById('systemAdminUsersBody');
  const usersPageData = paginate(profiles, APP_STATE.systemAdminUsersPage, APP_STATE.systemAdminPerPage);
  APP_STATE.systemAdminUsersPage = usersPageData.page;
  usersBody.innerHTML = usersPageData.items.length ? usersPageData.items.map(profile => `<tr class="border-t border-slate-200"><td class="px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(profile.full_name || '—')}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(profile.email || '—')}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(friendlyRole(profile.role || ''))}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(profile.department || '—')}</td></tr>`).join('') : `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="4">No accounts found.</td></tr>`;
  renderPagination('systemAdminUsersPagination', usersPageData, () => { APP_STATE.systemAdminUsersPage--; renderSystemAdmin(); }, () => { APP_STATE.systemAdminUsersPage++; renderSystemAdmin(); });

  const logsBody = document.getElementById('systemAdminLogsBody');
  const { data: logs } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false });
  const actorMap = await fetchProfileMapByIds((logs || []).map(l => l.actor_id).filter(Boolean));
  const pageData = paginate(logs || [], APP_STATE.systemAdminLogsPage, APP_STATE.systemAdminPerPage);
  APP_STATE.systemAdminLogsPage = pageData.page;
  logsBody.innerHTML = pageData.items.length ? pageData.items.map(log => `<tr class="border-t border-slate-200"><td class="px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(log.action)}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(log.details || '—')}</td><td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(actorMap[log.actor_id]?.full_name || actorMap[log.actor_id]?.email || log.actor_id || 'system')}</td><td class="px-4 py-3 text-sm text-slate-700">${formatDateTime(log.created_at)}</td></tr>`).join('') : `<tr><td class="px-4 py-6 text-center text-sm text-slate-600" colspan="4">No audit logs yet.</td></tr>`;
  renderPagination('systemAdminLogsPagination', pageData, () => { APP_STATE.systemAdminLogsPage--; renderSystemAdmin(); }, () => { APP_STATE.systemAdminLogsPage++; renderSystemAdmin(); });
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

async function renderAdminAnalyticsCharts() {
  if (!document.getElementById('reportsTrendChart') && !document.getElementById('statusBarChart') && !document.getElementById('claimsPieChart')) return;
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js is not loaded. Analytics charts skipped.');
    return;
  }

  const reports = await fetchAllReports();
  const claims = await fetchAllClaims();

  const statusCounts = {
    Pending: reports.filter(r => r.status === 'Pending').length,
    Approved: reports.filter(r => r.status === 'Approved').length,
    Rejected: reports.filter(r => r.status === 'Rejected').length,
    Claimed: reports.filter(r => r.status === 'Claimed').length,
    Returned: reports.filter(r => r.status === 'Returned').length
  };

  const claimCounts = {
    Pending: claims.filter(c => c.status === 'Pending').length,
    Approved: claims.filter(c => c.status === 'Approved').length,
    Rejected: claims.filter(c => c.status === 'Rejected').length
  };

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
      options: { ...baseOptions, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
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
      options: { ...baseOptions, cutout: '58%' },
      plugins: [gcfindEmptyChartPlugin]
    });
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
    const { error: insertError } = await sb.from('item_reports').insert(restoredRecord);
    if(insertError) throw insertError;
    const { error: updateError } = await sb.from('deleted_records_archive').update({restored_at:new Date().toISOString()}).eq('id',id);
    if(updateError) throw updateError;
    hideLoading();
    showSuccess('Deleted report restored successfully.', { position: 'top-right' });
    await openRecoverDataModal();
    await renderSystemAdmin();
  } catch (err) {
    hideLoading();
    showError(err.message || 'Unable to restore deleted report.', { position: 'top-right', duration: 5200 });
  }
}
