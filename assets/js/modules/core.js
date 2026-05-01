/* GCFind - Supabase-connected version
   Requires:
   1) supabase-js CDN loaded before this file
   2) supabase-config.js creating window.supabaseClient
*/

function $(selector, root = document) { return root.querySelector(selector); }
function $all(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

const STORAGE = {
  role: 'gcfind.role',
  sessionUser: 'gcfind.user'
};

const MOCK_ITEMS = [];

const SUPABASE_CONFIG = window.GCFIND_SUPABASE || null;
const SUPABASE_READY = Boolean(
  window.supabaseClient &&
  SUPABASE_CONFIG &&
  SUPABASE_CONFIG.url &&
  SUPABASE_CONFIG.anonKey &&
  !String(SUPABASE_CONFIG.url).includes('YOUR_') &&
  !String(SUPABASE_CONFIG.anonKey).includes('YOUR_')
);

const sb = window.supabaseClient || null;

const APP_STATE = {
  itemsPage: 1,
  itemsPerPage: 10,
  adminReportsPage: 1,
  adminClaimsPage: 1,
  adminLogsPage: 1,
  adminPerPage: 10,
  systemAdminUsersPage: 1,
  systemAdminLogsPage: 1,
  systemAdminPerPage: 10,
  adminTab: 'reports',
  threads: [],
  activeThreadKey: null,
  charts: {},
  realtimeInitialized: false
};

/* ===================== LOCAL SESSION CACHE ===================== */
function setRole(role) { localStorage.setItem(STORAGE.role, role); }
function getRole() { return localStorage.getItem(STORAGE.role) || ''; }
function setUser(user) { localStorage.setItem(STORAGE.sessionUser, JSON.stringify(user)); }
function getUser() {
  try { return JSON.parse(localStorage.getItem(STORAGE.sessionUser) || 'null'); }
  catch { return null; }
}
function clearSession() {
  localStorage.removeItem(STORAGE.role);
  localStorage.removeItem(STORAGE.sessionUser);
}

/* ===================== HELPERS ===================== */
function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function friendlyRole(role) {
  const map = {
    student: 'Student',
    faculty_staff: 'Faculty / Staff',
    admin: 'Security / Lost & Found Office',
    system_admin: 'System Administrator'
  };
  return map[role] || role || 'Guest';
}

function ensureLoadingOverlay() {
  if ($('#loadingOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'loadingOverlay';
  overlay.className = 'loading-overlay hidden';
  overlay.innerHTML = `<div class="loading-box"><div class="spinner"></div><p>Loading, please wait...</p></div>`;
  document.body.appendChild(overlay);
}
function showLoading(text = 'Loading, please wait...') {
  ensureLoadingOverlay();
  const overlay = $('#loadingOverlay');
  overlay.classList.remove('hidden');
  const p = overlay.querySelector('p');
  if (p) p.textContent = text;
}
function hideLoading() { $('#loadingOverlay')?.classList.add('hidden'); }

function isAuthSurface() {
  const path = String(window.location.pathname || '').toLowerCase();
  return /login|register/.test(path);
}

function ensureNoticeLayer() {
  if (!document.getElementById('noticeLayer')) {
    const layer = document.createElement('div');
    layer.id = 'noticeLayer';
    layer.className = 'notice-layer';
    document.body.appendChild(layer);
  }
  if (!document.getElementById('confirmOverlay')) {
    const wrap = document.createElement('div');
    wrap.id = 'confirmOverlay';
    wrap.className = 'confirm-overlay hidden';
    document.body.appendChild(wrap);
  }
}

function showNotice(message, type = 'info', opts = {}) {
  ensureNoticeLayer();
  const layer = document.getElementById('noticeLayer');
  const position = opts.position || (isAuthSurface() ? 'center' : 'top-right');
  layer.className = `notice-layer notice-${position}`;

  const item = document.createElement('div');
  item.className = `notice notice-${type}`;
  item.innerHTML = `
    <div class="notice-icon">${type === 'success' ? '✓' : type === 'error' ? '!' : 'i'}</div>
    <div class="notice-text">${escapeHtml(message)}</div>
  `;

  layer.appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));

  const duration = opts.duration ?? (position === 'center' ? 2200 : 3000);
  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 220);
  }, duration);
}

function showError(message, opts = {}) { showNotice(message, 'error', opts); }
function showSuccess(message, opts = {}) { showNotice(message, 'success', opts); }
function showInfo(message, opts = {}) { showNotice(message, 'info', opts); }

function appConfirm(message) {
  ensureNoticeLayer();
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmOverlay');
    overlay.innerHTML = `
      <div class="confirm-backdrop"></div>
      <div class="confirm-card">
        <div class="confirm-title">Please confirm</div>
        <div class="confirm-message">${escapeHtml(message)}</div>
        <div class="confirm-actions">
          <button type="button" class="confirm-btn secondary" data-confirm-cancel>Cancel</button>
          <button type="button" class="confirm-btn primary" data-confirm-ok>Confirm</button>
        </div>
      </div>
    `;
    overlay.classList.remove('hidden');

    const close = (result) => {
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
      resolve(result);
    };

    overlay.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => close(false));
    overlay.querySelector('[data-confirm-ok]')?.addEventListener('click', () => close(true));
    overlay.querySelector('.confirm-backdrop')?.addEventListener('click', () => close(false));
  });
}

