
/* GCFind v2.60 HOTFIX ACTIONS - standalone final bridge */
(function(){
  if (window.__GCFIND_V260_HOTFIX__) return;
  window.__GCFIND_V260_HOTFIX__ = true;
  window.GCFIND_HOTFIX_VERSION = 'v2.60-hotfix-actions-loaded';
  console.log('[GCFind Hotfix] v2.60 loaded');

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = (v) => UUID.test(String(v || '').trim());
  const client = () => window.supabaseClient || window.sb || null;

  function localList(key){ try { return JSON.parse(localStorage.getItem(key)||'[]').map(String); } catch { return []; } }
  function addLocal(key,id){ if(!id) return; const x=localList(key); id=String(id); if(!x.includes(id)) x.push(id); localStorage.setItem(key, JSON.stringify(x)); }
  function toastOk(msg){ try{ showSuccess(msg,{position:'top-right'}); }catch{ console.log(msg); } }
  function toastErr(msg){ try{ showError(msg,{position:'top-right',duration:7000}); }catch{ alert(msg); } }
  async function ask(msg){ try{ if(typeof appConfirm==='function') return await appConfirm(msg); }catch{} return confirm(msg); }
  function removeCard(btn){
    const n = btn && btn.closest('article, tr, .gc-notification-card, .notification-card, .request-ticket-card, .ticket-card, .border-t, .p-4');
    if(n) n.remove();
  }
  async function softRefresh(){
    try{ if(typeof refreshGlobalNotifications==='function') await refreshGlobalNotifications(); }catch{}
    try{ if(location.pathname.includes('staff') && typeof renderStaffPanel==='function') await renderStaffPanel(); }catch{}
    try{ if(location.pathname.includes('system-admin') && typeof renderSystemAdmin==='function') await renderSystemAdmin(); }catch{}
    try{ if(location.pathname.includes('admin') && typeof renderAdminTicketNotifications==='function') await renderAdminTicketNotifications(); }catch{}
  }
  async function update(table,id,payload){
    const sb = client();
    if(!sb) throw new Error('Supabase client not loaded.');
    if(!isUuid(id)) return { synthetic:true };
    const { data, error } = await sb.from(table).update(payload).eq('id', id).select('*');
    if(error) throw error;
    return { data };
  }
  async function del(table,id){
    const sb = client();
    if(!sb) throw new Error('Supabase client not loaded.');
    if(!isUuid(id)) return { synthetic:true };
    const { error } = await sb.from(table).delete().eq('id', id);
    if(error) throw error;
    return { ok:true };
  }
  async function selectOne(table,id){
    const sb=client();
    if(!sb) throw new Error('Supabase client not loaded.');
    const { data, error } = await sb.from(table).select('*').eq('id', id).maybeSingle();
    if(error) throw error;
    return data;
  }

  async function notificationRead(id,btn){
    addLocal('gcfind_read_notifications', id);
    addLocal('gcfind_staff_read_alerts', id);
    try{ await update('notifications', id, {is_read:true}); }catch(e){ console.warn('[GCFind Hotfix] read fallback:', e.message); }
    btn.remove();
    const art = btn.closest('article');
    if(art){ art.classList.remove('bg-emerald-50/60'); art.classList.add('bg-white'); }
    toastOk('Marked as read.');
  }
  async function notificationDelete(id,btn){
    addLocal('gcfind_deleted_notifications', id);
    addLocal('gcfind_hidden_notifications', id);
    addLocal('gcfind_deleted_staff_notifications', id);
    addLocal('gcfind_staff_deleted_alerts', id);
    try{ if(typeof hideNotificationLocally==='function') hideNotificationLocally(id); }catch{}
    try{ if(typeof deleteStaffNotificationLocally==='function') deleteStaffNotificationLocally(id); }catch{}
    try{ await del('notifications', id); }catch(e){ console.warn('[GCFind Hotfix] notification delete fallback:', e.message); }
    removeCard(btn);
    toastOk('Notification deleted.');
  }
  async function claimUpdate(id,status,btn){
    if(!(await ask(`${status==='Approved'?'Approve':'Reject'} this claim request?`))) return;
    try{
      await update('claim_requests', id, {status, updated_at:new Date().toISOString()});
      removeCard(btn);
      toastOk(`Claim marked as ${status}.`);
      await softRefresh();
    }catch(e){ toastErr(e.message || 'Unable to update claim.'); }
  }
  async function ticketDelete(id,btn){
    if(!(await ask('Delete this request ticket?'))) return;
    addLocal('gcfind_deleted_request_tickets', id);
    addLocal('gcfind_hidden_request_tickets', id);
    try{ await del('request_tickets', id); }catch(e){ console.warn('[GCFind Hotfix] ticket delete fallback:', e.message); }
    removeCard(btn); toastOk('Request ticket deleted.'); await softRefresh();
  }
  async function reportUpdate(id,status,btn){
    if(status==='Delete') return reportDelete(id,btn);
    if(!(await ask(`Mark this report as ${status}?`))) return;
    try{ await update('item_reports', id, {status, updated_at:new Date().toISOString()}); toastOk(`Report marked as ${status}.`); await softRefresh(); }
    catch(e){ toastErr(e.message || 'Unable to update report.'); }
  }
  async function reportDelete(id,btn){
    if(!(await ask('Delete this submitted report?'))) return;
    try{ await del('item_reports', id); removeCard(btn); toastOk('Submitted report deleted.'); await softRefresh(); }
    catch(e){ toastErr(e.message || 'Unable to delete report.'); }
  }
  async function archiveDelete(id,btn){
    if(!(await ask('Permanently delete this archived record?'))) return;
    try{ await del('deleted_records_archive', id); removeCard(btn); toastOk('Archived record deleted.'); await softRefresh(); }
    catch(e){ toastErr(e.message || 'Unable to delete archived record.'); }
  }
  async function archiveRestore(id,btn){
    if(!(await ask('Restore this archived record?'))) return;
    try{
      const a = await selectOne('deleted_records_archive', id);
      if(!a) throw new Error('Archived record not found.');
      const table = a.table_name || a.source_table || 'item_reports';
      let record = a.record_data || a.data || a.deleted_data || a.payload;
      if(typeof record === 'string') record = JSON.parse(record);
      if(!record || typeof record !== 'object') throw new Error('No restorable record data found.');
      record = {...record};
      ['id','created_at','updated_at','deleted_at','restored_at','reporter_email','reporter_name'].forEach(k=>delete record[k]);
      if(!record.status) record.status='Pending';
      let ins = await client().from(table).insert(record);
      if(ins.error && /foreign key|user_id/i.test(ins.error.message||'')){
        delete record.user_id; delete record.reporter_id;
        ins = await client().from(table).insert(record);
      }
      if(ins.error) throw ins.error;
      await del('deleted_records_archive', id);
      removeCard(btn); toastOk('Archived record restored.'); await softRefresh();
    }catch(e){ toastErr(e.message || 'Unable to restore archived record.'); }
  }

  window.addEventListener('click', async function(e){
    const btn = e.target.closest && e.target.closest('button');
    if(!btn) return;

    const staffClaim = btn.dataset.staffClaim;
    const claimAction = btn.dataset.claimAction;
    const claimId = btn.dataset.claimId;
    const nRead = btn.dataset.notificationRead || btn.dataset.staffAlertRead;
    const nDel = btn.dataset.notificationDelete || btn.dataset.staffAlertDelete;
    const ticketId = btn.dataset.ticketDelete || btn.dataset.adminTicketDelete || btn.dataset.requestTicketDelete || btn.dataset.adminTicketUpdateDelete;
    const archiveRestoreId = btn.dataset.archiveRestore;
    const archiveDeleteId = btn.dataset.archiveDelete;
    const reportId = btn.dataset.reportId || btn.dataset.adminReportId || btn.dataset.itemReportId;
    const reportAction = btn.dataset.reportAction || btn.dataset.adminReport || btn.dataset.staffReport;

    let handled = true;
    try{
      if(nRead){ await notificationRead(nRead,btn); }
      else if(nDel){ if(await ask('Delete this notification?')) await notificationDelete(nDel,btn); }
      else if(staffClaim && claimId){ await claimUpdate(claimId, staffClaim==='approve'?'Approved':'Rejected', btn); }
      else if(claimAction && claimId){
        const a=String(claimAction).toLowerCase();
        if(a==='delete') { if(await ask('Delete this claim request?')) { await del('claim_requests', claimId); removeCard(btn); toastOk('Claim request deleted.'); } }
        else await claimUpdate(claimId, a==='approve'?'Approved':'Rejected', btn);
      }
      else if(ticketId){ await ticketDelete(ticketId,btn); }
      else if(archiveRestoreId){ await archiveRestore(archiveRestoreId,btn); }
      else if(archiveDeleteId){ await archiveDelete(archiveDeleteId,btn); }
      else if(reportId && reportAction){
        const map={approve:'Approved',reject:'Rejected',claimed:'Claimed',returned:'Returned',delete:'Delete'};
        await reportUpdate(reportId, map[String(reportAction).toLowerCase()] || reportAction, btn);
      }
      else if(btn.dataset.action==='delete' && btn.dataset.table && btn.dataset.id){
        if(btn.dataset.table==='notifications') await notificationDelete(btn.dataset.id,btn);
        else if(btn.dataset.table==='request_tickets') await ticketDelete(btn.dataset.id,btn);
        else if(btn.dataset.table==='item_reports') await reportDelete(btn.dataset.id,btn);
        else { if(await ask('Delete this item?')) { await del(btn.dataset.table, btn.dataset.id); removeCard(btn); toastOk('Deleted.'); } }
      }
      else handled = false;
    }catch(error){ toastErr(error.message || 'Action failed.'); }

    if(handled){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    }
  }, true);
})();
