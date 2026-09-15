/* ============ Turing Admin ============ */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
async function api(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || 'request failed'), { status: r.status, data: j });
  return j;
}
const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
let toastTimer = null;
function toast(msg, warn = false) {
  const t = $('#toast');
  t.innerHTML = `<span class="t-dot"></span><span>${esc(msg)}</span>`;
  t.classList.toggle('warn', warn);
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 400); }, 3200);
}
function timeShort(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function fullDate(iso) { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }

const state = { section: 'overview', support: null, selected: null, status: null, site: null };

/* ---------- login ---------- */
function showLogin() { $('#loginView').hidden = false; $('#appView').hidden = true; }
function showApp() { $('#loginView').hidden = true; $('#appView').hidden = false; }

$('#aLoginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#aLoginErr');
  err.hidden = true;
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await post('/api/admin/login', { username: $('#aUser').value, password: $('#aPass').value });
    toast('Welcome back');
    showApp();
    openSection('overview');
  } catch (ex) {
    err.textContent = ex.data?.message || 'Login failed.';
    err.hidden = false;
  } finally { btn.disabled = false; }
});
$('#logoutBtn').addEventListener('click', async () => {
  try { await post('/api/auth/logout'); } catch {}
  showLogin();
  $('#aPass').value = '';
});

/* ---------- nav ---------- */
$('#aNav').addEventListener('click', e => {
  const b = e.target.closest('button[data-sec]');
  if (!b) return;
  openSection(b.dataset.sec);
});
function openSection(sec) {
  state.section = sec;
  $$('#aNav button').forEach(b => b.classList.toggle('active', b.dataset.sec === sec));
  ({ overview: renderOverview, support: renderSupport, status: renderStatus, site: renderSite })[sec]();
}

/* ---------- overview ---------- */
async function renderOverview() {
  const main = $('#aMain');
  main.innerHTML = `<div class="sec" style="opacity:0"><div class="a-head"><h1>Loading…</h1></div></div>`;
  let d;
  try { d = await api('/api/admin/overview'); } catch { return; }
  state.site = d.site;
  const c = d.counts;
  const worst = d.status.services.some(s => s.status === 'outage') ? 'bad' : d.status.services.some(s => s.status === 'degraded') ? 'warn' : 'ok';
  const worstTxt = worst === 'ok' ? 'All operational' : worst === 'warn' ? 'Degraded' : 'Outage';
  main.innerHTML = `
  <div class="sec">
    <div class="a-head"><div><h1>Overview</h1><div class="a-sub">Everything at a glance. ${fullDate(d.status.updated)}.</div></div>
      <div class="a-actions"><button class="btn btn-ghost btn-sm" data-goto="support">Open support</button><button class="btn btn-ghost btn-sm" data-goto="site">Site controls</button></div>
    </div>
    <div class="stat-grid">
      <div class="stat" style="--i:0"><div class="s-n">${c.supportOpen}<span class="s-suf"> / ${c.supportTotal}</span></div><div class="s-l">Open support messages</div></div>
      <div class="stat" style="--i:1"><div class="s-n">${c.supportUnread}</div><div class="s-l">Unread</div></div>
      <div class="stat" style="--i:2"><div class="s-n">${c.users}</div><div class="s-l">Registered users</div></div>
      <div class="stat" style="--i:3"><div class="s-n"><span class="s-dot" style="background:${worst === 'ok' ? 'var(--green)' : worst === 'warn' ? 'var(--amber)' : 'var(--red)'}"></span>${worstTxt}</div><div class="s-l">Service status · ${c.services} services</div></div>
    </div>
    <div class="ov-grid">
      <div class="card">
        <h3>Site state</h3>
        <div class="site-pills">
          <div class="pill"><span class="p-l">Maintenance mode</span><span class="p-v ${d.site.maintenance ? 'on' : 'off'}">${d.site.maintenance ? 'ON — site offline' : 'off'}</span></div>
          <div class="pill"><span class="p-l">Logins</span><span class="p-v ${d.site.blockLogins ? 'on' : 'live'}">${d.site.blockLogins ? 'blocked' : 'open'}</span></div>
          <div class="pill"><span class="p-l">Registrations</span><span class="p-v ${d.site.blockRegistrations ? 'on' : 'live'}">${d.site.blockRegistrations ? 'blocked' : 'open'}</span></div>
          <div class="pill"><span class="p-l">Announcement</span><span class="p-v ${d.site.announcement.enabled ? 'live' : 'off'}">${d.site.announcement.enabled ? 'published' : 'none'}</span></div>
        </div>
      </div>
      <div class="card">
        <h3>Recent support</h3>
        ${d.recentSupport.length ? d.recentSupport.map(m => `
          <a class="pill" style="cursor:pointer;margin-bottom:10px" data-sup="${m.id}">
            <span class="p-l">${m.read ? '' : '<b style="color:var(--white)">●</b> '}${esc(m.name)} <span style="color:var(--text-3)">· ${esc(m.topic)}</span></span>
            <span class="p-v off" style="margin-left:auto">${timeShort(m.created)}</span>
          </a>`).join('') : '<div class="p-l" style="color:var(--text-3);font-size:13px">No messages yet. It is quiet in here.</div>'}
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <h3>Activity</h3>
      <ul class="feed">
        ${d.recentActivity.map(a => `<li><span class="f-t">${timeShort(a.at)}</span><span>${esc(a.text)}</span></li>`).join('') || '<li>No activity yet.</li>'}
      </ul>
    </div>
  </div>`;
  main.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openSection(b.dataset.goto)));
  main.querySelectorAll('[data-sup]').forEach(b => b.addEventListener('click', async () => {
    state.selected = b.dataset.sup;
    openSection('support');
  }));
  refreshBadge();
}
async function refreshBadge() {
  try {
    const d = await api('/api/admin/overview');
    const b = $('#supBadge');
    if (d.counts.supportUnread > 0) { b.hidden = false; b.textContent = d.counts.supportUnread; }
    else b.hidden = true;
  } catch {}
}