function setFieldError(input, message) {
  if (!input) return;
  const help = document.querySelector(`[data-error-for="${input.id}"]`);
  if (help) help.textContent = message || '';
  if (message) input.classList.add('ring-2', 'ring-red-500');
  else input.classList.remove('ring-2', 'ring-red-500');
}

function formatDateTime(dateString) {
  try { return new Date(dateString).toLocaleString(); }
  catch { return dateString || ''; }
}

function statusPill(status) {
  const map = {
    Pending: 'bg-amber-50 text-amber-700 ring-amber-200',
    Approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Rejected: 'bg-red-50 text-red-700 ring-red-200',
    Claimed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    Returned: 'bg-slate-100 text-slate-700 ring-slate-200'
  };
  const cls = map[status] || map.Pending;
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}">${escapeHtml(status)}</span>`;
}

function typePill(type) {
  const cls = type === 'Found'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${cls}">${escapeHtml(type)}</span>`;
}

function requireSupabase() {
  if (!SUPABASE_READY || !sb) {
    console.error('Supabase is not ready. Check supabase-config.js and script tags.');
    showError('Supabase is not ready yet. Please check your configuration.', { position: isAuthSurface() ? 'center' : 'top-right' });
    return false;
  }
  return true;
}


function paginate(items, page, perPage) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  return { page: safePage, total, totalPages, perPage, items: items.slice(start, start + perPage) };
}

function renderPagination(containerId, pageData, onPrev, onNext) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!pageData || !pageData.total) { el.innerHTML = ''; return; }
  const start = (pageData.page - 1) * pageData.perPage + 1;
  const end = Math.min(pageData.page * pageData.perPage, pageData.total);
  el.innerHTML = `
    <div class="pagination">
      <div class="text-sm text-slate-600">Showing ${start} to ${end} of ${pageData.total}</div>
      <div class="pagination-controls">
        <button class="pagination-btn" ${pageData.page <= 1 ? 'disabled' : ''} data-page-prev="${containerId}">Previous</button>
        <span class="text-sm font-semibold text-slate-700">Page ${pageData.page} of ${pageData.totalPages}</span>
        <button class="pagination-btn" ${pageData.page >= pageData.totalPages ? 'disabled' : ''} data-page-next="${containerId}">Next</button>
      </div>
    </div>`;
  el.querySelector('[data-page-prev]')?.addEventListener('click', onPrev);
  el.querySelector('[data-page-next]')?.addEventListener('click', onNext);
}

function setRing(el, value, total, color) {
  if (!el) return;
  const pct = total ? Math.round((value / total) * 100) : 0;
  el.style.setProperty('--p', `${Math.max(0, Math.min(100, pct)) * 3.6}deg`);
  el.style.setProperty('--ring', color || '#2563eb');
  el.setAttribute('data-value', `${pct}%`);
}


/* ===================== SUPABASE DATA HELPERS ===================== */
async function getAuthUser() {
  if (!requireSupabase()) return null;
  const { data, error } = await sb.auth.getUser();
  if (error) return null;
  return data.user || null;
}

async function fetchProfileById(id) {
  if (!requireSupabase() || !id) return null;
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('fetchProfileById error:', error);
    return null;
  }

  return data;
}

async function fetchProfileMapByIds(ids = []) {
  if (!requireSupabase() || !ids.length) return {};
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return {};

  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, email, role, department')
    .in('id', uniqueIds);

  if (error || !data) return {};

  return data.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});
}

async function createAuditLog(action, targetType = '', targetId = '', details = '') {
  if (!SUPABASE_READY || !sb) return;
  const authUser = await getAuthUser();
  if (!authUser) return;

  const { error } = await sb.from('audit_logs').insert({
    actor_id: authUser.id,
    action,
    target_type: targetType,
    target_id: targetId || null,
    details
  });

  if (error) {
    console.error('audit_logs insert error:', error);
  }
}

