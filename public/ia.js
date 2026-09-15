/* ============ Turing IA — chat client ============ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function T(key, vars) {
  let v = TURING_I18N.t(lang, key, vars);
  return v;
}

let lang = TURING_I18N.detectLang();
document.documentElement.lang = lang;
const locale = () => (lang === 'en' ? 'en-US' : lang);

const state = { user: null, chats: [], activeId: null, streaming: false };
let abortCtrl = null;

/* ---------- tiny i18n application ---------- */
function applyStaticI18n() {
  document.documentElement.lang = lang;
  $$('[data-i18n]').forEach(n => { n.textContent = T(n.dataset.i18n); });
  $('#msgInput').placeholder = T('iaPh');
  $('#sendBtn').setAttribute('aria-label', T('iaSend'));
  $('#langCur').textContent = lang.toUpperCase().replace('-419', '').replace('-BR', '').replace('-ES', '');
}

/* ---------- language switcher ---------- */
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
    closeLang();
    applyStaticI18n();
    buildLangMenu();
    renderSide();
    renderMain();
  }));
}
function closeLang() { $('#langMenu').hidden = true; $('#langBtn').setAttribute('aria-expanded', 'false'); }
$('#langBtn').addEventListener('click', e => {
  e.stopPropagation();
  const m = $('#langMenu');
  m.hidden = !m.hidden;
  $('#langBtn').setAttribute('aria-expanded', String(!m.hidden));
});
document.addEventListener('click', e => { if (!$('#langSwitch').contains(e.target)) closeLang(); });

