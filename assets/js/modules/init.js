function initUIHelpers() {
  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      APP_STATE.adminTab = btn.dataset.adminTab;
      document.querySelectorAll('[data-admin-tab]').forEach(b => b.classList.toggle('active', b.dataset.adminTab === APP_STATE.adminTab));
      document.querySelectorAll('[data-admin-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.adminPanel !== APP_STATE.adminTab));
    });
  });
}

/* ===================== BOOT ===================== */
async function boot() {
  ensureLoadingOverlay();
  await syncSessionFromSupabase();
  guardPage();
  wireLogoutButtons();
  updateNavProfile();
  syncRoleAwareNav();
  applyActiveNav();
  initPageTransitions();
  initUserLogin();
  initAdminLogin();
  initRegisterForm();
  await initDashboard();
  try { await loadUserClaimNotifications(); } catch(e){ console.error('loadUserClaimNotifications', e); }
  await initDetails();
  initReportForm();
  try { await renderAdminReports(); } catch(e){ console.error('renderAdminReports', e); }
  try { await renderAdminClaims(); } catch(e){ console.error('renderAdminClaims', e); }
  try { await renderAdminLogs(); } catch(e){ console.error('renderAdminLogs', e); }
  try { await renderAdminTicketNotifications(); } catch(e){ console.error('renderAdminTicketNotifications', e); }
  try { await renderAdminAnalyticsCharts(); } catch(e){ console.error('renderAdminAnalyticsCharts', e); }
  try { await renderSystemAdmin(); } catch(e){ console.error('renderSystemAdmin', e); }
  try { await renderStaffPanel(); } catch(e){ console.error('renderStaffPanel', e); }
  initAdminActions();
  initUIHelpers();
  initRealtimeRefresh();
}

document.addEventListener('DOMContentLoaded', boot);