async function uploadImageToSupabase(file) {
  const user = await getAuthUser();
  if (!user || !file) return null;

  const fileExt = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${fileExt}`;

  const { error } = await sb.storage
    .from('item-images')
    .upload(fileName, file, { upsert: true });

  if (error) throw error;

  const { data } = sb.storage
    .from('item-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}

async function syncSessionFromSupabase() {
  if (!SUPABASE_READY || !sb) return;

  const user = await getAuthUser();
  if (!user) {
    clearSession();
    return;
  }

  const profile = await fetchProfileById(user.id);

  const uiRole = (profile?.role === 'admin' || profile?.role === 'system_admin') ? 'admin' : 'user';

  setRole(uiRole);
  setUser({
    id: user.id,
    name: profile?.full_name || user.email,
    email: user.email,
    role: profile?.role || 'student',
    department: profile?.department || 'General'
  });
}

/* ===================== PAGE GUARDS ===================== */
function guardPage() {
  const required = document.body?.dataset.requiresRole || '';
  const requiredUserType = document.body?.dataset.requiresUserType || '';
  const role = getRole();
  const user = getUser();

  if (required && role !== required) {
    window.location.replace('login.html');
    return;
  }

  if (requiredUserType) {
    const allowed = requiredUserType.split('|').map(v => v.trim()).filter(Boolean);
    const current = user?.role || '';
    if (!allowed.includes(current)) {
      window.location.replace('index.html');
    }
  }
}

function wireLogoutButtons() {
  $all('[data-action="logout"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (SUPABASE_READY && sb) {
        await sb.auth.signOut();
      }
      clearSession();
      window.location.href = 'login.html';
    });
  });
}

function updateNavProfile() {
  const u = getUser();
  if ($('#navUserName')) $('#navUserName').textContent = u?.name || 'User';
  if ($('#navRoleBadge')) $('#navRoleBadge').textContent = friendlyRole(u?.role || getRole()).toUpperCase();
  if ($('#navRoleSubtext')) $('#navRoleSubtext').textContent = u?.department || friendlyRole(u?.role || getRole());

  const isFaculty = u?.role === 'faculty_staff';
  const isAdmin = ['admin','system_admin'].includes(u?.role);
  const isSystemAdmin = u?.role === 'system_admin';
  $all('[data-faculty-only]').forEach(el => el.classList.toggle('hidden', !isFaculty));
  $all('[data-student-only]').forEach(el => el.classList.toggle('hidden', u?.role !== 'student'));
  $all('[data-admin-only]').forEach(el => el.classList.toggle('hidden', !isAdmin));
  $all('[data-system-admin-only]').forEach(el => el.classList.toggle('hidden', !isSystemAdmin));
}




function getDashboardHrefForRole(role) {
  if (role === 'system_admin') return 'system-admin.html';
  if (role === 'admin') return 'admin.html';
  return 'index.html';
}

function syncRoleAwareNav() {
  const user = getUser();
  const role = user?.role || '';
  const dashboardHref = getDashboardHrefForRole(role);
  const page = document.body?.dataset.page || '';

  // Keep page-specific home buttons stable on their own dashboards.
  // Only use role-aware home targets on shared pages like messages, report, and details.
  if (['messages', 'report', 'details'].includes(page)) {
    document.querySelectorAll('[data-home-link]').forEach(el => { el.setAttribute('href', dashboardHref); });
  }

  document.querySelectorAll('[data-faculty-only]').forEach(el => el.classList.toggle('hidden', role !== 'faculty_staff'));
  document.querySelectorAll('[data-admin-only]').forEach(el => el.classList.toggle('hidden', !['admin','system_admin'].includes(role)));
  document.querySelectorAll('[data-system-admin-only]').forEach(el => el.classList.toggle('hidden', role !== 'system_admin'));
}

async function updateMessageBadges() { return; }

async function markActiveThreadRead(active) { return; }
function applyActiveNav() {
  const page = document.body?.dataset.page || '';
  const user = getUser();
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === page);
  });
  document.querySelectorAll('[data-admin-only]').forEach(el => el.classList.toggle('hidden', !['admin','system_admin'].includes(user?.role)));
  document.querySelectorAll('[data-system-admin-only]').forEach(el => el.classList.toggle('hidden', user?.role !== 'system_admin'));
}


function initPageTransitions() {
  document.body.classList.add('page-ready');
  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (link.hasAttribute('data-no-transition')) return;
    link.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || link.target === '_blank') return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return;
      e.preventDefault();
      document.body.classList.add('page-exit');
      setTimeout(() => { window.location.href = link.href; }, 180);
    });
  });
}

/* ===================== AUTH ===================== */



/* ===================== REALTIME REFRESH v2.8 ===================== */
function initRealtimeRefresh() {
  if (!SUPABASE_READY || !sb) return;
  if (APP_STATE.realtimeInitialized) return;
  APP_STATE.realtimeInitialized = true;
  try {
    sb.channel('gcfind-live-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_reports' }, async () => {
        if (document.getElementById('itemsGrid')) await initDashboard();
        if (document.getElementById('adminReportsBody')) {
          await renderAdminReports();
          if (typeof renderAdminAnalyticsCharts === 'function') await renderAdminAnalyticsCharts();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claim_requests' }, async () => {
        if (document.getElementById('adminClaimsBody')) await renderAdminClaims();
        if (typeof renderAdminAnalyticsCharts === 'function') await renderAdminAnalyticsCharts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, async () => {
        if (document.getElementById('adminLogsBody')) await renderAdminLogs();
        if (document.getElementById('systemAdminLogsBody')) await renderSystemAdmin();
      })
      .subscribe();
  } catch (err) {
    console.warn('Realtime refresh skipped:', err);
  }
}
