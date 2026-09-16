/* ============ Turing IA — chat client (v3) ============ */
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function T(key, vars) { return TURING_I18N.t(lang, key, vars); }
async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || 'request failed'), { status: r.status, data: j });
  return j;
}

let lang = TURING_I18N.detectLang();
document.documentElement.lang = lang;
const locale = () => (lang === 'en' ? 'en-US' : lang);

const state = { user: null, chats: [], activeId: null, activeChat: null, streaming: false, incognito: null, pending: [] };
let abortCtrl = null;

/* ---------- i18n ---------- */
function applyStaticI18n() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach(n => { n.textContent = T(n.dataset.i18n); });
  $$('[data-i18n-title]').forEach(n => { const t = T(n.dataset.i18nTitle); n.title = t; n.setAttribute('aria-label', t); });
  const inp = $('#msgInput');
  if (inp) inp.placeholder = T('iaPh');
  $('#langCur').textContent = lang.toUpperCase().replace('-419', '').replace('-BR', '').replace('-ES', '');
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
    closeLangMenu();
    applyStaticI18n();
    buildLangMenu();
    renderSide();
    renderMain();
  }));
}
function closeLangMenu() {
  $('#langMenu').hidden = true;
  $('#langBtn').setAttribute('aria-expanded', 'false');
}
$('#langBtn').addEventListener('click', e => {
  e.stopPropagation();
  const m = $('#langMenu');
  m.hidden = !m.hidden;
  $('#langBtn').setAttribute('aria-expanded', String(!m.hidden));
});
document.addEventListener('click', e => {
  const sw = $('#langSwitch');
  if (sw && !sw.contains(e.target)) closeLangMenu();
});

/* ---------- markdown (small, safe) ---------- */
/* Los modelos suelen partir la prosa con saltos de línea blandos; el markdown los
   trataría como saltos duros ("Buenos\ndias" → dos líneas). Colapsamos los saltos
   de líneas de prosa consecutivas a espacios, respetando títulos, listas, citas,
   tablas, reglas y bloques de código. */
function softBreaks(t) {
  const structural = s => /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|---|\|)/.test(s);
  const lines = t.split('\n');
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i], next = lines[i + 1];
    out += cur;
    if (next === undefined) break;
    const keepBreak = cur.trim() === '' || next.trim() === '' || structural(cur) || structural(next);
    out += keepBreak ? '\n' : ' ';
  }
  return out;
}

