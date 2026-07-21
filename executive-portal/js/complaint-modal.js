/* =========================================================
   CAMPUS CONNECT — COMPLAINT-MODAL.JS
   Unified detailed complaint modal integrated with database.
   ========================================================= */

const ComplaintModal = (() => {
  let currentComplaint = null;
  let onUpdateCallback = null;

  function buildShell() {
    let root = document.getElementById('detailModalRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'detailModalRoot';
      root.className = 'modal-overlay';
      document.body.appendChild(root);
    }
    
    root.innerHTML = `
      <div class="modal-wrapper">
        <div class="modal-header">
          <div class="modal-title">
            <h2 id="modalTicketHeader">Complaint Details</h2>
          </div>
          <button class="modal-close-btn" id="cmClose"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
          <aside class="modal-sidebar" id="modalSidebarLeft"></aside>
          <main class="modal-main">
            <nav class="modal-tabs">
              <button class="tab-btn active" data-tab="info"><i class="fa-solid fa-circle-info"></i> Info</button>
              <button class="tab-btn" data-tab="timeline"><i class="fa-solid fa-timeline"></i> Timeline</button>
              <button class="tab-btn" data-tab="decision"><i class="fa-solid fa-gavel"></i> Decision</button>
            </nav>
            <div class="tab-content">
              <div class="tab-panel active" id="tabInfo"></div>
              <div class="tab-panel" id="tabTimeline"></div>
              <div class="tab-panel" id="tabDecision"></div>
            </div>
          </main>
        </div>
      </div>
    `;
    return root;
  }

  function getStatusLabelAndCls(status) {
    // Backend status integers: 0 = Open/Pending, 1 = In Progress, 2 = Resolved, 4 = Closed
    if (status === 2) return { label: 'Resolved', cls: 'badge-resolved' };
    if (status === 1) return { label: 'In Progress', cls: 'badge-in-progress' };
    if (status === 4) return { label: 'Closed', cls: 'badge-closed' };
    return { label: 'Open', cls: 'badge-pending' };
  }

  function renderLeft(c) {
    const s = getStatusLabelAndCls(c.status);
    const dateStr = new Date(c.created_at).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    // Escalation Steps active representation
    const l1Active = c.escalation_level >= 1 ? 'active' : '';
    const l2Active = c.escalation_level >= 2 ? 'active' : '';
    const l3Active = c.escalation_level >= 3 ? 'active' : '';

    document.getElementById('modalSidebarLeft').innerHTML = `
      <div style="text-align:center; margin-bottom:24px;">
        <div style="font-size:24px; color:var(--primary); font-weight:800; margin-bottom:4px;" class="mono">${c.ticket_number || c.id.substring(0, 8).toUpperCase()}</div>
        <span class="badge ${s.cls}">${s.label}</span>
      </div>
      
      <div style="font-size:11px; font-weight:700; color:var(--ink-faint); margin-bottom:12px; text-transform:uppercase; letter-spacing:0.5px;">Escalation Level</div>
      <div class="escalation-seal" style="flex-direction:column; align-items:flex-start; gap:10px; margin-bottom:28px;">
        <div class="seal-step ${l1Active}"><div class="dot"></div>L1 Staff</div>
        <div class="seal-step ${l2Active}"><div class="dot"></div>L2 Dean</div>
        <div class="seal-step ${l3Active}"><div class="dot"></div>L3 Principal</div>
      </div>

      <div style="font-size:11px; font-weight:700; color:var(--ink-faint); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Overview</div>
      <div class="dl-row" style="margin-bottom:12px;"><div style="font-size:11px; color:var(--ink-faint);">CATEGORY</div><div style="font-size:13px; font-weight:600; color:var(--ink);">${c.category_name}</div></div>
      <div class="dl-row" style="margin-bottom:12px;"><div style="font-size:11px; color:var(--ink-faint);">SUBMITTED BY</div><div style="font-size:13px; font-weight:600; color:var(--ink);">${c.creator_name}</div></div>
      <div class="dl-row" style="margin-bottom:12px;"><div style="font-size:11px; color:var(--ink-faint);">ROLE</div><div style="font-size:13px; font-weight:600; color:var(--ink);">${c.creator_role}</div></div>
      <div class="dl-row" style="margin-bottom:12px;"><div style="font-size:11px; color:var(--ink-faint);">DATE FILED</div><div style="font-size:13px; font-weight:600; color:var(--ink);" class="mono">${dateStr}</div></div>
    `;
  }

  function renderInfo(c) {
    const s = getStatusLabelAndCls(c.status);
    const dateStr = new Date(c.created_at).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });

    const attachmentsHtml = c.has_photo && c.photo_url
      ? `<div style="position:relative; width:180px; border-radius:8px; overflow:hidden; border:1px solid var(--card-border); cursor:pointer;">
          <img src="${API.resolveImageUrl(c.photo_url)}" style="width:100%; height:120px; object-fit:cover;" alt="Ticket Photo" onclick="window.open('${API.resolveImageUrl(c.photo_url)}', '_blank')">
          <div style="padding:6px; font-size:11px; text-align:center; background:rgba(0,0,0,0.02);">Attachment Photo</div>
        </div>`
      : `<span style="color:var(--ink-faint); font-size:12.5px;">No attachments</span>`;

    document.getElementById('tabInfo').innerHTML = `
      <div class="info-box-grid">
        <div class="info-box"><div class="ib-label">COMPLAINT NUMBER</div><div class="ib-value">${c.ticket_number || 'N/A'}</div></div>
        <div class="info-box"><div class="ib-label">CATEGORY</div><div class="ib-value">${c.category_name}</div></div>
        <div class="info-box"><div class="ib-label">SUBMITTED BY</div><div class="ib-value">${c.creator_name}</div></div>
        <div class="info-box"><div class="ib-label">LOCATION</div><div class="ib-value">${c.location_name}</div></div>
        <div class="info-box"><div class="ib-label">DATE SUBMITTED</div><div class="ib-value">${dateStr}</div></div>
        <div class="info-box"><div class="ib-label">CURRENT STATUS</div><div class="ib-value"><span class="badge ${s.cls}">${s.label}</span></div></div>
      </div>
      <div class="form-group" style="margin-top:28px;">
        <label>Detailed Description</label>
        <p style="font-size:13.5px; color:var(--ink-soft); line-height:1.6; margin-top:8px; white-space:pre-line;">${c.description}</p>
      </div>
      <div class="form-group" style="margin-top:28px;">
        <label>Attachments</label>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">${attachmentsHtml}</div>
      </div>
    `;
  }

  function renderTimeline(c) {
    const markerHtml = `<div class="t-marker" style="display:flex; align-items:center; justify-content:center; color:#fff; font-size:10px; background:var(--primary); border:none;"><i class="fa-solid fa-check"></i></div>`;
    const boxStyle = `background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:16px; flex:1;`;
    const titleStyle = `font-weight:700; font-size:13px; color:var(--ink); margin-bottom:4px;`;
    const metaStyle = `font-size:11px; color:var(--ink-faint); margin-bottom:8px;`;
    const contentStyle = `font-size:13px; color:var(--ink-soft);`;

    const creationDateStr = new Date(c.created_at).toLocaleString('en-IN');
    let stepsHtml = `
      <div class="timeline-step">
        ${markerHtml}
        <div style="${boxStyle}">
          <div style="${titleStyle}">Complaint Registered</div>
          <div style="${metaStyle}">${c.creator_name} · ${creationDateStr}</div>
          <div style="${contentStyle}">Complaint registered successfully in the system.</div>
        </div>
      </div>
    `;

    if (c.ticket_updates && c.ticket_updates.length > 0) {
      stepsHtml += c.ticket_updates.map(u => {
        const dateStr = new Date(u.created_at).toLocaleString('en-IN');
        let updateTitle = 'Status Remark';
        if (u.update_type === 'resolution') updateTitle = 'Complaint Resolved';
        if (u.update_type === 'reopen') updateTitle = 'Complaint Reopened';

        return `
          <div class="timeline-step">
            ${markerHtml}
            <div style="${boxStyle}">
              <div style="${titleStyle}">${updateTitle}</div>
              <div style="${metaStyle}">${u.updated_by} · ${dateStr}</div>
              <div style="${contentStyle}">${u.message}</div>
            </div>
          </div>`;
      }).join('');
    } else {
      stepsHtml += `
        <div class="timeline-step">
          <div class="t-marker" style="background:#cbd5e1; border:none;"></div>
          <div style="${boxStyle} opacity: 0.7;">
            <div style="${titleStyle}">Pending Review</div>
            <div style="${metaStyle}">Administrative Assignee</div>
            <div style="${contentStyle}">Awaiting review by the escalated authority.</div>
          </div>
        </div>
      `;
    }

    document.getElementById('tabTimeline').innerHTML = stepsHtml;
  }

  function renderDecision(c) {
    const s = getStatusLabelAndCls(c.status);
    
    // Check what dropdown option to show
    let statusOptionVal = 'open';
    if (c.status === 1) statusOptionVal = 'in-progress';
    if (c.status === 2) statusOptionVal = 'resolved';
    if (c.status === 4) statusOptionVal = 'closed';

    // Set decision details
    const lastRemark = c.ticket_updates && c.ticket_updates.length > 0 
      ? c.ticket_updates[c.ticket_updates.length - 1] 
      : null;

    const lastRemarkText = lastRemark ? lastRemark.message : 'No remarks submitted yet';
    const reviewerName = lastRemark ? lastRemark.updated_by : 'Awaiting Review';
    const dateStr = lastRemark ? new Date(lastRemark.created_at).toLocaleString('en-IN') : 'N/A';

    const decisionHtml = `
      <div style="background:#F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="font-size: 10px; color: var(--ink-faint); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Last Decision Status</div>
        <div style="font-size: 13.5px; font-weight: 600; color: var(--ink); display:flex; align-items:center; gap:6px;">
          <span class="badge ${s.cls}" style="padding: 2px 8px; font-size: 11px;">${s.label}</span>
        </div>
      </div>
      <div style="background:#F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="font-size: 10px; color: var(--ink-faint); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Last Reviewer Remarks</div>
        <div style="font-size: 13px; color: var(--ink-soft); line-height: 1.5;">${lastRemarkText}</div>
      </div>
      <div style="background:#F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
        <div style="font-size: 10px; color: var(--ink-faint); text-transform: uppercase; font-weight: 700; margin-bottom: 4px;">Reviewed By & Date</div>
        <div style="font-size: 12.5px; color: var(--ink-soft); font-weight:500;">${reviewerName} · ${dateStr}</div>
      </div>
      <hr style="border:none; border-top:1px solid var(--card-border); margin: 24px 0;">
    `;

    document.getElementById('tabDecision').innerHTML = `
      ${decisionHtml}
      <div class="form-group">
        <label>Update Complaint Status</label>
        <select class="form-control" id="decisionStatus">
          <option value="open" ${statusOptionVal === 'open' ? 'selected' : ''}>Open (Pending)</option>
          <option value="in-progress" ${statusOptionVal === 'in-progress' ? 'selected' : ''}>In Progress</option>
          <option value="resolved" ${statusOptionVal === 'resolved' ? 'selected' : ''}>Resolved (Close Ticket)</option>
        </select>
      </div>
      <div class="form-group">
        <label>Action Remarks</label>
        <textarea class="form-control" id="decisionRemarks" rows="4" placeholder="Enter decision or resolution remarks for this complaint..."></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:20px;">
        <button class="btn btn-primary" id="submitDecisionBtn">
          <i class="fa-solid fa-circle-check"></i> Submit Decision
        </button>
      </div>
    `;

    document.getElementById('submitDecisionBtn').addEventListener('click', async () => {
      const status = document.getElementById('decisionStatus').value;
      const remarks = document.getElementById('decisionRemarks').value.trim();
      
      if (!remarks) {
        alert('Please enter action remarks before updating the status.');
        return;
      }

      const btn = document.getElementById('submitDecisionBtn');
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting...';
      btn.disabled = true;

      const result = await API.updateTicketStatus(c.id, status, remarks);
      
      btn.innerHTML = originalHtml;
      btn.disabled = false;

      if (result.success) {
        alert('Ticket status updated successfully in the database.');
        
        // Refresh ticket details from database
        const updatedTicket = await API.getTicketById(c.id);
        if (updatedTicket) {
          currentComplaint = updatedTicket;
          renderLeft(updatedTicket);
          renderInfo(updatedTicket);
          renderTimeline(updatedTicket);
          renderDecision(updatedTicket);
        }

        if (onUpdateCallback) onUpdateCallback();
      } else {
        alert('Failed to update ticket status: ' + result.message);
      }
    });
  }

  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panelId = 'tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1);
        document.getElementById(panelId).classList.add('active');
      });
    });
  }

  function open(complaint, onUpdate) {
    currentComplaint = complaint;
    onUpdateCallback = onUpdate || null;
    
    const root = buildShell();
    if (!root) return;

    renderLeft(complaint);
    renderInfo(complaint);
    renderTimeline(complaint);
    renderDecision(complaint);
    bindTabs();

    document.getElementById('cmClose').addEventListener('click', close);
    root.addEventListener('click', (e) => { if (e.target === root) close(); });
    root.classList.add('open');
  }

  function close() {
    const root = document.getElementById('detailModalRoot');
    if (root) root.classList.remove('open');
  }

  return { open, close };
})();
