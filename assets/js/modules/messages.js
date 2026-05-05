async function fetchMessages() {
  if (!requireSupabase()) return [];
  const authUser = await getAuthUser();
  if (!authUser) return [];
  const { data, error } = await sb
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${authUser.id},receiver_id.eq.${authUser.id}`)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

function groupThreads(messages, profileMap = {}, reportMap = {}) {
  const authId = getUser()?.id;
  const groups = {};
  messages.forEach(m => {
    const otherId = m.sender_id === authId ? m.receiver_id : m.sender_id;
    const key = `${otherId}__${m.report_id || 'general'}`;
    if (!groups[key]) groups[key] = { key, otherId, reportId: m.report_id, messages: [] };
    groups[key].messages.push(m);
  });
  return Object.values(groups).map(g => {
    const last = g.messages[g.messages.length - 1];
    return {
      ...g,
      lastMessage: last,
      otherName: profileMap[g.otherId]?.full_name || profileMap[g.otherId]?.email || g.otherId,
      reportName: reportMap[g.reportId]?.itemName || 'General Inquiry'
    };
  }).sort((a,b)=> new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at));
}

async function renderMessagesPage() {
  const threadsMount = $('#messageThreads');
  if (!threadsMount) return;
  const listMount = $('#messageList');
  const header = $('#messageHeader');
  const composer = $('#messageComposer');
  const authUser = await getAuthUser();
  if (!authUser) return;

  const messages = await fetchMessages();
  const profileIds = [...new Set(messages.flatMap(m => [m.sender_id, m.receiver_id]).filter(Boolean))];
  const profileMap = await fetchProfileMapByIds(profileIds);
  const reportIds = [...new Set(messages.map(m => m.report_id).filter(Boolean))];
  const reportMap = {};
  if (reportIds.length) {
    const reports = await fetchAllReports();
    reports.forEach(r => { reportMap[r.id] = r; });
  }
  APP_STATE.threads = groupThreads(messages, profileMap, reportMap);

  const queryTo = getQueryParam('to');
  const queryReport = getQueryParam('report');
  if (!APP_STATE.activeThreadKey && queryTo) APP_STATE.activeThreadKey = `${queryTo}__${queryReport || 'general'}`;

  threadsMount.innerHTML = APP_STATE.threads.length ? APP_STATE.threads.map(t => `
    <button class="thread-item ${APP_STATE.activeThreadKey === t.key ? 'active' : ''}" data-thread-key="${t.key}">
      <div class="thread-title">${escapeHtml(t.otherName)}</div>
      <div class="thread-sub">${escapeHtml(t.reportName)}</div>
      <div class="thread-sub">${escapeHtml(t.lastMessage.message_text.slice(0, 60))}</div>
    </button>`).join('') : '<div class="p-5 text-sm text-slate-600">No messages yet.</div>';

  if (!APP_STATE.activeThreadKey && APP_STATE.threads[0]) APP_STATE.activeThreadKey = APP_STATE.threads[0].key;

  let active = APP_STATE.threads.find(t => t.key === APP_STATE.activeThreadKey);
  if (!active && queryTo) {
    active = { key: `${queryTo}__${queryReport || 'general'}`, otherId: queryTo, reportId: queryReport || null, messages: [], otherName: profileMap[queryTo]?.full_name || profileMap[queryTo]?.email || 'Recipient', reportName: reportMap[queryReport]?.itemName || 'Item Report' };
    APP_STATE.activeThreadKey = active.key;
  }

  if (!active) {
    header.innerHTML = '<h2 class="text-lg font-extrabold text-slate-900">Select a conversation</h2><p class="mt-1 text-sm text-slate-600">Messages about reports will appear here.</p>';
    listMount.innerHTML = '<div class="empty-state">No conversation selected yet.</div>';
    composer.classList.add('hidden');
  } else {
    await markActiveThreadRead(active);
    header.innerHTML = `<h2 class="text-lg font-extrabold text-slate-900">${escapeHtml(active.otherName)}</h2><p class="mt-1 text-sm text-slate-600">${escapeHtml(active.reportName || 'General Inquiry')}</p>`;
    listMount.innerHTML = active.messages.length ? active.messages.map(m => {
      const self = m.sender_id === authUser.id;
      return `<div class="message-bubble ${self ? 'self' : 'other'}"><div>${escapeHtml(m.message_text)}</div><div class="message-meta">${formatDateTime(m.created_at)}</div></div>`;
    }).join('') : '<div class="empty-state">No messages yet. Send the first message.</div>';
    listMount.scrollTop = listMount.scrollHeight;
    composer.classList.remove('hidden');
    $('#messageReceiverId').value = active.otherId || '';
    $('#messageReportId').value = active.reportId || '';
  }

  threadsMount.querySelectorAll('[data-thread-key]').forEach(btn => btn.addEventListener('click', () => {
    APP_STATE.activeThreadKey = btn.dataset.threadKey;
    renderMessagesPage();
  }));
  await updateMessageBadges();
}

function initMessagesComposer() {
  const form = $('#messageComposer');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const receiverId = $('#messageReceiverId')?.value;
    const reportId = $('#messageReportId')?.value || null;
    const messageText = ($('#messageText')?.value || '').trim();
    const authUser = await getAuthUser();
    if (!authUser || !receiverId || !messageText) return;
    const { error } = await sb.from('messages').insert({ sender_id: authUser.id, receiver_id: receiverId, report_id: reportId || null, message_text: messageText });
    if (error) { showError(error.message, { position: 'top-right' }); return; }
    $('#messageText').value = '';
    await createAuditLog('Message Sent', 'message', receiverId, messageText.slice(0, 60));
    await renderMessagesPage();
  });
}


function destroyChart(key) {
  if (APP_STATE.charts[key]) { APP_STATE.charts[key].destroy(); APP_STATE.charts[key] = null; }
}

async function renderAdminAnalyticsCharts() {
  const trendCanvas = document.getElementById('reportsTrendChart');
  const barCanvas = document.getElementById('statusBarChart');
  const pieCanvas = document.getElementById('claimsPieChart');
  if (!trendCanvas || !window.Chart) return;

  const reports = await fetchAllReports();
  const claims = await fetchAllClaims();

  const monthMap = {};
  reports.forEach(r => {
    const d = new Date(r.createdAt || r.date || Date.now());
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthMap[key] = (monthMap[key] || 0) + 1;
  });
  const monthKeys = Object.keys(monthMap).sort();
  const trendLabels = monthKeys.length ? monthKeys.map(k => { const [y,m]=k.split('-'); return new Date(Number(y), Number(m)-1).toLocaleString('en-US',{month:'short'}); }) : ['No Data'];
  const trendData = monthKeys.length ? monthKeys.map(k => monthMap[k]) : [0];

  const statusCounts = { Pending:0, Approved:0, Rejected:0, Claimed:0, Returned:0 };
  reports.forEach(r => { if (statusCounts[r.status] !== undefined) statusCounts[r.status]++; });
  const claimCounts = { Pending:0, Approved:0, Rejected:0 };
  claims.forEach(c => { if (claimCounts[c.status] !== undefined) claimCounts[c.status]++; });

  destroyChart('trend'); destroyChart('bar'); destroyChart('pie');
  APP_STATE.charts.trend = new Chart(trendCanvas, {
    type:'line',
    data:{ labels: trendLabels, datasets:[{ label:'Reports', data: trendData, fill:true, tension:.4, borderWidth:3, borderColor:'#7c3aed', backgroundColor:'rgba(125,211,252,.35)', pointRadius:3, pointBackgroundColor:'#7c3aed' }]},
    options:{ maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{ grid:{display:false}}, y:{ beginAtZero:true, ticks:{ precision:0 }}} }
  });
  APP_STATE.charts.bar = new Chart(barCanvas, {
    type:'bar',
    data:{ labels:Object.keys(statusCounts), datasets:[{ data:Object.values(statusCounts), backgroundColor:['#f59e0b','#10b981','#ef4444','#3b82f6','#64748b'], borderRadius:8 }]},
    options:{ maintainAspectRatio:false, plugins:{ legend:{display:false}}, scales:{ x:{ grid:{display:false}}, y:{ beginAtZero:true, ticks:{ precision:0 }}} }
  });
  APP_STATE.charts.pie = new Chart(pieCanvas, {
    type:'doughnut',
    data:{ labels:Object.keys(claimCounts), datasets:[{ data:Object.values(claimCounts), backgroundColor:['#22c55e','#8b5cf6','#ef4444'], borderWidth:0 }]},
    options:{ maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' }}, cutout:'58%' }
  });
}

/* ===================== UI HELPERS ===================== */
