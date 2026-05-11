function mapReportRow(r, profileMap = {}) {
  const reporter = profileMap[r.user_id] || {};
  const fallbackName =
    r.reporter_name ||
    r.owner_name ||
    r.full_name ||
    r.submitted_by_name ||
    '';
  const fallbackEmail =
    '' ||
    r.owner_email ||
    r.email ||
    r.submitted_by_email ||
    '';
  const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));

  const reporterName =
    reporter.full_name ||
    fallbackName ||
    reporter.email ||
    fallbackEmail ||
    (isUuid(r.user_id) ? 'Unknown user' : r.user_id) ||
    'Unknown user';

  const reporterEmail =
    reporter.email ||
    fallbackEmail ||
    (isUuid(r.user_id) ? '' : r.user_id) ||
    '';

  return {
    id: r.id,
    reporterId: r.user_id,
    itemName: r.item_name,
    category: r.category,
    location: r.location,
    date: r.date_reported,
    imageDataUrl: r.image_url,
    type: r.type,
    description: r.description,
    status: r.status,
    submittedBy: reporterEmail || reporterName,
    submittedByName: reporterName,
    submittedByRole: reporter.role || '',
    source: 'remote',
    createdAt: r.created_at
  };
}



async function getAllPublicItems() {
  if (!requireSupabase()) return [];

  const { data, error } = await sb
    .from('item_reports')
    .select('*')
    .in('status', ['Approved', 'Claimed', 'Returned'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }

  const ids = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
  const profileMap = await fetchProfileMapByIds(ids);
  return (data || []).map(r => mapReportRow(r, profileMap));
}


async function getItemById(id) {
  const mock = MOCK_ITEMS.find(item => item.id === id);
  if (mock) return mock;

  if (!requireSupabase()) return null;

  const { data, error } = await sb
    .from('item_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  const profileMap = await fetchProfileMapByIds([data.user_id]);
  return mapReportRow(data, profileMap);
}

async function findMatches(report) {
  if (!requireSupabase() || !report?.id || report.source === 'mock') return [];

  const { data, error } = await sb
    .from('item_reports')
    .select('*')
    .neq('id', report.id)
    .neq('type', report.type)
    .eq('category', report.category)
    .ilike('location', `%${report.location}%`)
    .limit(5);

  if (error || !data) return [];

  const ids = [...new Set(data.map(r => r.user_id).filter(Boolean))];
  const profileMap = await fetchProfileMapByIds(ids);
  return data.map(r => mapReportRow(r, profileMap));
}


function renderItemCard(item) {
  return `
    <article class="card group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300">
      <div class="bg-slate-50 p-3">
        <img src="${escapeHtml(item.imageDataUrl || item.image || '../assets/img/fallback.jpg')}" alt="${escapeHtml(item.itemName || item.name)}" class="w-full h-44 object-cover rounded-xl" onerror="this.onerror=null;this.src='../assets/img/fallback.jpg';" />
      </div>
      <div class="p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold text-slate-900 leading-tight">${escapeHtml(item.itemName || item.name)}</h3>
            <p class="text-sm text-slate-600 mt-1">${escapeHtml(item.location)}</p>
          </div>
          ${typePill(item.type)}
        </div>
        <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Category: <span class="font-medium text-slate-700">${escapeHtml(item.category)}</span></span>
          <time>${escapeHtml(item.date)}</time>
        </div>
        <div class="mt-2 flex items-center justify-between gap-2">${statusPill(item.status || 'Approved')}<span class="text-xs text-slate-500 truncate">${escapeHtml(item.submittedByName || '')}</span></div>
        <div class="mt-4">
          <a class="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" href="details.html?id=${encodeURIComponent(item.id)}">View Details</a>
        </div>
      </div>
    </article>`;
}


async function initDashboard() {
  const grid = $('#itemsGrid');
  if (!grid) return;

  const searchInput = $('#searchInput');
  const categorySelect = $('#filterCategory');
  const locationSelect = $('#filterLocation');
  const dateSelect = $('#filterDate');
  const resultsMeta = $('#resultsMeta');
  let searchHintBox = document.getElementById('searchHintBox');
  if (!searchHintBox && grid?.parentElement) {
    searchHintBox = document.createElement('div');
    searchHintBox.id = 'searchHintBox';
    searchHintBox.className = 'mt-4 rounded-2xl bg-emerald-50/70 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100';
    grid.parentElement.insertBefore(searchHintBox, grid);
  }

  let itemsSource = await getAllPublicItems();

  function fillSelect(selectEl, options) {
    if (!selectEl) return;
    selectEl.querySelectorAll('option:not(:first-child)').forEach((o) => o.remove());
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      selectEl.appendChild(o);
    });
  }

  fillSelect(categorySelect, [...new Set(itemsSource.map(i => i.category).filter(Boolean))].sort());
  fillSelect(locationSelect, [...new Set(itemsSource.map(i => i.location).filter(Boolean))].sort());

  function render() {
    let items = [...itemsSource];
    const q = (searchInput?.value || '').trim().toLowerCase();
    const category = categorySelect?.value || '';
    const location = locationSelect?.value || '';
    const dateSort = dateSelect?.value || '';

    items = items.filter((item) => {
      const hay = `${item.itemName || item.name} ${item.location} ${item.category} ${item.type}`.toLowerCase();
      return (!q || hay.includes(q)) && (!category || item.category === category) && (!location || item.location === location);
    });

    if (dateSort === 'newest') items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (dateSort === 'oldest') items.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    if (searchHintBox) {
      const preview = items.slice(0, 3);
      searchHintBox.innerHTML = preview.length
        ? `<div class="font-extrabold text-emerald-950">Search preview</div><div class="mt-2 flex flex-wrap gap-2">${preview.map(item => `<span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">${escapeHtml(item.itemName || item.name || 'Item')} • ${escapeHtml(item.location || 'No location')}</span>`).join('')}</div>`
        : `<div class="font-extrabold text-emerald-950">No preview available</div><p class="mt-1 text-sm text-emerald-800">Use item name, category, or location to quickly find approved lost and found listings.</p>`;
    }

    const pageData = paginate(items, APP_STATE.itemsPage, APP_STATE.itemsPerPage);
    APP_STATE.itemsPage = pageData.page;

    grid.innerHTML = pageData.items.length
      ? pageData.items.map(renderItemCard).join('')
      : `<div class="col-span-full rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200"><i class="fa-regular fa-folder-open text-3xl text-slate-400"></i><p class="mt-3 text-sm font-semibold text-slate-700">No matching items found.</p><p class="mt-1 text-xs text-slate-500">Try adjusting your search or filters.</p></div>`;

    if (resultsMeta) resultsMeta.textContent = `${items.length} item(s) shown`;
    renderPagination('itemsPagination', pageData, () => { APP_STATE.itemsPage--; render(); }, () => { APP_STATE.itemsPage++; render(); });
  }

  ['input', 'change'].forEach(evt => {
    searchInput?.addEventListener(evt, () => { APP_STATE.itemsPage = 1; render(); });
    categorySelect?.addEventListener(evt, () => { APP_STATE.itemsPage = 1; render(); });
    locationSelect?.addEventListener(evt, () => { APP_STATE.itemsPage = 1; render(); });
    dateSelect?.addEventListener(evt, () => { APP_STATE.itemsPage = 1; render(); });
  });

  render();
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function createClaimModal(item) {
  if ($('#claimModal')) return;

  const modal = document.createElement('div');
  modal.id = 'claimModal';
  modal.className = 'fixed inset-0 z-50 hidden';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-slate-900/40" data-claim-close></div>
    <div class="absolute inset-x-0 bottom-0 sm:inset-0 sm:grid sm:place-items-center p-4">
      <section class="w-full max-w-lg rounded-3xl bg-white shadow-soft ring-1 ring-slate-200 overflow-hidden">
        <header class="flex items-start justify-between gap-3 p-5 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-extrabold text-slate-900">Claim Request</h3>
            <p class="mt-1 text-sm text-slate-600">Submit a short message to verify ownership of this item.</p>
          </div>
          <button type="button" class="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100" data-claim-close>Close</button>
        </header>
        <form id="claimForm" class="p-5 space-y-4">
          <input type="hidden" id="claimReportId" value="${escapeHtml(item.id)}" />
          <div>
            <label for="claimMessage" class="text-sm font-semibold text-slate-700">Claim Message</label>
            <textarea id="claimMessage" rows="4" class="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500" placeholder="Describe why this item belongs to you." required></textarea>
          </div>
          <button type="submit" class="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700">Submit Claim Request</button>
        </form>
      </section>
    </div>`;

  document.body.appendChild(modal);

  $all('[data-claim-close]', modal).forEach(btn =>
    btn.addEventListener('click', () => modal.classList.add('hidden'))
  );

  $('#claimForm', modal)?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    const message = ($('#claimMessage', modal)?.value || '').trim();
    const reportId = $('#claimReportId', modal)?.value;
    if (!message) return;

    const authUser = await getAuthUser();
    if (!authUser) {
      showError('Please log in first.', { position: isAuthSurface() ? 'center' : 'top-right' });
      return;
    }

    const sessionUser = getUser() || {};
    const claimPayload = {
      report_id: reportId,
      claimant_id: authUser.id,
      claim_message: message,
      status: 'Pending'
    };

    // Match the actual claim_requests schema shown in Supabase:
    // report_id, claimant_id, claim_message, status.
    let { data: claimData, error } = await sb.from('claim_requests').insert(claimPayload).select().single();

    if (error) {
      showError(error.message, { position: isAuthSurface() ? 'center' : 'top-right' });
      return;
    }

    await createAuditLog('Claim Request Submitted', 'claim_request', reportId, message);
    await createWorkflowNotification({
      recipientRole: 'faculty_staff',
      title: 'New Claim Request Submitted',
      message: 'A student submitted a claim request that needs staff verification.',
      type: 'claim',
      relatedId: claimData?.id || reportId
    });
    await createWorkflowNotification({
      recipientUserId: authUser.id,
      recipientEmail: authUser.email,
      title: 'Claim Request Submitted',
      message: 'Your claim request is now pending review by the Security / Lost & Found Office.',
      type: 'claim',
      relatedId: claimData?.id || reportId
    });
    modal.classList.add('hidden');
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
    if (typeof loadUserClaimNotifications === 'function') await loadUserClaimNotifications();
    showSuccess('Claim request submitted successfully. Please wait for admin verification.', { position: 'top-right' });
  });
}


async function initDetails() {
  const mount = $('#itemDetailsMount');
  if (!mount) return;

  const id = getQueryParam('id');
  const item = id ? await getItemById(id) : null;
  if (!item) {
    mount.innerHTML = `<div class="rounded-2xl bg-white p-8 text-center ring-1 ring-slate-200 text-slate-600">Item not found.</div>`;
    return;
  }

  const matches = await findMatches(item);

  mount.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      <section class="lg:col-span-2 self-start rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div class="p-4 bg-slate-50">
          <button type="button" id="openPhotoOverlay" class="details-image-link block w-full rounded-xl bg-white ring-1 ring-slate-200 p-3 hover:ring-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition" aria-label="Open full item photo">
            <img src="${escapeHtml(item.imageDataUrl || '../assets/img/fallback.jpg')}" alt="${escapeHtml(item.itemName)}" class="details-image w-full rounded-lg" onerror="this.onerror=null;this.src='../assets/img/fallback.jpg';" />
          </button>
          <p class="mt-2 text-center text-xs text-slate-500">Click the image to preview the full photo.</p>
        </div>
      </section>
      <section class="lg:col-span-3 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div class="p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 class="text-2xl font-bold text-slate-900">${escapeHtml(item.itemName)}</h1>
              <p class="text-slate-600 mt-1">Reported as ${typePill(item.type)}</p>
            </div>
            ${statusPill(item.status || 'Approved')}
          </div>
          <dl class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"><dt class="text-xs uppercase tracking-wide text-slate-500">Category</dt><dd class="mt-1 font-semibold text-slate-900">${escapeHtml(item.category)}</dd></div>
            <div class="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"><dt class="text-xs uppercase tracking-wide text-slate-500">Location</dt><dd class="mt-1 font-semibold text-slate-900">${escapeHtml(item.location)}</dd></div>
            <div class="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"><dt class="text-xs uppercase tracking-wide text-slate-500">Date</dt><dd class="mt-1 font-semibold text-slate-900">${escapeHtml(item.date)}</dd></div>
            <div class="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"><dt class="text-xs uppercase tracking-wide text-slate-500">Reported By</dt><dd class="mt-1 font-semibold text-slate-900">${escapeHtml(item.submittedByName || item.submittedBy || 'GCFind')}</dd></div>
            <div class="sm:col-span-2 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"><dt class="text-xs uppercase tracking-wide text-slate-500">Description</dt><dd class="mt-1 text-slate-800">${escapeHtml(item.description)}</dd></div>
          </dl>

          ${matches.length ? `
            <div class="mt-6 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
              <h3 class="font-semibold text-emerald-900">Possible Matches</h3>
              <ul class="mt-2 space-y-1 text-sm text-emerald-800">
                ${matches.slice(0, 3).map(m => `<li>• ${escapeHtml(m.itemName)} — ${escapeHtml(m.location)}</li>`).join('')}
              </ul>
            </div>` : ''}

          <div class="mt-6 flex flex-col sm:flex-row gap-3">
            <button type="button" class="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700" id="claimBtn">Claim Item / Contact Owner</button>
            <a href="dashboard.html" class="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Back to Dashboard</a>
          </div>
        </div>
      </section>
    </div>`;

  createPhotoPreviewOverlay(item);
  createClaimModal(item);
  $('#claimBtn')?.addEventListener('click', () => $('#claimModal')?.classList.remove('hidden'));
  $('#openPhotoOverlay')?.addEventListener('click', () => $('#photoPreviewOverlay')?.classList.remove('hidden'));
}

function createPhotoPreviewOverlay(item) {
  if ($('#photoPreviewOverlay')) $('#photoPreviewOverlay').remove();

  const imageSrc = escapeHtml(item.imageDataUrl || '../assets/img/fallback.jpg');
  const itemName = escapeHtml(item.itemName || 'Item photo');
  const modal = document.createElement('div');
  modal.id = 'photoPreviewOverlay';
  modal.className = 'fixed inset-0 z-50 hidden bg-slate-950/80 backdrop-blur-sm px-4 py-6';
  modal.innerHTML = `
    <div class="mx-auto flex min-h-full max-w-5xl items-center justify-center">
      <div class="relative w-full rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
        <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 class="text-lg font-bold text-slate-900">${itemName}</h3>
            <p class="text-xs text-slate-500">Full item photo preview</p>
          </div>
          <button type="button" data-photo-close class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Close photo preview">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="photo-preview-stage bg-slate-50 p-4 sm:p-6">
          <img src="${imageSrc}" alt="${itemName}" class="photo-preview-image" onerror="this.onerror=null;this.src='../assets/img/fallback.jpg';" />
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const close = () => modal.classList.add('hidden');
  $all('[data-photo-close]', modal).forEach(btn => btn.addEventListener('click', close));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
}

function initReportForm() {
  const form = $('#reportForm');
  if (!form) return;

  const imageInput = $('#itemImage');
  const previewImg = $('#imagePreview');
  const previewWrap = $('#imagePreviewWrap');
  const previewHint = $('#imagePreviewHint');
  let selectedFile = null;

  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      if (previewImg) previewImg.src = String(reader.result || '');
      previewWrap?.classList.remove('hidden');
      previewHint?.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireSupabase()) return;

    const requiredIds = ['itemType', 'itemName', 'itemDescription', 'itemCategory', 'itemLocation', 'itemDate'];
    let valid = true;

    requiredIds.forEach(id => {
      const input = document.getElementById(id);
      if (!input?.value.trim()) {
        valid = false;
        setFieldError(input, 'This field is required.');
      } else {
        setFieldError(input, '');
      }
    });

    if (!selectedFile) {
      valid = false;
      setFieldError(imageInput, 'Please upload an image.');
    } else {
      setFieldError(imageInput, '');
    }

    if (!valid) return;

    showLoading('Submitting your report...');

    try {
      const authUser = await getAuthUser();
      if (!authUser) throw new Error('User session not found.');

      const imageUrl = await uploadImageToSupabase(selectedFile);

      const itemName = $('#itemName').value.trim();

      const currentProfile = await fetchProfileById(authUser.id);
      const sessionUser = (typeof getUser === 'function' ? getUser() : {}) || {};
      const reporterName = currentProfile?.full_name || sessionUser?.name || authUser.user_metadata?.full_name || authUser.email || '';
      const reporterEmail = currentProfile?.email || sessionUser?.email || authUser.email || '';

      const reportPayload = {
        user_id: authUser.id,
        item_name: itemName,
        description: $('#itemDescription').value.trim(),
        category: $('#itemCategory').value,
        type: $('#itemType').value,
        location: $('#itemLocation').value.trim(),
        date_reported: $('#itemDate').value,
        image_url: imageUrl,
        status: 'Pending',
        reporter_name: reporterName,
        reporter_email: reporterEmail
      };

      let { data, error } = await sb.from('item_reports').insert(reportPayload).select().single();

      // Backward compatibility for older schemas.
      if (error && String(error.message || '').includes('reporter_')) {
        delete reportPayload.reporter_name;
        delete reportPayload.reporter_email;
        const retry = await sb.from('item_reports').insert(reportPayload).select().single();
        data = retry.data;
        error = retry.error;
      }

      // If System Admin is testing report restore/insert and user_id is not present in auth.users,
      // retry without user_id so the FK constraint does not block Recover Deleted Data.
      if (error && /foreign key constraint.*item_reports_user_id_fkey|violates foreign key constraint/i.test(String(error.message || ''))) {
        const retryPayload = { ...reportPayload };
        delete retryPayload.user_id;
        const retry = await sb.from('item_reports').insert(retryPayload).select().single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('item_reports insert error:', error);
        throw error;
      }

      await createAuditLog('Report Submitted', 'item_report', data?.id || '', itemName);

      await createWorkflowNotification({
        recipientRole: 'faculty_staff',
        title: 'New Item Report Submitted',
        message: `${reporterName || 'A student'} submitted a new ${reportPayload.type || 'item'} report: ${itemName}. Please review it in the Staff Panel.`,
        type: 'report',
        relatedId: data?.id || null
      });

      await createWorkflowNotification({
        recipientUserId: authUser.id,
        recipientEmail: authUser.email,
        title: 'Report Submitted',
        message: `Your ${reportPayload.type || 'item'} report for ${itemName} is pending review.`,
        type: 'report',
        relatedId: data?.id || null
      });

      if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();

      hideLoading();
      showSuccess('Report submitted successfully. It is now awaiting admin review.', { position: 'top-right' });
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
    } catch (err) {
      hideLoading();
      showError(err.message || 'Failed to submit report.', { position: 'top-right', duration: 3200 });
    }
  });
}

/* ===================== ADMIN ===================== */



/* ===================== STAFF NEW REPORT NOTIFICATION HELPER ===================== */
async function createWorkflowNotification({ recipientUserId = null, recipientEmail = null, recipientRole = null, title = 'Notification', message = '', type = 'info', relatedId = null } = {}) {
  if (!requireSupabase()) return null;

  // Match the actual notifications schema shown in Supabase.
  // Do NOT use missing columns like email, receiver_email, or target_role.
  async function insertNotification(payload) {
    const cleanRow = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
    try {
      const { data, error } = await sb.from('notifications').insert(cleanRow).select();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('Workflow notification insert skipped:', err.message);
      return null;
    }
  }

  try {
    if (!recipientUserId && recipientRole) {
      const { data: people, error: peopleError } = await sb
        .from('profiles')
        .select('*')
        .eq('role', recipientRole);

      if (!peopleError && Array.isArray(people) && people.length) {
        await Promise.all(people.map(person => insertNotification({
          recipient_user_id: person.id,
          recipient_role: recipientRole,
          title,
          message,
          type,
          related_id: relatedId,
          is_read: false
        })));
        return true;
      }
    }

    return await insertNotification({
      recipient_user_id: recipientUserId || null,
      recipient_role: recipientRole || null,
      title,
      message,
      type,
      related_id: relatedId,
      is_read: false
    });
  } catch (err) {
    console.warn('Workflow notification skipped:', err.message);
    return null;
  }
}

async function loadUserClaimNotifications() {
  const panel = document.getElementById('userNotificationsPanel');
  const list = document.getElementById('userNotificationsList');
  if (!panel || !list || !requireSupabase()) return;

  const authUser = await getAuthUser();
  if (!authUser) return;

  let notifications = [];
  let claims = [];
  let userReports = [];

  try {
    if (typeof fetchCurrentUserNotifications === 'function') {
      notifications = await fetchCurrentUserNotifications(10);
    } else {
      const notificationResult = await sb
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(10);
      notifications = notificationResult.data || [];
    }
  } catch (err) {
    console.warn('Unable to fetch user notifications:', err.message);
  }

  try {
    const claimResult = await sb
      .from('claim_requests')
      .select('*')
      .eq('claimant_id', authUser.id)
      .is('user_deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);
    claims = claimResult.data || [];
  } catch (err) {
    console.warn('Unable to fetch claim updates:', err.message);
  }

  try {
    const reportResult = await sb
      .from('item_reports')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(10);
    userReports = reportResult.data || [];
  } catch (err) {
    console.warn('Unable to fetch submitted report updates:', err.message);
  }

  const reportIds = [...new Set(claims.map(c => c.report_id).filter(Boolean))];
  let reportMap = {};
  if (reportIds.length) {
    const { data: reports } = await sb
      .from('item_reports')
      .select('*')
      .in('id', reportIds);
    reportMap = (reports || []).reduce((acc, r) => {
      acc[r.id] = r;
      return acc;
    }, {});
  }

  const deletedStudentIds = new Set(
    (typeof getDeletedStudentNotificationIds === 'function' ? getDeletedStudentNotificationIds() : [])
      .map(String)
  );
  const syntheticIdsToSkip = new Set([
    ...claims.map(c => `student-claim-${c.id}-${String(c.status || 'Pending')}`),
    ...userReports.flatMap(r => [`student-report-${r.id}-${String(r.status || 'Pending')}`]),
    ...deletedStudentIds
  ]);

  const notificationCards = notifications
    .filter(n => !syntheticIdsToSkip.has(String(n.id || '')) && !deletedStudentIds.has(String(n.id || '')))
    .map(n => `
    <article class="p-4 sm:p-5 ${n.is_read ? 'bg-white' : 'bg-emerald-50/60'}">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 class="font-extrabold text-slate-900">${escapeHtml(n.title || 'Notification')}</h3>
          <p class="mt-1 text-sm text-slate-600">${escapeHtml(n.message || '')}</p>
          <p class="mt-2 text-xs text-slate-500">${formatDateTime(n.created_at)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          ${!n.is_read ? `<button class="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200" data-user-notification-read="${escapeHtml(n.id)}">Mark read</button>` : ''}
          <button class="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50" data-user-notification-delete="${escapeHtml(n.id)}">Delete</button>
        </div>
      </div>
    </article>`);

  const readClaimIds = JSON.parse(localStorage.getItem('gcfind_student_read_claim_alerts') || '[]');
  const claimCards = claims
    .filter(claim => !deletedStudentIds.has(`student-claim-${claim.id}-${String(claim.status || 'Pending')}`))
    .map(claim => {
      const statusId = `student-claim-${claim.id}-${String(claim.status || 'Pending')}`;
      const syntheticRead = readClaimIds.includes(statusId);
      const report = reportMap[claim.report_id] || {};
      const status = claim.status || 'Pending';
      const isApproved = status === 'Approved';
      const isRejected = status === 'Rejected';
      const badgeClass = isApproved ? 'bg-emerald-100 text-emerald-800' : isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800';
      const message = isApproved
        ? 'Your claim has been approved. Please proceed to the Security / Lost & Found Office for verification and release.'
        : isRejected
          ? 'Your claim was not approved. Please coordinate with the office if you need clarification.'
          : 'Your claim request is still pending review by the Security / Lost & Found Office.';

      return `
        <article class="p-4 sm:p-5">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h3 class="font-extrabold text-slate-900">${escapeHtml(report.item_name || 'Claim Request')}</h3>
              <p class="mt-1 text-sm text-slate-600">${escapeHtml(message)}</p>
              <p class="mt-1 text-xs text-slate-500">${escapeHtml(report.location || '')}</p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <span class="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold ${badgeClass}">${escapeHtml(status)}</span>
              ${!syntheticRead ? `<button class="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50" data-user-synthetic-read="${escapeHtml(statusId)}" data-synthetic-key="gcfind_student_read_claim_alerts">Mark read</button>` : ''}
              <button class="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50" data-user-claim-delete="${escapeHtml(claim.id)}" data-user-claim-delete-synthetic="${escapeHtml(statusId)}">Delete</button>
            </div>
          </div>
        </article>`;
    });

  const readReportIds = JSON.parse(localStorage.getItem('gcfind_student_read_report_alerts') || '[]');
  const reportCards = userReports
    .filter(report => !deletedStudentIds.has(`student-report-${report.id}-${String(report.status || 'Pending')}`))
    .map(report => {
      const status = report.status || 'Pending';
      const statusId = `student-report-${report.id}-${String(status)}`;
      const syntheticRead = readReportIds.includes(statusId);
      const isApproved = String(status).toLowerCase() === 'approved';
      const isRejected = String(status).toLowerCase() === 'rejected';
      const badgeClass = isApproved ? 'bg-emerald-100 text-emerald-800' : isRejected ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800';
      const message = isApproved
        ? 'Your submitted report has been approved and is now visible in the listings.'
        : isRejected
          ? 'Your submitted report was rejected. Please contact the Security / Lost & Found Office for clarification.'
          : 'Your submitted report is still pending review by the Security / Lost & Found Office.';

      return `
        <article class="p-4 sm:p-5">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h3 class="font-extrabold text-slate-900">${escapeHtml(report.item_name || 'Submitted Report')}</h3>
              <p class="mt-1 text-sm text-slate-600">${escapeHtml(message)}</p>
              <p class="mt-1 text-xs text-slate-500">${escapeHtml(report.location || '')}</p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              <span class="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold ${badgeClass}">${escapeHtml(status)}</span>
              ${!syntheticRead ? `<button class="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50" data-user-synthetic-read="${escapeHtml(statusId)}" data-synthetic-key="gcfind_student_read_report_alerts">Mark read</button>` : ''}
              <button class="w-fit rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50" data-user-synthetic-delete="${escapeHtml(statusId)}">Delete</button>
            </div>
          </div>
        </article>`;
    });

  const cards = [...notificationCards, ...claimCards, ...reportCards];

  if (!cards.length) {
    panel.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  panel.classList.remove('hidden');
  list.innerHTML = cards.join('');

  list.querySelectorAll('[data-user-notification-read]').forEach(btn => btn.addEventListener('click', async () => {
    await sb.from('notifications').update({ is_read: true }).eq('id', btn.dataset.userNotificationRead);
    await loadUserClaimNotifications();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
  }));

  list.querySelectorAll('[data-user-notification-delete]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await appConfirm('Delete this notification?');
    if (!ok) return;
    const id = btn.dataset.userNotificationDelete;
    try {
      if (typeof deleteStudentNotificationLocally === 'function') deleteStudentNotificationLocally(id);
      const deleted = typeof deleteCurrentNotification === 'function'
        ? await deleteCurrentNotification(id)
        : false;
      if (deleted) {
        btn.closest('article')?.remove();
        showSuccess('Notification removed.');
      } else {
        btn.closest('article')?.remove();
        showSuccess('Notification removed from this dashboard.');
      }
    } catch (err) {
      console.warn('Unable to delete notification:', err.message);
      btn.closest('article')?.remove();
      showSuccess('Notification removed from this dashboard.');
    }
    await loadUserClaimNotifications();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
  }));

  list.querySelectorAll('[data-user-synthetic-read]').forEach(btn => btn.addEventListener('click', async () => {
    const key = btn.dataset.syntheticKey;
    const id = btn.dataset.userSyntheticRead;
    const readIds = JSON.parse(localStorage.getItem(key) || '[]');
    if (!readIds.includes(id)) readIds.push(id);
    localStorage.setItem(key, JSON.stringify(readIds));
    showSuccess('Notification marked as read.');
    await loadUserClaimNotifications();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
  }));

  list.querySelectorAll('[data-user-synthetic-delete]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await appConfirm('Delete this notification?');
    if (!ok) return;
    const id = btn.dataset.userSyntheticDelete;
    if (typeof deleteStudentNotificationLocally === 'function') deleteStudentNotificationLocally(id);
    btn.closest('article')?.remove();
    showSuccess('Notification deleted.');
    await loadUserClaimNotifications();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
  }));

  list.querySelectorAll('[data-user-claim-delete]').forEach(btn => btn.addEventListener('click', async () => {
    const ok = await appConfirm('Delete this claim update from your dashboard?');
    if (!ok) return;
    const id = btn.dataset.userClaimDelete;
    try {
      const { error } = await sb
        .from('claim_requests')
        .update({ user_deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('claimant_id', authUser.id);
      if (error) throw error;

      const readIds = JSON.parse(localStorage.getItem('gcfind_student_read_claim_alerts') || '[]');
      const syntheticId = btn.dataset.userClaimDeleteSynthetic || `student-claim-${id}-Pending`;
      if (!readIds.includes(syntheticId)) readIds.push(syntheticId);
      localStorage.setItem('gcfind_student_read_claim_alerts', JSON.stringify(readIds));
      if (typeof deleteStudentNotificationLocally === 'function') deleteStudentNotificationLocally(syntheticId);

      btn.closest('article')?.remove();
      showSuccess('Claim update deleted from your dashboard.');
    } catch (err) {
      console.warn('Unable to delete claim update from DB, hiding locally:', err.message);
      const syntheticId = btn.dataset.userClaimDeleteSynthetic || `student-claim-${id}-Pending`;
      if (typeof deleteStudentNotificationLocally === 'function') deleteStudentNotificationLocally(syntheticId);
      btn.closest('article')?.remove();
      showSuccess('Claim update removed from this dashboard.');
    }
    await loadUserClaimNotifications();
    if (typeof refreshGlobalNotifications === 'function') await refreshGlobalNotifications();
  }));
}