function mdToHtml(src, live = false) {
  let text = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
  if (live && (text.match(/```/g) || []).length % 2 === 1) text += '\n```';
  const blocks = [];
  text = text.replace(/```([\w+#-]*)[^\S\n]*\n([\s\S]*?)```/g, (m, lg, code) => {
    blocks.push({ lang: lg || 'code', code: code.replace(/\n$/, '') });
    return `\u0000B${blocks.length - 1}\u0000`;
  });
  text = softBreaks(text);
  /* tablas markdown: encabezado + separador + filas */
  const tables = [];
  text = text.replace(/(?:^|\n)((?:\|[^\n]*\n)+(?:\|[^\n]*))(?=\n|$)/g, (m0, block) => {
    const rows = block.trim().split('\n').map(r => r.trim());
    if (rows.length < 2) return m0;
    const cells = r => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const head = cells(rows[0]);
    if (head.length < 2 || !/^\|?[\s:|-]+\|?$/.test(rows[1])) return m0;
    const sep = cells(rows[1]);
    if (sep.length !== head.length || !sep.every(c => /^:?-+:?$/.test(c))) return m0;
    const inline = x => esc(x).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
    const body = rows.slice(2).map(r => cells(r));
    tables.push(`<div class="tbl-wrap"><table><thead><tr>${head.map(h2 => `<th>${inline(h2)}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${head.map((_, i) => `<td>${inline(r[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    return `\n\u0000T${tables.length - 1}\u0000\n`;
  });
  let h = esc(text);
  h = h.replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  h = h.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  h = h.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  h = h.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  h = h.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  h = h.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  h = h.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^---+$/gm, '<hr>');
  h = h.replace(/(^|\n)((?:[-*] .*(?:\n|$))+)/g, (m, pre, chunk) =>
    `${pre}<ul>${chunk.trim().split(/\n/).map(l => `<li>${l.replace(/^[-*] /, '')}</li>`).join('')}</ul>`);
  h = h.replace(/(^|\n)((?:\d+[.)] .*(?:\n|$))+)/g, (m, pre, chunk) =>
    `${pre}<ol>${chunk.trim().split(/\n/).map(l => `<li>${l.replace(/^\d+[.)] /, '')}</li>`).join('')}</ol>`);
  h = h.split(/\n{2,}/).map(part => {
    const t = part.trim();
    if (!t) return '';
    if (/^<(h\d|ul|ol|blockquote|hr|pre)|^\u0000[BT]/.test(t)) return t;
    return `<p>${t.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  h = h.replace(/\u0000B(\d+)\u0000/g, (m, i) => {
    const b = blocks[+i];
    if (!b) return '';
    const id = 'art' + (++artSeq);
    artifacts.set(id, { title: b.lang || 'code', lang: b.lang, code: b.code });
    return `<div class="codeblock"><div class="cb-head"><span>${esc(b.lang)}</span><span class="cb-actions"><button class="cb-copy" data-code="${encodeURIComponent(b.code)}">${esc(T('iaCopy'))}</button><button class="cb-art" data-art="${id}" title="${esc(T('iaArtOpen'))}" aria-label="${esc(T('iaArtOpen'))}">⛶</button></span></div><pre><code>${esc(b.code)}</code></pre></div>`;
  });
  h = h.replace(/\u0000T(\d+)\u0000/g, (m, i) => tables[+i] || '');
  return h;
}
const rawTexts = new WeakMap(); // assistant content element → raw markdown

/* ---------- artefactos + utilidades de archivos ---------- */
const artifacts = new Map(); let artSeq = 0;
const EXT_MAP = { js:'js', javascript:'js', ts:'ts', typescript:'ts', tsx:'tsx', jsx:'jsx', python:'py', py:'py', html:'html', css:'css', json:'json', md:'md', markdown:'md', bash:'sh', sh:'sh', shell:'sh', sql:'sql', java:'java', c:'c', cpp:'cpp', cs:'cs', go:'go', rs:'rs', rb:'rb', php:'php', yaml:'yml', yml:'yml', xml:'xml', svg:'svg' };
function extFor(lang) { return EXT_MAP[(lang || '').toLowerCase()] || 'txt'; }
function downloadText(name, text, mime) {
  const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function fileIcon(a) { return a.mime && a.mime.startsWith('image/') ? '🖼' : a.mime === 'application/pdf' ? '📕' : '📎'; }
function fmtSize(n) { n = n || 0; return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B'; }
function exportBtnState() {
  const eb = $('#exportBtn');
  if (!eb) return;
  const has = state.incognito ? state.incognito.messages.length : (state.activeChat && state.activeChat.messages.length);
  eb.hidden = !has;
}

/* ---------- sidebar ---------- */
function fmtWhen(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 86400000;
  if (diff < 1) return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  if (diff < 7) return d.toLocaleDateString(locale(), { weekday: 'short' });
  return d.toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
}
function renderSide() {
  const list = $('#chatList');
  if (!list) return;
  const pill = state.incognito ? `<div class="inc-pill"><span aria-hidden="true">🕶</span>${esc(T('iaIncBadge'))}</div>` : '';
  if (!state.chats.length) {
    list.innerHTML = pill + `<div class="side-empty"><div class="se-t">${esc(T('iaNoChats'))}</div><div class="se-b">${esc(T('iaNoChatsB'))}</div></div>`;
    return;
  }
  list.innerHTML = pill + state.chats.map(c => `
    <button class="chat-item ${c.id === state.activeId ? 'sel' : ''}" data-id="${c.id}">
      <span class="ci-title">${esc(c.title)}</span>
      <span class="ci-sub">${c.preview ? esc(c.preview) : fmtWhen(c.updated)}</span>
      <span class="ci-acts">
        <span class="ci-act" data-act="rename" title="${esc(T('iaRename'))}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></span>
        <span class="ci-act danger" data-act="del" title="${esc(T('iaDel'))}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></span>
      </span>
    </button>`).join('');
}

$('#chatList').addEventListener('click', e => {
  const item = e.target.closest('.chat-item');
  if (!item) return;
  const id = item.dataset.id;
  const act = e.target.closest('[data-act]');
  if (act) {
    e.stopPropagation();
    if (act.dataset.act === 'del') deleteChat(id, item);
    else if (act.dataset.act === 'rename') renameChat(id, item);
    return;
  }
  if (state.streaming) return;
  if (id === state.activeId) { closeSideMobile(); return; }
  openChat(id);
});

function renameChat(id, item) {
  const chat = state.chats.find(c => c.id === id);
  const titleEl = item.querySelector('.ci-title');
  if (!chat || !titleEl) return;
  titleEl.outerHTML = `<input class="ci-rename" value="${esc(chat.title)}" maxlength="80">`;
  const inp = item.querySelector('.ci-rename');
  inp.focus(); inp.select();
  let done = false;
  const commit = async (saveIt) => {
    if (done) return; done = true;
    const val = inp.value.trim();
    if (saveIt && val && val !== chat.title) {
      try {
        await fetchJSON(`/api/chats/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: val }) });
        chat.title = val;
        if (state.activeChat && state.activeChat.id === id) state.activeChat.title = val;
      } catch {}
    }
    renderSide();
  };
  inp.addEventListener('keydown', e2 => {
    e2.stopPropagation();
    if (e2.key === 'Enter') commit(true);
    if (e2.key === 'Escape') commit(false);
  });
  inp.addEventListener('blur', () => commit(true));
  inp.addEventListener('click', e2 => e2.stopPropagation());
}
async function deleteChat(id, item) {
  item.style.transition = 'opacity .25s, transform .25s';
  item.style.opacity = '0';
  item.style.transform = 'translateX(-8px)';
  try { await fetchJSON(`/api/chats/${id}`, { method: 'DELETE' }); } catch {}
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.activeId === id) { state.activeId = null; state.activeChat = null; renderMain(); }
  setTimeout(renderSide, 180);
}

/* ---------- main area ---------- */
const COPY_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const SUG_ICONS = ['✦', '✉', '⌘', '◷'];

function welcomeHtml() {
  const first = ((state.user && state.user.name) || '').trim().split(/\s+/)[0] || '';
  const keys = ['iaSug1', 'iaSug2', 'iaSug3', 'iaSug4'];
  return `
  <div class="welcome">
    <div class="welcome-mark"><span class="core"></span></div>
    <h1>${esc(T('iaHello', { name: first }))}</h1>
    <div class="w-sub">${esc(T('iaSub'))}</div>
    <div class="suggestions">
      ${keys.map((k, i) => `<button class="sug" data-sug="${k}"><span class="s-ic">${SUG_ICONS[i]}</span><span>${esc(T(k))}</span></button>`).join('')}
    </div>
  </div>`;
}

function msgUserHtml(text, atts) {
  const initial = ((state.user && state.user.name) || '?').trim().charAt(0).toUpperCase();
  const attsHtml = (atts && atts.length) ? `<div class="ua-atts">${atts.map(a => (a.mime && a.mime.startsWith('image/'))
    ? `<a class="ua-imglink" href="${esc(a.url)}" target="_blank" rel="noopener"><img class="ua-img" src="${esc(a.url)}" alt="${esc(a.name)}" loading="lazy"></a>`
    : `<a class="ua-file" href="${esc(a.url)}" target="_blank" rel="noopener"><span class="uf-ic" aria-hidden="true">${fileIcon(a)}</span><span class="uf-n">${esc(a.name)}</span><span class="uf-s">${fmtSize(a.size)}</span></a>`).join('')}</div>` : '';
  return `
  <div class="msg user">
    <div class="m-avatar">${esc(initial)}</div>
    <div class="m-col">
      <span class="m-who">${esc(T('iaYou'))}</span>
      ${attsHtml}
      ${text ? `<div class="m-bubble">${esc(text)}</div>` : ''}
    </div>
  </div>`;
}
function msgAssistantHtml(content) {
  const has = !!content;
  const acts = has ? `<div class="m-acts">
      <button class="m-act" data-copy>${COPY_SVG}<span>${esc(T('iaCopy'))}</span></button>
      <button class="m-act" data-retry aria-label="${esc(T('iaRetry'))}">↻<span>${esc(T('iaRetry'))}</span></button>
      <button class="m-act" data-dlmsg aria-label="Markdown">⬇<span>.md</span></button>
    </div>` : '';
  return `
  <div class="msg turing">
    <div class="m-avatar"><span class="dot"></span></div>
    <div class="m-col">
      <span class="m-who">Turing</span>
      <div class="m-content">${has ? mdToHtml(content) : `<span class="typing"><i></i><i></i><i></i></span>`}</div>
      ${acts}
    </div>
  </div>`;
}
function threadHtml(chat) {
  const parts = chat.messages.map(m => m.role === 'user' ? msgUserHtml(m.content, m.attachments) : msgAssistantHtml(m.content));
  return `<div class="ia-scroll">${parts.join('')}</div>`;
}

const iaBody = $('#iaBody');
function nearBottom() { return iaBody.scrollHeight - iaBody.scrollTop - iaBody.clientHeight < 150; }
function scrollBottom(force) { if (force || nearBottom()) iaBody.scrollTop = iaBody.scrollHeight; }

function renderMain() {
  if (state.incognito) {
    const msgs = state.incognito.messages;
    const banner = `<div class="inc-banner" role="status"><span aria-hidden="true">🕶</span><span>${esc(T('iaIncBanner'))}</span></div>`;
    iaBody.innerHTML = banner + (msgs.length
      ? `<div class="ia-scroll">${msgs.map(m => m.role === 'user' ? msgUserHtml(m.content, m.attachments) : msgAssistantHtml(m.content)).join('')}</div>`
      : welcomeHtml());
    exportBtnState();
    return;
  }
  if (!state.activeId || !state.activeChat) {
    iaBody.innerHTML = welcomeHtml();
    $$('.sug', iaBody).forEach(b => b.addEventListener('click', () => {
      if (state.streaming) return;
      const inp = $('#msgInput');
      inp.value = T(b.dataset.sug);
      inp.dispatchEvent(new Event('input'));
      send();
    }));
    return;
  }
  iaBody.innerHTML = threadHtml(state.activeChat);
  const els = $$('.msg.turing .m-content', iaBody);
  let ai = 0;
  state.activeChat.messages.forEach(m => {
    if (m.role !== 'assistant') return;
    if (els[ai]) rawTexts.set(els[ai], m.content);
    ai++;
  });
  scrollBottom(true);
}

async function openChat(id) {
  state.incognito = null;
  state.activeId = id;
  state.activeChat = null;
  renderSide();
  closeSideMobile();
  iaBody.innerHTML = `<div class="ia-scroll">${msgAssistantHtml('')}</div>`;
  try {
    const r = await fetchJSON(`/api/chats/${id}`);
    state.activeChat = r.chat;
    const idx = state.chats.findIndex(c => c.id === id);
    if (idx >= 0) state.chats[idx] = { ...state.chats[idx], title: r.chat.title, updated: r.chat.updated };
    renderMain();
  } catch {
    state.activeId = null;
    renderMain();
  }
}

/* ---------- composer / streaming ---------- */
const input = $('#msgInput');
const sendBtn = $('#sendBtn');
const attachBtn = $('#attachBtn');
const fileInput = $('#fileInput');
const attachTray = $('#attachTray');

function grow() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 190) + 'px';
  if (!state.streaming) sendBtn.disabled = !input.value.trim() && !state.pending.length;
}
input.addEventListener('input', grow);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    if (!state.streaming) send();
  }
});
sendBtn.addEventListener('click', () => {
  if (state.streaming) { if (abortCtrl) abortCtrl.abort(); return; }
  send();
});

function setStreaming(on) {
  state.streaming = on;
  sendBtn.classList.toggle('stop-mode', on);
  sendBtn.setAttribute('aria-label', on ? T('iaStop') : T('iaSend'));
  sendBtn.disabled = on ? false : !input.value.trim() && !state.pending.length;
}

/* ---------- adjuntos ---------- */
attachBtn.addEventListener('click', () => fileInput.click());
attachTray.addEventListener('click', e => {
  const b = e.target.closest('[data-rmatt]');
  if (!b) return;
  state.pending.splice(+b.dataset.rmatt, 1);
  renderTray();
});
fileInput.addEventListener('change', async () => {
  const files = [...(fileInput.files || [])];
  fileInput.value = '';
  for (const f of files) {
    if (state.pending.length >= 4) { appendError(T('iaTooManyFiles')); break; }
    if (f.size > 5 * 1024 * 1024) { appendError(`${T('iaFileTooBig')}: ${f.name}`); continue; }
    const chipId = 'up' + Date.now() + Math.floor(Math.random() * 1e6);
    attachTray.hidden = false;
    attachTray.insertAdjacentHTML('beforeend', `<span class="att-chip up" id="${chipId}"><span class="ac-ic" aria-hidden="true">⏳</span><span class="ac-n">${esc(f.name)}</span><span class="ac-s">${esc(T('iaUploading'))}</span></span>`);
    try {
      const data = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] || '');
        r.onerror = () => rej(new Error('read'));
        r.readAsDataURL(f);
      });
      const up = await fetchJSON('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.name, type: f.type || 'application/octet-stream', data }) });
      state.pending.push({ name: up.name, url: up.url, mime: up.mime, size: up.size, text: up.text });
    } catch (e2) {
      appendError(e2.data && e2.data.error === 'bad_type' ? T('iaBadType') : e2.data && e2.data.error === 'too_big' ? T('iaFileTooBig') : T('iaUploadFail'));
    }
    renderTray();
    grow();
  }
});
function renderTray() {
  if (!state.pending.length) { attachTray.hidden = true; attachTray.innerHTML = ''; return; }
  attachTray.hidden = false;
  attachTray.innerHTML = state.pending.map((a, i) => `
    <span class="att-chip">
      ${a.mime && a.mime.startsWith('image/') ? `<img src="${esc(a.url)}" alt="">` : `<span class="ac-ic" aria-hidden="true">${fileIcon(a)}</span>`}
      <span class="ac-n" title="${esc(a.name)}">${esc(a.name)}</span>
      <span class="ac-s">${fmtSize(a.size)}</span>
      <button class="ac-x" data-rmatt="${i}" aria-label="✕">✕</button>
    </span>`).join('');
}

/* ---------- envío (normal, incógnito y reintento comparten el streaming) ---------- */
function ensureScroll() {
  let scroll = iaBody.querySelector('.ia-scroll');
  if (!scroll) {
    iaBody.innerHTML = (state.incognito ? `<div class="inc-banner" role="status"><span aria-hidden="true">🕶</span><span>${esc(T('iaIncBanner'))}</span></div>` : '') + '<div class="ia-scroll"></div>';
    scroll = iaBody.querySelector('.ia-scroll');
  }
  return scroll;
}
function appendUser(text, atts) {
  const scroll = ensureScroll();
  scroll.insertAdjacentHTML('beforeend', msgUserHtml(text, atts));
  scrollBottom(true);
}
function appendAssistantPlaceholder() {
  const scroll = ensureScroll();
  scroll.insertAdjacentHTML('beforeend', msgAssistantHtml(''));
  scrollBottom(true);
  return scroll.querySelector('.msg.turing:last-child .m-content');
}
function appendError(text) {
  const scroll = iaBody.querySelector('.ia-scroll');
  if (scroll) scroll.insertAdjacentHTML('beforeend', `<div class="m-error"><span aria-hidden="true">⚠</span><span>${esc(text)}</span></div>`);
  scrollBottom(true);
}
function finalizeAssistant(contentEl, text) {
  contentEl.innerHTML = mdToHtml(text);
  rawTexts.set(contentEl, text);
  contentEl.closest('.m-col').insertAdjacentHTML('beforeend', `<div class="m-acts">
      <button class="m-act" data-copy>${COPY_SVG}<span>${esc(T('iaCopy'))}</span></button>
      <button class="m-act" data-retry aria-label="${esc(T('iaRetry'))}">↻<span>${esc(T('iaRetry'))}</span></button>
      <button class="m-act" data-dlmsg aria-label="Markdown">⬇<span>.md</span></button>
    </div>`);
  const store = state.incognito ? state.incognito.messages : (state.activeChat && state.activeChat.messages);
  if (store) store.push({ role: 'assistant', content: text, at: new Date().toISOString() });
  exportBtnState();
  scrollBottom(false);
}

/* streaming SSE compartido: pinta en contentEl y guarda la respuesta final */
async function streamInto(url, body, contentEl) {
  abortCtrl = new AbortController();
  let acc = '';
  let paintTimer = 0;
  const PAINT_MS = 70;
  const paintLive = () => {
    paintTimer = 0;
    contentEl.innerHTML = mdToHtml(acc, true) + '<span class="cursor"></span>';
    scrollBottom(false);
  };
  const queuePaint = () => { if (!paintTimer) paintTimer = setTimeout(paintLive, PAINT_MS); };
  const stopPaint = () => { if (paintTimer) { clearTimeout(paintTimer); paintTimer = 0; } };
  let upstreamErr = false;
  try {
    const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: abortCtrl.signal });
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      const msg = contentEl.closest('.msg'); if (msg) msg.remove();
      if (resp.status === 429) $('#limitModal').hidden = false;
      else if (j.error === 'not_configured') appendError(T('iaErrNoKey'));
      else appendError(j.error === 'maintenance' ? T('iaErrUpstream') : T('iaErrGeneric'));
      return null;
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.title && !state.incognito) {
          const c = state.chats.find(x => x.id === state.activeId);
          const changed = !c || c.title !== ev.title;
          if (c) { c.title = ev.title; c.preview = body.content || ''; }
          if (state.activeChat) state.activeChat.title = ev.title;
          if (changed) renderSide();
        }
        if (ev.content) { acc += ev.content; queuePaint(); }
        if (ev.error) upstreamErr = true;
      }
    }
    stopPaint();
    const msg = contentEl.closest('.msg');
    if (upstreamErr) { if (msg) msg.remove(); appendError(T('iaErrUpstream')); return null; }
    if (!acc) { if (msg) msg.remove(); appendError(T('iaErrGeneric')); return null; }
    finalizeAssistant(contentEl, acc);
    return acc;
  } catch (e) {
    stopPaint();
    if (e.name === 'AbortError') {
      if (acc) { finalizeAssistant(contentEl, acc); return acc; }
      const msg = contentEl.closest('.msg'); if (msg) msg.remove();
      return null;
    }
    const msg = contentEl.closest('.msg'); if (msg) msg.remove();
    appendError(T('iaErrGeneric'));
    return null;
  }
}

async function send() {
  const text = input.value.trim();
  const atts = state.pending.map(a => ({ ...a }));
  if ((!text && !atts.length) || state.streaming) return;
  input.value = ''; grow();
  state.pending = []; renderTray();

  if (state.incognito) {
    const umsg = { role: 'user', content: text, at: new Date().toISOString() };
    if (atts.length) umsg.attachments = atts;
    state.incognito.messages.push(umsg);
    appendUser(text, atts);
    const contentEl = appendAssistantPlaceholder();
    setStreaming(true);
    try { await streamInto('/api/incognito/messages', { content: text, attachments: atts }, contentEl); }
    finally { setStreaming(false); setTimeout(() => input.focus(), 30); }
    return;
  }

  if (!state.activeId) {
    try {
      const r = await fetchJSON('/api/chats', { method: 'POST' });
      state.activeId = r.chat.id;
      state.activeChat = { ...r.chat, messages: [] };
      state.chats.unshift({ id: r.chat.id, title: r.chat.title, created: r.chat.created, updated: r.chat.updated, preview: '', count: 0 });
      renderSide();
      iaBody.innerHTML = '<div class="ia-scroll"></div>';
    } catch { appendError(T('iaErrGeneric')); return; }
  }

  appendUser(text, atts);
  const umsg = { role: 'user', content: text, at: new Date().toISOString() };
  if (atts.length) umsg.attachments = atts.map(a => ({ name: a.name, url: a.url, mime: a.mime, size: a.size, text: a.text }));
  state.activeChat.messages.push(umsg);
  exportBtnState();

  const contentEl = appendAssistantPlaceholder();
  setStreaming(true);
  try {
    await streamInto(`/api/chats/${state.activeId}/messages`, { content: text, attachments: atts }, contentEl);
  } finally {
    setStreaming(false);
    refreshChats();
    setTimeout(() => input.focus(), 30);
  }
}

/* reintentar la última respuesta */
async function retryFrom(msgEl) {
  if (!msgEl || state.streaming) return;
  const scroll = iaBody.querySelector('.ia-scroll');
  if (!scroll || scroll.lastElementChild !== msgEl || !msgEl.classList.contains('turing')) return;

  if (state.incognito) {
    const msgs = state.incognito.messages;
    if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    const lastU = [...msgs].reverse().find(m => m.role === 'user');
    if (!lastU) return;
    const atts = (lastU.attachments || []).map(a => ({ ...a }));
    msgEl.remove();
    const contentEl = appendAssistantPlaceholder();
    setStreaming(true);
    try { await streamInto('/api/incognito/messages', { content: lastU.content, attachments: atts }, contentEl); }
    finally { setStreaming(false); }
    return;
  }

  if (!state.activeId || !state.activeChat) return;
  const m2 = state.activeChat.messages;
  if (m2.length && m2[m2.length - 1].role === 'assistant') m2.pop();
  msgEl.remove();
  const contentEl = appendAssistantPlaceholder();
  setStreaming(true);
  try { await streamInto(`/api/chats/${state.activeId}/retry`, {}, contentEl); }
  finally { setStreaming(false); refreshChats(); }
}

async function refreshChats() {
  try {
    const r = await fetchJSON('/api/chats');
    state.chats = r.chats;
    renderSide();
  } catch {}
}

/* ---------- acciones delegadas (copiar, artefactos, retry, descargar) ---------- */
iaBody.addEventListener('click', async e => {
  const cb = e.target.closest('.cb-copy');
  if (cb) {
    try { await navigator.clipboard.writeText(decodeURIComponent(cb.dataset.code)); } catch {}
    const old = cb.textContent;
    cb.textContent = T('iaCopied');
    setTimeout(() => { cb.textContent = old; }, 1400);
    return;
  }
  const art = e.target.closest('.cb-art');
  if (art) { openArtifact(art.dataset.art); return; }
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const col = cp.closest('.m-col');
    const contentEl = col ? col.querySelector('.m-content') : null;
    const raw = (contentEl && rawTexts.get(contentEl)) || (contentEl ? contentEl.textContent : '');
    try { await navigator.clipboard.writeText(raw); } catch {}
    const lbl = cp.querySelector('span');
    if (lbl) { lbl.textContent = T('iaCopied'); setTimeout(() => { lbl.textContent = T('iaCopy'); }, 1400); }
    return;
  }
  const rp = e.target.closest('[data-retry]');
  if (rp) { retryFrom(rp.closest('.msg')); return; }
  const dm = e.target.closest('[data-dlmsg]');
  if (dm) {
    const col = dm.closest('.m-col');
    const contentEl = col ? col.querySelector('.m-content') : null;
    const raw = (contentEl && rawTexts.get(contentEl)) || (contentEl ? contentEl.textContent : '');
    downloadText('turing-message.md', raw, 'text/markdown');
  }
});

/* ---------- artefactos: panel lateral ---------- */
function openArtifact(id) {
  const a = artifacts.get(id);
  if (!a) return;
  $('#artTitle').textContent = `${a.lang || 'code'} · ${a.code.split('\n').length} ln · ${fmtSize(a.code.length)}`;
  $('#artBody').textContent = a.code;
  const dl = $('#artDl');
  dl.dataset.name = `turing-${(a.lang || 'code').replace(/[^\w-]/g, '') || 'code'}.${extFor(a.lang)}`;
  dl.dataset.code = encodeURIComponent(a.code);
  $('#artPanel').hidden = false;
  $('#artScrim').hidden = false;
}
function closeArtifact() { $('#artPanel').hidden = true; $('#artScrim').hidden = true; }
$('#artClose').addEventListener('click', closeArtifact);
$('#artScrim').addEventListener('click', closeArtifact);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#artPanel').hidden) closeArtifact(); });
$('#artCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(decodeURIComponent($('#artDl').dataset.code || ''));
    const btn = $('#artCopy'); const old = btn.textContent;
    btn.textContent = T('iaCopied');
    setTimeout(() => { btn.textContent = old; }, 1400);
  } catch {}
});
$('#artDl').addEventListener('click', () => {
  const d = $('#artDl');
  downloadText(d.dataset.name || 'artifact.txt', decodeURIComponent(d.dataset.code || ''));
});

/* ---------- exportar chat ---------- */
$('#exportBtn').addEventListener('click', () => {
  let msgs, title;
  if (state.incognito) { msgs = state.incognito.messages; title = T('iaIncBadge'); }
  else if (state.activeChat) { msgs = state.activeChat.messages; title = state.activeChat.title || 'Turing'; }
  if (!msgs || !msgs.length) return;
  const fname = 'turing-' + String(title).replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).toLowerCase() + '.md';
  const md = `# ${title}\n\n` + msgs.map(m => m.role === 'user'
    ? `## ${T('iaYou')}\n\n${m.content || ''}${(m.attachments || []).map(a => `\n\n📎 ${a.name} (${a.url})`).join('')}`
    : `## Turing\n\n${m.content}`).join('\n\n---\n\n');
  downloadText(fname, md, 'text/markdown');
});

/* ---------- modal / new chat / mobile ---------- */
$('#limitClose').addEventListener('click', () => { $('#limitModal').hidden = true; });
$('#limitModal').addEventListener('click', e => { if (e.target === $('#limitModal')) $('#limitModal').hidden = true; });

$('#newChatBtn').addEventListener('click', () => {
  if (state.streaming) return;
  state.incognito = null;
  state.activeId = null;
  state.activeChat = null;
  renderSide();
  renderMain();
  closeSideMobile();
  setTimeout(() => input.focus(), 40);
});
function closeSideMobile() {
  if (innerWidth <= 880) { $('#iaSide').classList.remove('open'); $('#scrim').hidden = true; }
}
$('#incBtn').addEventListener('click', () => {
  if (state.streaming) return;
  state.incognito = { messages: [] };
  state.activeId = null;
  state.activeChat = null;
  renderSide();
  renderMain();
  closeSideMobile();
  setTimeout(() => input.focus(), 40);
});
$('#sideBtn').addEventListener('click', () => {
  const side = $('#iaSide');
  const open = side.classList.toggle('open');
  $('#scrim').hidden = !open;
});
$('#scrim').addEventListener('click', closeSideMobile);

/* ---------- boot ---------- */
(async function boot() {
  let me;
  try {
    const r = await fetch('/api/auth/me');
    if (!r.ok) throw new Error('noauth');
    me = await r.json();
  } catch {
    location.replace('/login?next=' + encodeURIComponent('/ia.html'));
    return;
  }
  if (!me.onboarded) { location.replace('/onboard'); return; }
  state.user = me.user;

  const initial = (state.user.name || '?').trim().charAt(0).toUpperCase();
  $('#sideAva').textContent = initial;
  $('#topAvaLetter').textContent = initial;
  $('#sideName').textContent = state.user.name;
  if (state.user.avatar) {
    const img = `<img src="${esc(state.user.avatar)}" alt="">`;
    $('#sideAva').innerHTML = img;
    $('#topAvaLetter').innerHTML = img;
  }

  applyStaticI18n();
  buildLangMenu();
  try { state.chats = (await fetchJSON('/api/chats')).chats; } catch {}
  renderSide();
  renderMain();

  $('#iaShell').hidden = false;
  if (window.TuringVeil) TuringVeil.hide();
  grow();
  input.focus();
})();
