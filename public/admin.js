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
  ({ overview: renderOverview, support: renderSupport, users: renderUsers, status: renderStatus, ai: renderAI, site: renderSite })[sec]();
}

/* ---------- AI (Groq) ---------- */
const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile — best all-round' },
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B — strong reasoning' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B — fast & light' },
  { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B — large MoE' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B — efficient MoE' },
  { id: 'qwen/qwen3-32b', label: 'Qwen3 32B' },
  { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 Instruct' },
  { id: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill 70B — deep reasoning' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant — cheapest / fastest' },
];

async function renderAI() {
  const main = $('#aMain');
  main.innerHTML = `<div class="sec" style="opacity:0"><div class="a-head"><h1>Loading…</h1></div></div>`;
  let ai;
  try { ai = (await api('/api/admin/ai')).ai; } catch { return; }
  const known = GROQ_MODELS.some(m => m.id === ai.model);
  const options = GROQ_MODELS.map(m =>
    `<option value="${esc(m.id)}" ${m.id === ai.model ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
  main.innerHTML = `
  <div class="sec">
    <div class="a-head"><div><h1>AI</h1><div class="a-sub">The model behind <b style="color:var(--text)">/ia.html</b>. Groq API key, model and usage limits.</div></div>
      <span class="ai-status ${ai.hasKey ? 'ok' : 'warn'}">${ai.hasKey ? '<span class="dot"></span>Configured' : '<span class="dot"></span>Needs an API key'}</span>
    </div>

    <div class="ai-grid">
      <div class="card">
        <h3>Model</h3>
        <div class="field" style="margin:0 0 12px"><label for="aiModel">Groq model</label>
          <select id="aiModel">
            ${options}
            <option value="__custom" ${known ? '' : 'selected'}>Custom / other model id…</option>
          </select>
        </div>
        <div class="field" id="aiCustomWrap" style="margin:0;${known ? 'display:none' : ''}"><label for="aiCustom">Custom model id</label>
          <input id="aiCustom" value="${known ? '' : esc(ai.model)}" placeholder="e.g. mistral-saba-24b"></div>
        <p class="ai-hint">Any Groq chat-completions model id works. The list covers the current catalog.</p>
      </div>

      <div class="card">
        <h3>Usage limit <span class="ai-tag">not shown on the chat page</span></h3>
        <div class="row-2">
          <div class="field" style="margin:0"><label for="aiLimMsgs">Messages per window</label>
            <input id="aiLimMsgs" type="number" min="1" max="500" value="${ai.limitMessages}"></div>
          <div class="field" style="margin:0"><label for="aiLimHours">Window (hours)</label>
            <input id="aiLimHours" type="number" min="1" max="72" value="${ai.limitWindowHours}"></div>
        </div>
        <p class="ai-hint">Rolling window per user. Default is <b style="color:var(--text)">15 messages every 6 hours</b>. Users only see a gentle "try again later" — never the numbers.</p>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>Groq API key</h3>
      <div class="ai-key-row">
        <div class="pw-wrap" style="flex:1"><input id="aiKey" type="password" autocomplete="new-password" placeholder="${ai.hasKey ? 'Saved key: ' + esc(ai.keyMasked) + ' — paste a new one to replace' : 'gsk_…'}"><button type="button" class="pw-toggle" data-target="aiKey">Show</button></div>
        <button class="btn btn-ghost btn-sm" id="aiClearKey" ${ai.hasKey ? '' : 'disabled'}>Remove key</button>
      </div>
      <p class="ai-hint">Create a free key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener" style="color:var(--text);text-decoration:underline">console.groq.com/keys</a>. It is stored on the server and never sent to the browser.</p>
      <div class="ai-actions">
        <button class="btn btn-primary btn-sm" id="aiSave">Save configuration <span style="opacity:.6">→</span></button>
        <button class="btn btn-ghost btn-sm" id="aiTest">Test connection</button>
        <span class="ai-test-result" id="aiTestResult"></span>
      </div>
    </div>

    <div class="card" style="margin-top:14px">
      <h3>System prompt <span class="ai-tag">optional</span></h3>
      <div class="field" style="margin:0"><textarea id="aiSys" style="min-height:90px" maxlength="1200" placeholder="Leave empty to use Turing's default personality…">${esc(ai.systemPrompt || '')}</textarea></div>
      <p class="ai-hint">Overrides the built-in assistant personality for every conversation.</p>
    </div>
  </div>`;

  const modelSel = $('#aiModel');
  modelSel.addEventListener('change', () => {
    $('#aiCustomWrap').style.display = modelSel.value === '__custom' ? '' : 'none';
  });
  bindPwTogglesAI();

  function currentModel() {
    return modelSel.value === '__custom' ? $('#aiCustom').value.trim() : modelSel.value;
  }
  $('#aiSave').addEventListener('click', async () => {
    const model = currentModel();
    if (!model) { toast('Choose or type a model id', true); return; }
    const key = $('#aiKey').value.trim();
    const body = {
      model,
      limitMessages: parseInt($('#aiLimMsgs').value, 10) || 15,
      limitWindowHours: parseInt($('#aiLimHours').value, 10) || 6,
      systemPrompt: $('#aiSys').value,
    };
    if (key) body.apiKey = key;
    try {
      await post('/api/admin/ai', body);
      toast('AI configuration saved');
      renderAI();
    } catch { toast('Failed to save', true); }
  });
  $('#aiClearKey').addEventListener('click', async () => {
    try {
      await post('/api/admin/ai', { apiKey: '' });
      toast('API key removed');
      renderAI();
    } catch { toast('Failed', true); }
  });
  $('#aiTest').addEventListener('click', async e => {
    const btn = e.currentTarget;
    const res = $('#aiTestResult');
    const model = currentModel();
    if (model && model !== ai.model) await post('/api/admin/ai', { model }).catch(() => {});
    btn.disabled = true;
    res.className = 'ai-test-result';
    res.textContent = 'Testing…';
    try {
      const r = await post('/api/admin/ai-test', {});
      res.className = 'ai-test-result ' + (r.ok ? 'ok' : 'bad');
      res.textContent = r.ok ? '✓ ' + r.detail : '✗ ' + r.detail;
    } catch {
      res.className = 'ai-test-result bad';
      res.textContent = '✗ Request failed';
    } finally { btn.disabled = false; }
  });
}
function bindPwTogglesAI() {
  $$('.pw-toggle').forEach(b => b.addEventListener('click', () => {
    const inp = $('#' + b.dataset.target);
    if (!inp) return;
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.textContent = show ? 'Hide' : 'Show';
  }));
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
const TOPIC_CLASS = { 'General': 't-gen', 'Bug report': 't-bug', 'Feature request': 't-feat', 'API access': 't-api', 'Billing': 't-bill', 'Other': 't-gen' };
async function renderSupport() {
  const main = $('#aMain');
  main.innerHTML = `<div class="sec" style="opacity:0"><div class="a-head"><h1>Loading…</h1></div></div>`;
  try { state.support = (await api('/api/admin/support')).messages; } catch { return; }
  if (!state.selected || !state.support.find(m => m.id === state.selected)) state.selected = state.support[0]?.id || null;
  const list = state.support.map(m => {
    const nReplies = (m.replies?.length || 0);
    return `
    <button class="sup-item ${m.id === state.selected ? 'sel' : ''} ${m.read ? '' : 'unread'}" data-id="${m.id}">
      <div class="si-top">
        ${!m.read ? '<span class="si-dot" title="Unread"></span>' : ''}
        <span class="si-name">${esc(m.name)}</span>
        <span class="si-topic ${TOPIC_CLASS[m.topic] || 't-gen'}">${esc(m.topic)}</span>
        ${m.resolved ? '<span class="si-res">RESOLVED</span>' : ''}
      </div>
      <div class="si-msg">${esc(m.message)}</div>
      <div class="si-date">${fullDate(m.created)}${nReplies ? ` · ${nReplies} repl${nReplies === 1 ? 'y' : 'ies'}` : ''}</div>
    </button>`;
  }).join('');
  const m = state.support.find(x => x.id === state.selected);
  const conv = m ? [
    { kind: 'user', at: m.created, text: m.message },
    ...(m.replies || []).map(r => ({ kind: 'admin', at: r.at, text: r.message })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at)) : [];
  const detail = m ? `
    <div class="sd-head">
      <span class="sd-avatar">${esc(m.name.trim().charAt(0).toUpperCase() || '?')}</span>
      <div class="sd-id">
        <div class="sd-name">${esc(m.name)}</div>
        <div class="sd-mail"><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></div>
      </div>
      <span class="si-topic ${TOPIC_CLASS[m.topic] || 't-gen'}">${esc(m.topic)}</span>
      <span class="sd-date">${fullDate(m.created)}</span>
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

/* ---------- users ---------- */
const PLANS = ['free', 'maker', 'expert', 'core', 'enterprise'];

async function renderUsers() {
  const main = $('#aMain');
  main.innerHTML = `<div class="sec" style="opacity:0"><div class="a-head"><h1>Loading…</h1></div></div>`;
  let d;
  try { d = await api('/api/admin/users'); } catch { return; }
  state.users = d.users;
  state.globalLimit = d.globalLimit;
  state.globalWindow = d.globalWindowHours;
  main.innerHTML = `
  <div class="sec">
    <div class="a-head"><div><h1>Users</h1><div class="a-sub">${d.users.length} registered · global limit <b style="color:var(--text)">${d.globalLimit} messages / ${d.globalWindowHours}h</b> (overridable per user below).</div></div></div>
    ${d.users.length
      ? `<div class="usr-list">${d.users.map((u, i) => usrCard(u, i)).join('')}</div>`
      : '<div class="empty-state" style="min-height:300px"><span class="e-ic">◔</span><div>No users registered yet.</div></div>'}
  </div>`;

  $$('.usr-card', main).forEach(card => {
    const id = card.dataset.uid;
    const u = state.users.find(x => x.id === id);
    card.querySelector('[data-uact="saveinfo"]').addEventListener('click', async () => {
      const name = card.querySelector('.usr-name').value.trim();
      const email = card.querySelector('.usr-email').value.trim();
      if (name === u.name && email === u.email) return;
      try { await post(`/api/admin/users/${id}`, { op: 'info', name, email }); toast('User info updated'); }
      catch (ex) { toast(ex.data?.message || 'Failed to update', true); }
      renderUsers();
    });
    card.querySelector('.usr-plan').addEventListener('change', async e => {
      try { await post(`/api/admin/users/${id}`, { op: 'plan', plan: e.target.value }); toast(`Plan → ${e.target.value}`); }
      catch { toast('Failed', true); }
      renderUsers();
    });
    card.querySelector('[data-uact="savelimit"]').addEventListener('click', async () => {
      const raw = card.querySelector('.usr-limit').value.trim();
      try {
        await post(`/api/admin/users/${id}`, { op: 'limit', limitMessages: raw === '' ? null : parseInt(raw, 10) });
        toast(raw === '' ? 'Limit cleared — global applies' : `Limit set to ${raw}`);
      } catch (ex) { toast(ex.data?.message || 'Failed', true); }
      renderUsers();
    });
    card.querySelector('[data-uact="resetusage"]').addEventListener('click', async () => {
      try { await post(`/api/admin/users/${id}`, { op: 'resetUsage' }); toast('Usage counter reset'); } catch { toast('Failed', true); }
      renderUsers();
    });
    card.querySelector('[data-uact="ban"]').addEventListener('click', async () => {
      try { await post(`/api/admin/users/${id}`, { op: 'ban', banned: !u.banned }); toast(u.banned ? 'User unbanned' : 'User banned — access revoked', true); }
      catch { toast('Failed', true); }
      renderUsers();
    });
    card.querySelector('[data-uact="delete"]').addEventListener('click', async () => {
      if (!confirm(`Delete "${u.name}" permanently? Their chats and usage will be erased.`)) return;
      try { await post(`/api/admin/users/${id}`, { op: 'delete' }); toast('User deleted'); } catch { toast('Failed', true); }
      renderUsers();
    });
  });
}
function usrCard(u, i) {
  const initial = (u.name || '?').trim().charAt(0).toUpperCase() || '?';
  return `
  <div class="usr-card ${u.banned ? 'banned' : ''}" data-uid="${u.id}" style="--i:${i}">
    <div class="usr-top">
      <span class="usr-avatar">${esc(initial)}</span>
      <div class="usr-idwrap">
        <div class="usr-idrow">
          <input class="usr-name" value="${esc(u.name)}" maxlength="60">
          <span class="usr-plan-badge p-${u.plan}">${esc(u.plan.toUpperCase())}</span>
          ${u.banned ? '<span class="usr-flag">BANNED</span>' : ''}
        </div>
        <input class="usr-email" value="${esc(u.email)}" maxlength="120">
      </div>
      <button class="btn btn-ghost btn-sm" data-uact="saveinfo">Save info</button>
    </div>
    <div class="usr-meta">
      Joined ${fullDate(u.created)} · Last login ${u.lastLogin ? fullDate(u.lastLogin) : 'never'} · ${u.chats} chat${u.chats === 1 ? '' : 's'} · <b>${u.usage.used}/${u.usage.limit}</b> messages in current window
    </div>
    <div class="usr-controls">
      <div class="uc-field"><label>Plan</label>
        <select class="usr-plan">${PLANS.map(pl => `<option value="${pl}" ${pl === u.plan ? 'selected' : ''}>${pl.charAt(0).toUpperCase() + pl.slice(1)}</option>`).join('')}</select>
      </div>
      <div class="uc-field"><label>Message limit</label>
        <input class="usr-limit" type="number" min="1" max="10000" value="${u.limitMessages ?? ''}" placeholder="Global (${state.globalLimit})">
      </div>
      <button class="btn btn-ghost btn-sm" data-uact="savelimit">Apply limit</button>
      <button class="btn btn-ghost btn-sm" data-uact="resetusage">Reset usage</button>
      <span class="uc-spacer"></span>
      <button class="btn ${u.banned ? 'btn-primary' : 'btn-warn'} btn-sm" data-uact="ban">${u.banned ? 'Unban' : 'Ban'}</button>
      <button class="btn btn-danger btn-sm" data-uact="delete">Delete</button>
    </div>
  </div>`;
}

/* ---------- status ---------- */
const STATUSES = ['ok', 'degraded', 'outage'];
const STAT_LABEL = { ok: 'Operational', degraded: 'Degraded', outage: 'Outage' };
const SEV_LABEL = { degraded: 'Degraded performance', outage: 'Outage', maintenance: 'Maintenance' };
const SEV_CLASS = { degraded: 'deg', outage: 'out', maintenance: 'mnt' };

async function renderStatus() {
  const main = $('#aMain');
  main.innerHTML = `<div class="sec" style="opacity:0"><div class="a-head"><h1>Loading…</h1></div></div>`;
  try { state.status = (await api('/api/admin/status')).status; } catch { return; }
  const svc = state.status.services;
  const incidents = state.status.incidents || [];
  const active = incidents.filter(i => !i.resolved);
  const resolved = incidents.filter(i => i.resolved).slice(0, 12);
  main.innerHTML = `
  <div class="sec">
    <div class="a-head"><div><h1>Status</h1><div class="a-sub">Incidents, services and 90-day history — everything goes live on the public status page instantly.</div></div></div>

    <div class="card inc-composer">
      <h3>Write an incident</h3>
      <div class="inc-form">
        <div class="inc-row">
          <select id="incSev">
            <option value="degraded">Degraded performance</option>
            <option value="outage">Outage</option>
            <option value="maintenance">Maintenance</option>
          </select>
          <select id="incSvc">
            <option value="">All services</option>
            ${svc.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
          </select>
          <input id="incTitle" placeholder="Short title — e.g. Elevated error rates" maxlength="120">
        </div>
        <div class="field" style="margin:0"><textarea id="incMsg" style="min-height:84px" placeholder="What is happening? This text is published on the public status page…" maxlength="1200"></textarea></div>
        <div class="inc-row inc-foot">
          <span class="inc-hint">If a service is selected, today is marked accordingly in its history.</span>
          <button class="btn btn-primary btn-sm" id="incCreate">Publish incident <span style="opacity:.6">→</span></button>
        </div>
      </div>
    </div>

    ${active.length ? `<div class="inc-active">${active.map(incCard).join('')}</div>` : ''}

    ${resolved.length ? `
    <div class="card inc-resolved-card">
      <h3>Resolved incidents</h3>
      ${resolved.map(incRowResolved).join('')}
    </div>` : ''}

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

  // create incident
  $('#incCreate').addEventListener('click', async () => {
    const title = $('#incTitle').value.trim();
    const message = $('#incMsg').value.trim();
    if (!title || !message) { toast('Title and message are required', true); return; }
    try {
      await post('/api/admin/status', { op: 'addIncident', title, message, severity: $('#incSev').value, serviceId: $('#incSvc').value || null });
      toast('Incident published');
    } catch { toast('Failed', true); }
    renderStatus();
  });

  // incident actions (updates / resolve / reopen / delete)
  main.querySelectorAll('[data-inc]').forEach(card => {
    card.addEventListener('click', async e => {
      const b = e.target.closest('button[data-incact]');
      if (!b) return;
      const id = card.dataset.inc;
      const act = b.dataset.incact;
      try {
        if (act === 'update') {
          const input = card.querySelector('.iu-input');
          const text = input ? input.value.trim() : '';
          if (!text) { toast('Write the update first', true); return; }
          await post('/api/admin/status', { op: 'incidentUpdate', id, text });
          toast('Update posted');
        } else if (act === 'resolve') {
          await post('/api/admin/status', { op: 'resolveIncident', id });
          toast('Incident resolved');
        } else if (act === 'reopen') {
          await post('/api/admin/status', { op: 'reopenIncident', id });
          toast('Incident reopened');
        } else if (act === 'delete') {
          if (!confirm('Delete this incident?')) return;
          await post('/api/admin/status', { op: 'deleteIncident', id });
          toast('Incident deleted');
        }
      } catch { toast('Failed', true); }
      renderStatus();
    });
  });

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
      ${s.history.map((v, di) => `<button class="day ${v === 'degraded' ? 'd' : v === 'outage' ? 'o' : ''} ${di === 89 ? 'today' : ''}" data-i="${di}" data-v="${v}" title="${di === 89 ? 'Today' : new Date(Date.now() - (89 - di) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${STAT_LABEL[v]} — click to change"></button>`).join('')}
    </div>
    <div class="day-scale"><span>${ninetyAgo}</span><span>Today</span></div>
  </div>`;
}
function incSvcName(inc) {
  if (!inc.serviceId) return 'All services';
  const s = state.status.services.find(x => x.id === inc.serviceId);
  return s ? s.name : 'All services';
}
function incCard(inc) {
  return `
  <div class="inc-card ${SEV_CLASS[inc.severity] || 'deg'}" data-inc="${inc.id}">
    <div class="inc-top">
      <span class="inc-sev">${SEV_LABEL[inc.severity] || 'Degraded performance'}</span>
      <span class="inc-meta">${esc(incSvcName(inc))} · opened ${fullDate(inc.created)}</span>
      <span class="inc-actions">
        <button class="btn btn-ghost btn-sm" data-incact="resolve">Resolve</button>
        <button class="btn btn-danger btn-sm" data-incact="delete">Delete</button>
      </span>
    </div>
    <div class="inc-title">${esc(inc.title)}</div>
    <div class="inc-msg">${esc(inc.message)}</div>
    ${(inc.updates && inc.updates.length) ? `<ul class="inc-updates">${inc.updates.map(u => `<li><span class="iu-at">${fullDate(u.at)}</span><span>${esc(u.text)}</span></li>`).join('')}</ul>` : ''}
    <div class="inc-addupdate">
      <input class="iu-input" placeholder="Add a public update to this incident…" maxlength="1200">
      <button class="btn btn-ghost btn-sm" data-incact="update">Post update</button>
    </div>
  </div>`;
}
function incRowResolved(inc) {
  return `
  <div class="inc-res" data-inc="${inc.id}">
    <span class="inc-sev sm ${SEV_CLASS[inc.severity] || 'deg'}">${SEV_LABEL[inc.severity] || 'Degraded performance'}</span>
    <div class="inc-res-mid">
      <div class="inc-title">${esc(inc.title)}</div>
      <div class="inc-meta">Resolved ${fullDate(inc.resolvedAt || inc.created)} · ${esc(incSvcName(inc))}${(inc.updates && inc.updates.length) ? ` · ${inc.updates.length} update${inc.updates.length === 1 ? '' : 's'}` : ''}</div>
    </div>
    <span class="inc-actions">
      <button class="btn btn-ghost btn-sm" data-incact="reopen">Reopen</button>
      <button class="btn btn-danger btn-sm" data-incact="delete">Delete</button>
    </span>
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
  if (window.TuringVeil) TuringVeil.hide();
})();
