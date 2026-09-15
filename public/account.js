/* ============ Turing — account page ============ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function T(key, vars) { return TURING_I18N.t(lang, key, vars); }

let lang = TURING_I18N.detectLang();
document.documentElement.lang = lang;
const locale = () => (lang === 'en' ? 'en-US' : lang);

const state = { user: null, usage: null };

async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || 'request failed'), { status: r.status, data: j });
  return j;
}

/* ---------- i18n ---------- */
function applyStaticI18n() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach(n => { n.textContent = T(n.dataset.i18n); });
  $('#langCur').textContent = lang.toUpperCase().replace('-419', '').replace('-BR', '').replace('-ES', '');
  fillDynamic();
}

const GLOBE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';
function buildLangMenu() {
  $('#langGlobe').innerHTML = GLOBE_SVG;
  const menu = $('#langMenu');
  menu.innerHTML = TURING_I18N.LANGS.map(l =>
    `<button class="lang-item${l.code === lang ? ' sel' : ''}" data-lang="${l.code}"><span>${esc(l.native)}</span>${l.code === lang ? '<span class="lk">✓</span>' : ''}</button>`).join('');
  $$('.lang-item', menu).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    lang = b.dataset.lang;
    try { localStorage.setItem('turing_lang', lang); } catch {}
    $('#langMenu').hidden = true;
    $('#langBtn').setAttribute('aria-expanded', 'false');
    applyStaticI18n();
    buildLangMenu();
  }));
}
$('#langBtn').addEventListener('click', e => {
  e.stopPropagation();
  const m = $('#langMenu');
  m.hidden = !m.hidden;
  $('#langBtn').setAttribute('aria-expanded', String(!m.hidden));
});
document.addEventListener('click', e => { if (!$('#langSwitch').contains(e.target)) $('#langMenu').hidden = true; });

/* ---------- dynamic content ---------- */
function fmtCountdown(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '';
  const mins = Math.ceil(ms / 60000);
  const h = Math.floor(mins / 60), m = mins % 60;
  const t = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return T('accResets', { t });
}
function fillDynamic() {
  if (!state.user) return;
  const u = state.user;
  $('#accName').textContent = u.name;
  $('#accEmail').textContent = u.email;
  $('#accAva').textContent = (u.name || '?').trim().charAt(0).toUpperCase();
  $('#kvName').textContent = u.name;
  $('#kvEmail').textContent = u.email;
  try {
    $('#kvJoined').textContent = new Date(u.created).toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { $('#kvJoined').textContent = u.created; }

  const usage = state.usage;
  if (usage) {
    $('#uUsed').textContent = usage.used;
    $('#uLimit').textContent = usage.limit;
    const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
    const fill = $('#uFill');
    fill.style.width = pct + '%';
    fill.classList.toggle('warn', pct >= 60 && pct < 100);
    fill.classList.toggle('full', pct >= 100);
    $('#uResets').textContent = usage.used > 0 ? fmtCountdown(usage.resetsAt) : '';
    $('#uWindow').textContent = T('accWindow', { h: usage.windowHours });
  }
}

/* ---------- sign out / delete ---------- */
$('#signOutBtn').addEventListener('click', async () => {
  try { await fetchJSON('/api/auth/logout', { method: 'POST' }); } catch {}
  location.replace('/login');
});
$('#deleteBtn').addEventListener('click', () => { $('#delModal').hidden = false; });
$('#delCancel').addEventListener('click', () => { $('#delModal').hidden = true; });
$('#delConfirm').addEventListener('click', async e => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await fetchJSON('/api/account/delete', { method: 'POST' });
    location.replace('/');
  } catch {
    btn.disabled = false;
    $('#delModal').hidden = true;
  }
});

/* ---------- change password ---------- */
$('#passForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#passMsg');
  const cur = $('#p-cur').value, n1 = $('#p-new').value, n2 = $('#p-new2').value;
  msg.hidden = true;
  if (n1 !== n2 || n1.length < 8) {
    msg.textContent = n1.length < 8 ? T('accPassShort') : T('accPassWrong');
    msg.className = 'form-msg err'; msg.hidden = false;
    return;
  }
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    await fetchJSON('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: cur, password: n1 }) });
    msg.textContent = T('accPassOk');
    msg.className = 'form-msg ok'; msg.hidden = false;
    e.target.reset();
  } catch (err) {
    msg.textContent = err.data && err.data.error === 'wrong_password' ? T('accPassWrong') : T('accPassShort');
    msg.className = 'form-msg err'; msg.hidden = false;
  } finally { btn.disabled = false; }
});

/* ---------- boot ---------- */
(async function boot() {
  let data;
  try {
    const r = await fetch('/api/account');
    if (!r.ok) throw new Error('noauth');
    data = await r.json();
  } catch {
    location.replace('/login?next=' + encodeURIComponent('/account.html'));
    return;
  }
  state.user = data.user;
  state.usage = data.usage;
  applyStaticI18n();
  buildLangMenu();
  $('#accShell').hidden = false;
  requestAnimationFrame(() => $('#accShell').classList.add('ready'));
  // live countdown refresh
  setInterval(fillDynamic, 30000);
})();