/* ---------- markdown (small + safe) ---------- */
function mdToHtml(src, live = false) {
  let text = src;
  if (live && (text.match(/```/g) || []).length % 2 === 1) text += '\n```';
  const blocks = [];
  text = text.replace(/```([\w+#-]*)[^\S\n]*\n([\s\S]*?)```/g, (m, lg, code) => {
    blocks.push({ lang: lg || 'code', code: code.replace(/\n$/, '') });
    return `\u0000B${blocks.length - 1}\u0000`;
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
    if (/^<(h\d|ul|ol|blockquote|hr|pre)|^\u0000B/.test(t)) return t;
    return `<p>${t.replace(/\n/g, '<br>')}</p>`;
  }).join('');
  h = h.replace(/\u0000B(\d+)\u0000/g, (m, i) => {
    const b = blocks[+i];
    if (!b) return '';
    return `<div class="codeblock"><div class="cb-head"><span>${esc(b.lang)}</span><button class="cb-copy" data-code="${encodeURIComponent(b.code)}">${esc(T('iaCopy'))}</button></div><pre><code>${esc(b.code)}</code></pre></div>`;
  });
  return h;
}
const rawOf = new WeakMap(); // content element → raw markdown

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
  if (!state.chats.length) {
    list.innerHTML = `<div class="side-empty"><div class="se-t">${esc(T('iaNoChats'))}</div><div class="se-b">${esc(T('iaNoChatsB'))}</div></div>`;
    return;
  }
  list.innerHTML = state.chats.map((c, i) => `
    <button class="chat-item ${c.id === state.activeId ? 'sel' : ''}" data-id="${c.id}" style="animation-delay:${Math.min(i * 0.03, 0.3)}s">
      <span class="ci-title">${esc(c.title)}</span>
      <span class="ci-sub">${c.preview ? esc(c.preview) : fmtWhen(c.updated)}</span>
      <span class="ci-acts">
        <span class="ci-act" data-act="rename" title="${esc(T('iaRename'))}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></span>
        <span class="ci-act danger" data-act="del" title="${esc(T('iaDel'))}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></span>
      </span>
    </button>`).join('');
}

$('#chatList').addEventListener('click', e => {
  const act = e.target.closest('[data-act]');
  const item = e.target.closest('.chat-item');
  if (!item) return;
  const id = item.dataset.id;
  if (act) {
    e.stopPropagation();
    if (act.dataset.act === 'del') deleteChat(id, item);
    if (act.dataset.act === 'rename') renameChat(id, item);
    return;
  }
  if (state.streaming) return;
  if (id === state.activeId) { closeSideMobile(); return; }
  openChat(id);
});

function renameChat(id, item) {
  const titleEl = item.querySelector('.ci-title');
  const chat = state.chats.find(c => c.id === id);
  if (!titleEl || !chat) return;
  titleEl.outerHTML = `<input class="ci-rename" value="${esc(chat.title)}" maxlength="80">`;
  const inp = item.querySelector('.ci-rename');
  inp.focus(); inp.select();
  let done = false;
  const commit = async (saveIt) => {
    if (done) return; done = true;
    const val = inp.value.trim();
    if (saveIt && val && val !== chat.title) {
      try { await fetchJSON(`/api/chats/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: val }) }); chat.title = val; } catch {}
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
  item.style.opacity = '0.35';
  try { await fetchJSON(`/api/chats/${id}`, { method: 'DELETE' }); } catch {}
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.activeId === id) { state.activeId = null; renderMain(); }
  renderSide();
}

/* ---------- main area ---------- */
const body = $('#iaBody');
const rawTexts = rawOf;

function welcomeHtml() {
  const first = (state.user.name || '').trim().split(/\s+/)[0] || '';
  const sugs = [
    ['✦', 'iaSug1'], ['✉', 'iaSug2'], ['⌘', 'iaSug3'], ['◷', 'iaSug4'],
  ];
  return `
  <div class="welcome">
    <div class="welcome-mark"><span class="dot"></span></div>
    <h1>${esc(T('iaHello', { name: first }))}</h1>
    <div class="w-sub">${esc(T('iaSub'))}</div>
    <div class="suggestions">
      ${sugs.map(([ic, k]) => `<button class="sug" data-sug="${k}"><span class="s-ic">${ic}</span><span>${esc(T(k))}</span></button>`).join('')}
    </div>
  </div>`;
}

function msgUserHtml(text) {
  const initial = (state.user.name || '?').trim().charAt(0).toUpperCase();
  return `
  <div class="msg user">
    <div class="m-avatar">${esc(initial)}</div>
    <div class="m-col">
      <span class="m-who">${esc(T('iaYou'))}</span>
      <div class="m-bubble">${esc(text)}</div>
    </div>
  </div>`;
}
function msgAssistantHtml(content, streaming = false) {
  return `
  <div class="msg turing">
    <div class="m-avatar"><span class="dot"></span></div>
    <div class="m-col">
      <span class="m-who">Turing</span>
      <div class="m-content">${content ? mdToHtml(content, streaming) : `<span class="typing"><i></i><i></i><i></i></span>`}${streaming ? '<span class="cursor"></span>' : ''}</div>
      ${content && !streaming ? `<div class="m-acts"><button class="m-act" data-copy>${COPY_SVG}<span>${esc(T('iaCopy'))}</span></button></div>` : ''}
    </div>
  </div>`;
}
const COPY_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

function threadHtml(chat) {
  const parts = chat.messages.map(m => m.role === 'user' ? msgUserHtml(m.content) : msgAssistantHtml(m.content));
  return `<div class="ia-scroll">${parts.join('')}</div>`;
}

function nearBottom() {
  return body.scrollHeight - body.scrollTop - body.clientHeight < 140;
}
function scrollBottom(force) {
  if (force || nearBottom()) body.scrollTop = body.scrollHeight;
}

function renderMain() {
  if (!state.activeId) {
    body.innerHTML = welcomeHtml();
    $$('.sug', body).forEach(b => b.addEventListener('click', () => {
      const inp = $('#msgInput');
      inp.value = T(b.dataset.sug);
      inp.dispatchEvent(new Event('input'));
      send();
    }));
    return;
  }
  const chat = state.chats.find(c => c.id === state.activeId);
  body.innerHTML = chat ? threadHtml(chat) : welcomeHtml();
  // remember raw text for copy on each assistant message
  if (chat) {
    const els = $$('.msg.turing .m-content', body);
    let ai = 0;
    chat.messages.forEach(m => {
      if (m.role !== 'assistant') return;
      if (els[ai]) rawTexts.set(els[ai], m.content);
      ai++;
    });
  }
  scrollBottom(true);
}

async function openChat(id) {
  state.activeId = id;
  renderSide();
  closeSideMobile();
  body.innerHTML = `<div class="ia-scroll"><div class="msg turing"><div class="m-avatar"><span class="dot"></span></div><div class="m-col"><span class="m-who">Turing</span><div class="m-content"><span class="typing"><i></i><i></i><i></i></span></div></div></div></div>`;
  try {
    const r = await fetchJSON(`/api/chats/${id}`);
    const idx = state.chats.findIndex(c => c.id === id);
    if (idx >= 0) state.chats[idx] = r.chat;
    renderMain();
  } catch {
    body.innerHTML = welcomeHtml();
  }
}

/* ---------- composer / streaming send ---------- */
const input = $('#msgInput');
const sendBtn = $('#sendBtn');

function grow() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 190) + 'px';
  sendBtn.disabled = !input.value.trim() && !state.streaming;
}
input.addEventListener('input', grow);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!state.streaming) send(); }
});
sendBtn.addEventListener('click', () => {
  if (state.streaming) { abortCtrl?.abort(); return; }
  send();
});

function setStreaming(on) {
  state.streaming = on;
  sendBtn.classList.toggle('stop-mode', on);
  sendBtn.setAttribute('aria-label', on ? T('iaStop') : T('iaSend'));
  sendBtn.disabled = on ? false : !input.value.trim();
  input.disabled = false;
}

async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || 'request failed'), { status: r.status, data: j });
  return j;
}

function appendUser(text) {
  let scroll = body.querySelector('.ia-scroll');
  if (!scroll) { body.innerHTML = '<div class="ia-scroll"></div>'; scroll = body.querySelector('.ia-scroll'); }
  scroll.insertAdjacentHTML('beforeend', msgUserHtml(text));
  scrollBottom(true);
  return scroll;
}
function appendAssistantPlaceholder() {
  const scroll = body.querySelector('.ia-scroll');
  scroll.insertAdjacentHTML('beforeend', msgAssistantHtml('', false));
  scrollBottom(true);
  return scroll.querySelector('.msg.turing:last-child .m-content');
}
function appendError(text) {
  const scroll = body.querySelector('.ia-scroll');
  if (scroll) scroll.insertAdjacentHTML('beforeend', `<div class="m-error"><span class="e-ic">⚠</span><span>${esc(text)}</span></div>`);
  scrollBottom(true);
}

async function send() {
  const text = input.value.trim();
  if (!text || state.streaming) return;
  input.value = ''; grow();

  // ensure a conversation exists
  if (!state.activeId) {
    try {
      const r = await fetchJSON('/api/chats', { method: 'POST' });
      state.activeId = r.chat.id;
      state.chats.unshift(r.chat);
      renderSide();
      body.innerHTML = '<div class="ia-scroll"></div>';
    } catch { appendError(T('iaErrGeneric')); return; }
  }

  appendUser(text);
  const chat = state.chats.find(c => c.id === state.activeId);
  if (chat) chat.messages.push({ role: 'user', content: text, at: new Date().toISOString() });

  const contentEl = appendAssistantPlaceholder();
  setStreaming(true);
  abortCtrl = new AbortController();
  let acc = '';
  let raf = 0;
  const paintLive = () => {
    raf = 0;
    contentEl.innerHTML = mdToHtml(acc, true) + '<span class="cursor"></span>';
    scrollBottom(false);
  };

  try {
    const resp = await fetch(`/api/chats/${state.activeId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
      signal: abortCtrl.signal,
    });
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      contentEl.closest('.msg').remove();
      if (resp.status === 429) { $('#limitModal').hidden = false; }
      else if (j.error === 'not_configured') appendError(T('iaErrNoKey'));
      else if (j.error === 'maintenance') appendError(T('iaErrUpstream'));
      else appendError(T('iaErrGeneric'));
      setStreaming(false);
      return;
    }
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let upstreamErr = null;
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
        if (ev.title && chat) { chat.title = ev.title; renderSide(); }
        if (ev.content) {
          acc += ev.content;
          if (!raf) raf = requestAnimationFrame(paintLive);
        }
        if (ev.error) upstreamErr = ev;
      }
    }
    if (raf) cancelAnimationFrame(raf);
    if (upstreamErr) {
      contentEl.closest('.msg').remove();
      appendError(upstreamErr.error === 'network' ? T('iaErrUpstream') : T('iaErrUpstream'));
    } else {
      // finalize
      if (acc) {
        contentEl.innerHTML = mdToHtml(acc);
        rawTexts.set(contentEl, acc);
        contentEl.closest('.m-col').insertAdjacentHTML('beforeend',
          `<div class="m-acts"><button class="m-act" data-copy>${COPY_SVG}<span>${esc(T('iaCopy'))}</span></button></div>`);
        if (chat) chat.messages.push({ role: 'assistant', content: acc, at: new Date().toISOString() });
      } else {
        contentEl.closest('.msg').remove();
        appendError(T('iaErrGeneric'));
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      // user stopped: keep what arrived
      if (raf) cancelAnimationFrame(raf);
      if (acc) {
        contentEl.innerHTML = mdToHtml(acc);
        rawTexts.set(contentEl, acc);
        contentEl.closest('.m-col').insertAdjacentHTML('beforeend',
          `<div class="m-acts"><button class="m-act" data-copy>${COPY_SVG}<span>${esc(T('iaCopy'))}</span></button></div>`);
        if (chat) chat.messages.push({ role: 'assistant', content: acc, at: new Date().toISOString() });
      } else {
        contentEl.closest('.msg').remove();
      }
    } else {
      contentEl.closest('.msg')?.remove();
      appendError(T('iaErrGeneric'));
    }
  } finally {
    setStreaming(false);
    refreshChats();
    setTimeout(() => input.focus(), 30);
  }
}

async function refreshChats() {
  try {
    const r = await fetchJSON('/api/chats');
    state.chats = r.chats;
    renderSide();
  } catch {}
}

/* ---------- copy + other delegated actions ---------- */
body.addEventListener('click', async e => {
  const cb = e.target.closest('.cb-copy');
  if (cb) {
    try { await navigator.clipboard.writeText(decodeURIComponent(cb.dataset.code)); } catch {}
    const old = cb.textContent;
    cb.textContent = T('iaCopied');
    setTimeout(() => { cb.textContent = old; }, 1400);
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const contentEl = cp.closest('.m-col').querySelector('.m-content');
    const raw = rawTexts.get(contentEl) || contentEl.textContent;
    try { await navigator.clipboard.writeText(raw); } catch {}
    const lbl = cp.querySelector('span');
    if (lbl) { lbl.textContent = T('iaCopied'); setTimeout(() => { lbl.textContent = T('iaCopy'); }, 1400); }
  }
});
$('#limitClose').addEventListener('click', () => { $('#limitModal').hidden = true; });

/* ---------- new chat / mobile sidebar ---------- */
$('#newChatBtn').addEventListener('click', () => {
  if (state.streaming) return;
  state.activeId = null;
  renderSide();
  renderMain();
  closeSideMobile();
  setTimeout(() => input.focus(), 40);
});
function closeSideMobile() {
  if (innerWidth <= 860) { $('#iaSide').classList.remove('open'); $('#scrim').hidden = true; }
}
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

  applyStaticI18n();
  buildLangMenu();
  try { state.chats = (await fetchJSON('/api/chats')).chats; } catch {}
  renderSide();
  renderMain();
  $('#iaShell').hidden = false;
  requestAnimationFrame(() => $('#iaShell').classList.add('ready'));
  grow();
  input.focus();
})();
