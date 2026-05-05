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
  try {
    ensureLoadingOverlay();

    try { await syncSessionFromSupabase(); } catch(e){ console.error('syncSessionFromSupabase', e); }
    try { guardPage(); } catch(e){ console.error('guardPage', e); }
    try { wireLogoutButtons(); } catch(e){ console.error('wireLogoutButtons', e); }
    try { updateNavProfile(); } catch(e){ console.error('updateNavProfile', e); }
    try { syncRoleAwareNav(); } catch(e){ console.error('syncRoleAwareNav', e); }
    try { applyActiveNav(); } catch(e){ console.error('applyActiveNav', e); }
    try { initGlobalNotificationDropdown(); } catch(e){ console.error('initGlobalNotificationDropdown', e); }
    try { initPasswordVisibilityToggles(); } catch(e){ console.error('initPasswordVisibilityToggles', e); }
    try { initPageTransitions(); } catch(e){ console.error('initPageTransitions', e); }
    try { initUserLogin(); } catch(e){ console.error('initUserLogin', e); }
    try { initForgotPassword(); } catch(e){ console.error('initForgotPassword', e); }
    try { initAdminLogin(); } catch(e){ console.error('initAdminLogin', e); }
    try { initRegisterForm(); } catch(e){ console.error('initRegisterForm', e); }
    try { initResetPasswordForm(); } catch(e){ console.error('initResetPasswordForm', e); }
    try { await initDashboard(); } catch(e){ console.error('initDashboard', e); }
    try { await loadUserClaimNotifications(); } catch(e){ console.error('loadUserClaimNotifications', e); }
    try { await initDetails(); } catch(e){ console.error('initDetails', e); }
    try { initReportForm(); } catch(e){ console.error('initReportForm', e); }
    try { await renderAdminReports(); } catch(e){ console.error('renderAdminReports', e); }
    try { await renderAdminClaims(); } catch(e){ console.error('renderAdminClaims', e); }
    try { await renderAdminLogs(); } catch(e){ console.error('renderAdminLogs', e); }
    try { await renderAdminTicketNotifications(); } catch(e){ console.error('renderAdminTicketNotifications', e); }
    try { await renderAdminAnalyticsCharts(); } catch(e){ console.error('renderAdminAnalyticsCharts', e); }
    try { await renderSystemAdmin(); } catch(e){ console.error('renderSystemAdmin', e); }
    try { await renderStaffPanel(); } catch(e){ console.error('renderStaffPanel', e); }
    try { initAdminActions(); } catch(e){ console.error('initAdminActions', e); }
    try { initGcfindTrueFixedModals(); } catch(e){ console.error('initGcfindTrueFixedModals', e); }
    try { initUIHelpers(); } catch(e){ console.error('initUIHelpers', e); }
    try { initRealtimeRefresh(); } catch(e){ console.error('initRealtimeRefresh', e); }
    try { initAdminRealtimeAnalytics(); } catch(e){ console.error('initAdminRealtimeAnalytics', e); }
  } catch (e) {
    console.error('GCFind boot failed:', e);
  } finally {
    hideLoading();
    document.body.classList.add('page-ready');
  }
}

// Safety fallback: never leave initial loading overlay stuck.
setTimeout(() => {
  try { hideLoading(); document.body.classList.add('page-ready'); } catch (_) {}
}, 2500);

document.addEventListener('DOMContentLoaded', boot);