/* ---------- support ---------- */
async function renderSupport() {
  const main = $('#aMain');
  main.innerHTML = `<div class="sec" style="opacity:0"><div class="a-head"><h1>Loading…</h1></div></div>`;
  try { state.support = (await api('/api/admin/support')).messages; } catch { return; }
  if (!state.selected || !state.support.find(m => m.id === state.selected)) state.selected = state.support[0]?.id || null;
  const list = state.support.map(m => {
    const hasActivity = (m.replies?.length || 0) > 0;
    return `
    <button class="sup-item ${m.id === state.selected ? 'sel' : ''} ${m.read ? '' : 'unread'}" data-id="${m.id}">
      ${m.resolved ? '<span class="si-res">RESOLVED</span>' : ''}
      ${!m.read && hasActivity ? '<span class="si-new">NEW</span>' : ''}
      <div class="si-top"><span class="si-name">${esc(m.name)}</span><span class="si-topic">${esc(m.topic)}</span></div>
      <div class="si-msg">${esc(m.message)}</div>
      <div class="si-date">${fullDate(m.created)}</div>
    </button>`;
  }).join('');
  const m = state.support.find(x => x.id === state.selected);
  const conv = m ? [
    { kind: 'user', at: m.created, text: m.message },
    ...(m.replies || []).map(r => ({ kind: 'admin', at: r.at, text: r.message })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at)) : [];
  const detail = m ? `
    <div class="sd-head">
      <div><div class="sd-name">${esc(m.name)}</div><div class="sd-mail">${esc(m.email)} · ${esc(m.topic)} · ${fullDate(m.created)}</div></div>
      <div class="sd-actions">
        <button class="btn btn-ghost btn-sm" data-act="${m.read ? 'unread' : 'read'}">${m.read ? 'Mark unread' : 'Mark read'}</button>
        <button class="btn ${m.resolved ? 'btn-ghost' : 'btn-primary'} btn-sm" data-act="${m.resolved ? 'reopen' : 'resolve'}">${m.resolved ? 'Reopen' : 'Resolve'}</button>
      </div>
    </div>
    <div class="sd-body">
      ${conv.map(c => `<div class="msg ${c.kind === 'admin' ? 'admin' : 'user'}"><div class="m-meta">${c.kind === 'admin' ? 'YOU' : 'USER'} · ${fullDate(c.at)}</div>${esc(c.text)}</div>`).join('')}
    </div>
    <div class="sd-reply">
      <div class="field"><textarea id="replyText" placeholder="Write a reply — it will be saved here and emailed to ${esc(m.email)} (when Resend is configured)."></textarea></div>
      <button class="btn btn-primary btn-sm" id="replyBtn" style="align-self:flex-start">Send reply <span style="opacity:.6">→</span></button>
    </div>` : `<div class="empty-state" style="min-height:420px"><span class="e-ic">✉</span><div>No message selected.</div></div>`;

  main.innerHTML = `
  <div class="sec">
    <div class="a-head"><div><h1>Support</h1><div class="a-sub">${state.support.length} message${state.support.length === 1 ? '' : 's'} · everything sent from the support page.</div></div></div>
    <div class="sup-grid">
      <div class="sup-list">${list || '<div class="empty-state"><span class="e-ic">✉</span><div>Nothing here yet.</div></div>'}</div>
      <div class="sup-detail">${detail}</div>
    </div>
  </div>`;

  $$('.sup-item', main).forEach(b => b.addEventListener('click', async () => {
    state.selected = b.dataset.id;
    const msg = state.support.find(x => x.id === state.selected);
    if (msg && !msg.read) { try { await post(`/api/admin/support/${msg.id}`, { action: 'read' }); msg.read = true; } catch {} }
    renderSupport();
  }));
  const act = main.querySelector('.sd-actions');
  act?.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    try { await post(`/api/admin/support/${m.id}`, { action: b.dataset.act }); toast(b.dataset.act === 'resolve' ? 'Resolved' : b.dataset.act === 'reopen' ? 'Reopened' : b.dataset.act === 'read' ? 'Marked read' : 'Marked unread'); } catch {}
    renderSupport();
  });
  $('#replyBtn')?.addEventListener('click', async () => {
    const text = $('#replyText').value.trim();
    if (!text) { toast('Write something first', true); return; }
    const btn = $('#replyBtn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner" style="border-color:rgba(10,10,10,.3);border-top-color:#0A0A0A"></span> Sending…';
    try {
      await post(`/api/admin/support/${m.id}`, { message: text });
      toast('Reply sent');
      renderSupport();
      refreshBadge();
    } catch (ex) {
      btn.disabled = false; btn.innerHTML = 'Send reply';
      toast(ex.message || 'Failed', true);
    }
  });
}

/* ---------- status ---------- */
const STATUSES = ['ok', 'degraded', 'outage'];
const STAT_LABEL = { ok: 'Operational', degraded: 'Degraded', outage: 'Outage' };
async function renderStatus() {
  const main = $('#aMain');
  main.innerHTML = `<div class="sec" style="opacity:0"><div class="a-head"><h1>Loading…</h1></div></div>`;
  try { state.status = (await api('/api/admin/status')).status; } catch { return; }
  const svc = state.status.services;
  main.innerHTML = `
  <div class="sec">
    <div class="a-head"><div><h1>Status</h1><div class="a-sub">90-day history, fully editable. Changes are live on the public status page instantly.</div></div></div>
    <div class="bulk-bar">
      <span class="b-label">Bulk history</span>
      <select id="bulkStatus">${STATUSES.map(s => `<option value="${s}">${STAT_LABEL[s]}</option>`).join('')}</select>
      <select id="bulkDays"><option value="1">Last 1 day</option><option value="3">Last 3 days</option><option value="7" selected>Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="90">All 90 days</option></select>
      <button class="btn btn-ghost btn-sm" id="bulkApply">Apply to all services</button>
      <span style="margin-left:auto;font-size:12px;color:var(--text-3)">Updated ${timeShort(state.status.updated)}</span>
    </div>
    <div class="svc-admin">
      ${svc.map((s, i) => svcRow(s, i)).join('')}
    </div>
    <div class="add-svc card" style="margin-top:16px">
      <input id="newSvcName" placeholder="New service name (e.g. "Search")">
      <button class="btn btn-ghost btn-sm" id="addSvcBtn">Add service</button>
    </div>
  </div>`;

  // bulk
  $('#bulkApply').addEventListener('click', async e => {
    e.target.disabled = true;
    try {
      await post('/api/admin/status', { op: 'bulkHistory', status: $('#bulkStatus').value, days: +$('#bulkDays').value });
      toast('History updated');
    } catch { toast('Failed', true); }
    renderStatus();
  });
  // add
  $('#addSvcBtn').addEventListener('click', async e => {
    const name = $('#newSvcName').value.trim();
    if (!name) { toast('Give it a name first', true); return; }
    try { await post('/api/admin/status', { op: 'addService', name, description: 'New service' }); toast('Service added'); } catch {}
    renderStatus();
  });

  $$('.svc-row', main).forEach(row => {
    const id = row.dataset.id;
    const svcOne = svc.find(x => x.id === id);
    // segmented control
    row.querySelector('.seg').addEventListener('click', async e => {
      const b = e.target.closest('button[data-st]');
      if (!b) return;
      try { await post('/api/admin/status', { op: 'updateService', id, status: b.dataset.st }); toast(`${svcOne.name}: ${STAT_LABEL[b.dataset.st]}`); } catch {}
      renderStatus();
    });
    // name / desc
    row.querySelector('[name=name]').addEventListener('change', async e => {
      if (e.target.value.trim() && e.target.value.trim() !== svcOne.name) {
        try { await post('/api/admin/status', { op: 'updateService', id, name: e.target.value }); toast('Renamed'); } catch {}
        renderStatus();
      }
    });
    row.querySelector('.svr-desc').addEventListener('change', async e => {
      try { await post('/api/admin/status', { op: 'updateService', id, description: e.target.value }); toast('Description saved'); } catch {}
    });
    // day cells: click cycles ok -> degraded -> outage
    $$('.day', row).forEach(cell => cell.addEventListener('click', async () => {
      const cur = cell.dataset.v;
      const next = STATUSES[(STATUSES.indexOf(cur) + 1) % STATUSES.length];
      cell.dataset.v = next;
      cell.className = 'day ' + (next === 'degraded' ? 'd' : next === 'outage' ? 'o' : '') + (cell.classList.contains('today') ? ' today' : '');
      try { await post('/api/admin/status', { op: 'setDay', id, index: +cell.dataset.i, value: next }); } catch { renderStatus(); }
    }));
    // reset to all ok
    row.querySelector('[data-reset]').addEventListener('click', async e => {
      e.target.disabled = true;
      try { await post('/api/admin/status', { op: 'setHistory', id, history: Array(90).fill('ok') }); toast(`${svcOne.name}: 90 days clean`); } catch {}
      renderStatus();
    });
    // delete
    row.querySelector('[data-del]').addEventListener('click', async () => {
      if (!confirm(`Remove "${svcOne.name}" from the status page?`)) return;
      try { await post('/api/admin/status', { op: 'deleteService', id }); toast('Service removed'); } catch {}
      renderStatus();
    });
  });
}
function svcRow(s, i) {
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const ninetyAgo = new Date(Date.now() - 89 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `
  <div class="svc-row" style="--i:${i}" data-id="${s.id}">
    <div class="svr-top">
      <input name="name" value="${esc(s.name)}" maxlength="60">
      <div class="seg">
        ${STATUSES.map(st => `<button data-st="${st}" class="${s.status === st ? (st === 'ok' ? 'on-ok' : st === 'degraded' ? 'on-deg' : 'on-out') : ''}">${STAT_LABEL[st]}</button>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm svr-del" data-reset>90 days → clean</button>
      <button class="btn btn-danger btn-sm" data-del>Remove</button>
    </div>
    <input class="svr-desc" value="${esc(s.description)}" maxlength="120" placeholder="Description">
    <div class="day-grid">
      ${s.history.map((v, di) => `<button class="day ${v === 'degraded' ? 'd' : v === 'outage' ? 'o' : ''} ${di === 89 ? 'today' : ''}" data-i="${di}" data-v="${v}" title="${today && di === 89 ? 'Today' : new Date(Date.now() - (89 - di) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${STAT_LABEL[v]} — click to change"></button>`).join('')}
    </div>
    <div class="day-scale"><span>${ninetyAgo}</span><span>Today</span></div>
  </div>`;
}

/* ---------- site ---------- */
async function renderSite() {
  const main = $('#aMain');
  main.innerHTML = `<div class="sec" style="opacity:0"><div class="a-head"><h1>Loading…</h1></div></div>`;
  let d;
  try { d = await api('/api/admin/site'); } catch { return; }
  state.site = d.site;
  const s = d.site;
  main.innerHTML = `
  <div class="sec">
    <div class="a-head"><div><h1>Site controls</h1><div class="a-sub">Kills switches and broadcasts. Every change is logged and live immediately.</div></div></div>
    <div class="tog-grid">
      <div class="tog-card ${s.maintenance ? 'armed' : ''}" style="--i:0">
        <h4>Maintenance mode</h4>
        <p>Shows a full-screen maintenance view to everyone. The site goes quiet — your conversations stay safe.</p>
        <button class="switch danger ${s.maintenance ? 'on' : ''}" data-tog="maintenance"></button>
      </div>
      <div class="tog-card ${s.blockLogins ? 'armed' : ''}" style="--i:1">
        <h4>Block logins</h4>
        <p>The sign-in page shows a notice and stops accepting credentials. Existing sessions keep working.</p>
        <button class="switch danger ${s.blockLogins ? 'on' : ''}" data-tog="blockLogins"></button>
      </div>
      <div class="tog-card ${s.blockRegistrations ? 'armed' : ''}" style="--i:2">
        <h4>Block registrations</h4>
        <p>New sign-ups are paused with a notice on the register page. Existing accounts are unaffected.</p>
        <button class="switch danger ${s.blockRegistrations ? 'on' : ''}" data-tog="blockRegistrations"></button>
      </div>
    </div>
    <div class="ann-card">
      <div class="row-2">
        <div class="field" style="margin:0;flex:1"><label>Announcement</label><input id="annText" value="${esc(s.announcement.text)}" maxlength="160" placeholder="A short line shown at the top of every page…"></div>
        <button class="switch danger ${s.announcement.enabled ? 'on' : ''}" data-tog="announcement" title="Publish / remove announcement"></button>
      </div>
      <div class="ann-preview">${s.announcement.enabled && s.announcement.text ? `<span class="dot"></span><span>${esc(s.announcement.text)}</span>` : '<span class="ph">Preview — the announcement bar will look like this when published.</span>'}</div>
    </div>
    <div class="card">
      <h3>Activity log</h3>
      <ul class="feed">
        ${d.activity.map(a => `<li><span class="f-t">${timeShort(a.at)}</span><span>${esc(a.text)}</span></li>`).join('') || '<li>No activity yet.</li>'}
      </ul>
    </div>
  </div>`;

  $$('.switch', main).forEach(sw => sw.addEventListener('click', async () => {
    const key = sw.dataset.tog;
    sw.disabled = true;
    let body;
    if (key === 'announcement') {
      body = { announcement: { enabled: !s.announcement.enabled, text: $('#annText').value.trim() } };
    } else {
      body = { [key]: !s[key] };
    }
    try {
      const r = await post('/api/admin/site', body);
      state.site = r.site;
      toast(key === 'maintenance' ? (body.maintenance ? 'Maintenance ON — site is offline' : 'Maintenance OFF — site is live')
        : key === 'announcement' ? (body.announcement.enabled ? 'Announcement published' : 'Announcement removed')
        : key === 'blockLogins' ? (body.blockLogins ? 'Logins blocked' : 'Logins open')
        : (body.blockRegistrations ? 'Registrations blocked' : 'Registrations open'),
        key === 'announcement' ? false : true);
    } catch { toast('Failed', true); }
    renderSite();
  }));
}

/* ---------- boot ---------- */
(async function boot() {
  try {
    await api('/api/admin/overview');
    showApp();
    openSection('overview');
  } catch {
    showLogin();
  }
})();
