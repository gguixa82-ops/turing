/* ============ Turing — SPA (i18n, 11 languages) ============ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = s => $(s);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = { site: null, user: null, route: null, researchShown: 0, docsNav: null, researchList: null, lang: TURING_I18N.detectLang() };
document.documentElement.lang = state.lang;

/* ---------- i18n helpers ---------- */
function T(key, vars) { return TURING_I18N.t(state.lang, key, vars); }
function Tdict() { return TURING_I18N.dictFor(state.lang); }
function locale() { return state.lang === 'en' ? 'en-US' : state.lang; }
const slugKey = slug => String(slug).replace(/-/g, '_');
const CAT_KEYS = { 'Context': 'cat_context', 'Design': 'cat_design', 'Memory': 'cat_memory', 'Performance': 'cat_performance', 'Evaluation': 'cat_evaluation', 'Safety': 'cat_safety', 'Output': 'cat_output', 'Systems': 'cat_systems' };
const SEC_KEYS = { 'Getting started': 'sec_getting', 'Core concepts': 'sec_core', 'Guides': 'sec_guides', 'Platform': 'sec_platform' };
function catName(cat) { const k = CAT_KEYS[cat]; return k ? T(k) : cat; }
function secName(sec) { const k = SEC_KEYS[sec]; return k ? T(k) : sec; }
function postTitle(p) { return Tdict()['rp_' + slugKey(p.slug) + '_t'] || p.title; }
function postExcerpt(p) { return Tdict()['rp_' + slugKey(p.slug) + '_e'] || p.excerpt; }
function docTitle(slug) { return Tdict()['doc_' + slugKey(slug) + '_t'] || slug; }
function svcLabel(s, suffix) { const v = Tdict()['svc_' + s.id + (suffix || '')]; return v || (suffix ? s.description : s.name); }

/* ---------- utils ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || 'request failed'), { status: r.status, data: j });
  return j;
}
function fmtDate(dmy) { // '14/09/2026' → localized 'Sep 14, 2026'
  const [d, m, y] = String(dmy).split('/').map(Number);
  try { return new Date(y, m - 1, d).toLocaleDateString(locale(), { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return `${d}/${m}/${y}`; }
}
function fmtDay(ts) {
  try { return new Date(ts).toLocaleDateString(locale(), { month: 'short', day: 'numeric' }); }
  catch { return ''; }
}
function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return T('justNow');
  if (s < 3600) return T('minAgo', { n: Math.floor(s / 60) });
  if (s < 86400) return T('hAgo', { n: Math.floor(s / 3600) });
  return T('dAgo', { n: Math.floor(s / 86400) });
}
function legalDate() {
  try { return new Date(2026, 8, 14).toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return '14/09/2026'; }
}
function apiError(e2, map) {
  const code = e2 && e2.data ? e2.data.error : null;
  if (code && map[code]) return T(map[code]);
  return T('somethingWrong');
}

/* ---------- language switching ---------- */
function closeLangMenu() {
  const m = $('#langMenu'); if (m) m.hidden = true;
  const b = $('#langBtn'); if (b) b.setAttribute('aria-expanded', 'false');
}
function toggleLangMenu() {
  const m = $('#langMenu'); const b = $('#langBtn');
  if (!m || !b) return;
  m.hidden = !m.hidden;
  b.setAttribute('aria-expanded', String(!m.hidden));
}
function setLang(code) {
  if (!TURING_I18N.SUPPORTED.includes(code)) code = 'en';
  if (code === state.lang) { closeLangMenu(); return; }
  state.lang = code;
  try { localStorage.setItem('turing_lang', code); } catch {}
  document.documentElement.lang = code;
  closeMobileMenu();
  if (mobileMenu) { mobileMenu.remove(); mobileMenu = null; }
  withTransition(() => renderRoute(location.pathname, { instant: true }));
}
document.addEventListener('click', e => {
  const sw = $('#langSwitch');
  if (sw && !sw.contains(e.target)) closeLangMenu();
  if (mobileMenu && !e.target.closest('.mobile-menu') && !e.target.closest('#menuBtn') && !e.target.closest('#langSwitch')) closeLangMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLangMenu(); });

const GLOBE_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>';

function langSwitchHtml() {
  const cur = TURING_I18N.LANGS.find(l => l.code === state.lang) || TURING_I18N.LANGS[0];
  const items = TURING_I18N.LANGS.map(l =>
    `<button class="lang-item${l.code === state.lang ? ' sel' : ''}" data-lang="${l.code}"><span>${esc(l.native)}</span>${l.code === state.lang ? '<span class="lk">✓</span>' : ''}</button>`).join('');
  return `
    <div class="lang" id="langSwitch">
      <button class="lang-btn" id="langBtn" aria-label="${esc(T('language'))}" aria-expanded="false">${GLOBE_SVG}<span class="lang-cur">${esc(cur.code.toUpperCase())}</span></button>
      <div class="lang-menu" id="langMenu" hidden>${items}</div>
    </div>`;
}
function wireLangSwitch(scope = document) {
  const btn = $('#langBtn');
  if (btn) btn.addEventListener('click', e => { e.stopPropagation(); toggleLangMenu(); });
  $$('.lang-item', scope).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    setLang(b.dataset.lang);
  }));
}

/* ---------- transition overlay (loading screen) ---------- */
let transitioning = false;
const LOAD_MIN = 520;   // tiempo mínimo que se ve la pantalla de carga (ms)
const LOAD_MAX = 4000;  // tope de espera por contenido asíncrono (ms)
function withTransition(fn) {
  if (reducedMotion) { Promise.resolve().then(fn); return; }
  if (transitioning) { setTimeout(() => withTransition(fn), 120); return; }
  transitioning = true;
  const t = el('#transition');
  t.classList.remove('leaving');
  t.classList.add('active');
  const leave = () => requestAnimationFrame(() => {
    t.classList.add('leaving');
    setTimeout(() => { t.classList.remove('active', 'leaving'); transitioning = false; }, 580);
  });
  setTimeout(async () => {
    const started = Date.now();
    try {
      await Promise.race([
        Promise.resolve().then(fn),
        new Promise(r => setTimeout(r, LOAD_MAX)),
      ]);
    } catch {}
    const wait = LOAD_MIN - (Date.now() - started);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    leave();
  }, 470);
}

/* ---------- router ---------- */
const ROUTES = [
  { re: /^\/$/, view: 'home', titleKey: 'titleHome' },
  { re: /^\/research$/, view: 'research', titleKey: 'titleResearch' },
  { re: /^\/research\/([a-z0-9-]+)$/, view: 'researchPost', param: 1, titleKey: 'titleResearch' },
  { re: /^\/docs$/, view: 'docs', param: 'introduction', titleKey: 'titleDocs' },
  { re: /^\/docs\/([a-z0-9-]+)$/, view: 'docs', param: 1, titleKey: 'titleDocs' },
  { re: /^\/pricing$/, view: 'pricing', titleKey: 'titlePricing' },
  { re: /^\/status$/, view: 'status', titleKey: 'titleStatus' },
  { re: /^\/support$/, view: 'support', titleKey: 'titleSupport' },
  { re: /^\/onboard$/, view: 'onboard', titleKey: 'titleOnboard' },
  { re: /^\/login$/, view: 'login', titleKey: 'titleLogin' },
  { re: /^\/register$/, view: 'register', titleKey: 'titleRegister' },
  { re: /^\/reset$/, view: 'reset', titleKey: 'titleReset' },
  { re: /^\/recovery$/, view: 'recovery', titleKey: 'titleRecovery' },
  { re: /^\/privacy$/, view: 'privacy', titleKey: 'titlePrivacy' },
  { re: /^\/terms$/, view: 'terms', titleKey: 'titleTerms' },
];
function matchRoute(path) {
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) return { ...r, param: typeof r.param === 'number' ? m[r.param] : r.param };
  }
  return { view: 'notFound', titleKey: 'title404' };
}

function go(path) {
  if (path === location.pathname) return;
  withTransition(() => { history.pushState({}, '', path); return renderRoute(path); });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a || a.defaultPrevented) return;
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  // standalone pages (ia.html / account.html …) navigate natively, behind the loading screen
  if (/\/[^/]*\.[a-z0-9]+$/i.test(href)) {
    e.preventDefault();
    closeMobileMenu();
    if (reducedMotion) { location.assign(href); return; }
    const t = el('#transition');
    t.classList.remove('leaving');
    t.classList.add('active');
    setTimeout(() => location.assign(href), 540);
    return;
  }
  e.preventDefault();
  closeMobileMenu();
  go(href);
});
window.addEventListener('popstate', () => renderRoute(location.pathname, { instant: true }));

/* ---------- chrome: header / footer / announce ---------- */
const NAV = [
  { href: '/research', key: 'navResearch' },
  { href: '/docs', key: 'navDocs' },
  { href: '/pricing', key: 'navPricing' },
  { href: '/status', key: 'navStatus' },
  { href: '/support', key: 'navSupport' },
];

function renderHeader() {
  const h = el('#siteHeader');
  const isHome = state.route === 'home';
  const active = state.route === 'research' ? '/research' : state.route === 'docs' ? '/docs' : '';
  h.classList.toggle('sticky', !isHome);
  const chip = state.user ? `
    <a class="hdr-cta" href="/ia.html">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ${esc(T('openAi'))}
    </a>
    <span class="user-chip">
      <span class="avatar">${esc(state.user.name.trim().charAt(0).toUpperCase())}</span>
      <a class="uname" href="/account.html">${esc(state.user.name)}</a>
      <span class="chip-div" aria-hidden="true"></span>
      <button class="uout" data-act="logout" title="${esc(T('signOut'))}" aria-label="${esc(T('signOut'))}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      </button>
    </span>` : '';
  h.innerHTML = `
    <a class="wordmark" href="/">Turing</a>
    <div style="display:flex;align-items:center;gap:6px">
      <nav class="nav">
        ${NAV.map(n => `<a href="${n.href}" class="${active === n.href || (active.startsWith('/docs') && n.href === '/docs') ? 'active' : ''}">${esc(T(n.key))}</a>`).join('')}
        ${chip}
      </nav>
      ${langSwitchHtml()}
      <button class="menu-btn" id="menuBtn" aria-label="${esc(T('menu'))}"><span></span><span></span></button>
    </div>`;
  const mb = $('#menuBtn');
  if (mb) mb.addEventListener('click', toggleMobileMenu);
  wireLangSwitch(h);
  h.querySelector('[data-act="logout"]')?.addEventListener('click', async e => {
    e.preventDefault();
    try { await fetchJSON('/api/auth/logout', { method: 'POST' }); } catch {}
    state.user = null;
    renderHeader();
  });
}

let mobileMenu = null;
function toggleMobileMenu(force) {
  if (!mobileMenu) {
    mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';
    mobileMenu.innerHTML = `
      <div>
        ${NAV.map((n, i) => `<a href="${n.href}" style="transition-delay:${0.05 + i * 0.05}s">${esc(T(n.key))}</a>`).join('')}
        <div class="mm-lang">
          <div class="mm-lang-t">${esc(T('language'))}</div>
          <div class="mm-lang-grid">
            ${TURING_I18N.LANGS.map(l => `<button class="mm-lang-item${l.code === state.lang ? ' sel' : ''}" data-lang="${l.code}">${esc(l.native)}</button>`).join('')}
          </div>
        </div>
        <div class="mm-legal"><a href="/privacy">${esc(T('privacy'))}</a><a href="/terms">${esc(T('terms'))}</a></div>
      </div>`;
    document.body.appendChild(mobileMenu);
    $$('.mm-lang-item', mobileMenu).forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  }
  const btn = $('#menuBtn');
  const open = force !== undefined ? force : !mobileMenu.classList.contains('open');
  mobileMenu.classList.toggle('open', open);
  btn?.classList.toggle('open', open);
  document.body.classList.toggle('lock-scroll', open);
}
function closeMobileMenu() { toggleMobileMenu(false); }

function renderFooter() {
  const f = el('#siteFooter');
  const isHome = state.route === 'home';
  f.hidden = isHome;
  if (isHome) return;
  f.innerHTML = `
    <div class="f-in">
      <span class="f-brand">Turing</span>
      <nav class="f-nav">
        ${NAV.map(n => `<a href="${n.href}">${esc(T(n.key))}</a>`).join('')}
        <a href="/privacy">${esc(T('privacy'))}</a>
        <a href="/terms">${esc(T('terms'))}</a>
      </nav>
      <span class="f-copy">${esc(T('rights'))}</span>
    </div>`;
}

function renderAnnounce() {
  const a = el('#announce');
  const ann = state.site && state.site.announcement;
  if (!ann || !ann.enabled || !ann.text) { a.hidden = true; a.innerHTML = ''; return; }
  if (sessionStorage.getItem('turing_announce_dismissed')) { a.hidden = true; return; }
  a.hidden = false;
  a.innerHTML = `<span class="dot"></span><span>${esc(ann.text)}</span><button class="a-close" aria-label="${esc(T('dismiss'))}">×</button>`;
  a.querySelector('.a-close').addEventListener('click', () => {
    a.hidden = true;
    sessionStorage.setItem('turing_announce_dismissed', '1');
  });
}

/* ---------- views ---------- */

const HOME_FAQ_KEYS = ['hq1', 'hq2', 'hq3', 'hq4', 'hq5', 'hq6'];

function viewHome() {
  const words = T('heroWords');
  const wHtml = words.map((w, i) => `<span class="w"><span class="wi" style="--d:${(0.28 + i * 0.09).toFixed(2)}s">${esc(w)}</span></span>`).join(' ');
  return `
  <section class="home">
    <div class="hero">
      <div class="hero-text">
        <h1 aria-label="${esc(T('heroAria'))}">${wHtml}</h1>
        <p class="hero-sub rv" style="--d:.86s">${esc(T('heroSub'))}</p>
        <div class="hero-cta rv" style="--d:1s">
          <a class="btn btn-primary" href="/register">${esc(T('startFree'))} <span class="arr">→</span></a>
          <a class="link-arrow" href="/docs">${esc(T('seeHow'))} <span>→</span></a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="video-frame">
          <div class="frame-glow"></div>
          <svg class="frame-draw" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0.5" y="0.5" width="99" height="99" rx="2.2" pathLength="1"></rect></svg>
          <video src="https://cdn.oreateai.com/aivideo/videodownload/1818640512.mp4" autoplay loop muted playsinline preload="auto" aria-label="${esc(T('videoAria'))}"></video>
        </div>
        <div class="home-corner">© 2026 Turing</div>
      </div>
    </div>
    <section class="home-faq" id="faq">
      <div class="wrap">
        <div class="home-faq-head">
          <span class="eyebrow rv-fade"><span class="tick"></span>${esc(T('faqEyebrow'))}</span>
          <h2 class="rv" style="--d:.08s">${esc(T('faqTitle'))}</h2>
          <p class="home-faq-sub rv" style="--d:.16s">${esc(T('faqSub'))}</p>
        </div>
        <div class="faq home-faq-list">
          ${HOME_FAQ_KEYS.map((k, i) => `
          <div class="faq-item rv" style="--d:${(0.22 + i * 0.07).toFixed(2)}s">
            <button class="faq-q" data-faq="${i}">${esc(T(k))}<span class="ic"></span></button>
            <div class="faq-a"><div><p>${esc(T('ha' + k.slice(2)))}</p></div></div>
          </div>`).join('')}
        </div>
      </div>
    </section>
  </section>`;
}

const BATCH = 3;

function viewResearch() {
  return `
  <div class="wrap">
    <div class="page-head">
      <span class="eyebrow rv-fade"><span class="tick"></span>${esc(T('navResearch'))}</span>
      <h1 class="rv" style="--d:.08s">${esc(T('researchHead'))}</h1>
      <p class="sub rv" style="--d:.16s">${esc(T('researchSub'))}</p>
    </div>
    <div class="research-grid" id="researchGrid"></div>
    <div class="load-more-row" id="loadMoreRow"></div>
  </div>`;
}

function postCard(p, i, baseDelay = 0) {
  return `
  <a class="post-card rv" style="--d:${(baseDelay + i * 0.09).toFixed(2)}s" href="/research/${p.slug}">
    <div class="pc-top"><span class="chip">${esc(catName(p.category))}</span><span class="pc-date">${fmtDate(p.date)}</span></div>
    <h3>${esc(postTitle(p))}</h3>
    <p>${esc(postExcerpt(p))}</p>
    <div class="pc-foot"><span>${esc(T('minRead', { n: p.readMin }))}</span><span class="pc-go">${esc(T('read'))} <span>→</span></span></div>
  </a>`;
}

async function fillResearch(append) {
  const grid = el('#researchGrid');
  if (!grid) return;
  if (!state.researchList) state.researchList = (await fetchJSON('/api/research')).posts;
  const start = append ? state.researchShown : 0;
  const slice = state.researchList.slice(start, start + BATCH);
  grid.insertAdjacentHTML('beforeend', slice.map((p, i) => postCard(p, i, append ? 0.05 : 0)).join(''));
  state.researchShown += slice.length;
  const row = el('#loadMoreRow');
  if (state.researchShown >= state.researchList.length) {
    row.innerHTML = `<span class="rv-fade" style="font-size:13.5px;color:var(--text-3)">${esc(T('caughtUp'))}</span>`;
  } else {
    row.innerHTML = `<button class="btn-loadmore rv-fade" id="loadMore">${esc(T('loadMore'))} <span class="chev">↓</span></button>`;
    $('#loadMore').addEventListener('click', loadMoreResearch);
  }
}

function loadMoreResearch() {
  const btn = el('#loadMore');
  if (btn) btn.disabled = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    withTransition(() => fillResearch(true));
  }, 420);
}

async function viewResearchPost(slug) {
  let post;
  try { post = await fetchJSON(`/api/research/${slug}`); }
  catch { state.route = null; return viewNotFound(); }
  state.route = 'researchPost';
  const all = state.researchList || (state.researchList = (await fetchJSON('/api/research')).posts);
  const idx = all.findIndex(p => p.slug === slug);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const body = post.body.map((b, i) => {
    const d = (0.18 + i * 0.07).toFixed(2);
    if (b.t === 'h2') return `<h2 style="--d:${d}s">${esc(b.x)}</h2>`;
    if (b.t === 'quote') return `<blockquote style="--d:${d}s">${esc(b.x)}</blockquote>`;
    return `<p style="--d:${d}s">${esc(b.x)}</p>`;
  }).join('');
  document.title = T('titlePost', { t: postTitle(post) });
  return `
  <article class="article">
    <a class="back rv-fade" href="/research"><span>←</span> ${esc(T('navResearch'))}</a>
    <div class="a-meta rv" style="--d:.08s"><span class="chip">${esc(catName(post.category))}</span><span class="m">${fmtDate(post.date)}</span><span class="m">·</span><span class="m">${esc(T('minRead', { n: post.readMin }))}</span></div>
    <h1 class="rv" style="--d:.14s">${esc(postTitle(post))}</h1>
    ${state.lang !== 'en' ? `<div class="content-note rv" style="--d:.16s">${esc(T('contentNote'))}</div>` : ''}
    <div class="body">${body}</div>
    <div class="a-nav">
      ${prev ? `<a href="/research/${prev.slug}"><div class="lbl">← ${esc(T('prevPost'))}</div><div class="ttl">${esc(postTitle(prev))}</div></a>` : '<a class="empty"></a>'}
      ${next ? `<a class="next" href="/research/${next.slug}"><div class="lbl">${esc(T('nextPost'))} →</div><div class="ttl">${esc(postTitle(next))}</div></a>` : '<a class="empty"></a>'}
    </div>
  </article>`;
}

async function viewDocs(slug) {
  if (!state.docsNav) state.docsNav = (await fetchJSON('/api/docs')).docs;
  let doc;
  try { doc = await fetchJSON(`/api/docs/${slug}`); }
  catch { state.route = null; return viewNotFound(); }
  document.title = T('titleDoc', { t: docTitle(doc.slug || slug) });
  const sections = [...new Set(state.docsNav.map(d => d.section))];
  const side = sections.map(sec => `
    <div class="ds-sec">${esc(secName(sec))}</div>
    ${state.docsNav.filter(d => d.section === sec).map(d => `
      <a href="/docs/${d.slug}" class="${d.slug === doc.slug ? 'active' : ''}">${esc(docTitle(d.slug))}${d.comingSoon ? `<span class="soon">${esc(T('soon'))}</span>` : ''}</a>`).join('')}
  `).join('');
  const idx = state.docsNav.findIndex(d => d.slug === doc.slug);
  const prev = idx > 0 ? state.docsNav[idx - 1] : null;
  const next = idx >= 0 && idx < state.docsNav.length - 1 ? state.docsNav[idx + 1] : null;
  const comingHero = doc.comingSoon ? `
    <div class="coming-hero rv" style="--d:.1s">
      <span class="badge-coming"><span class="dot"></span>${esc(T('comingSoon'))}</span>
      <h2>${esc(T('apiWayT'))}</h2>
      <p class="ch-sub">${esc(T('apiWayB'))}</p>
    </div>` : '';
  return `
  <div class="docs">
    <aside class="docs-side rv-fade" style="--d:.06s">${side}</aside>
    <div class="docs-main">
      <div class="d-crumb rv-fade" style="--d:.1s">${esc(T('docsCrumb'))} / ${esc(secName(doc.section))}</div>
      <h1 class="rv" style="--d:.14s">${esc(docTitle(doc.slug || slug))}</h1>
      ${state.lang !== 'en' ? `<div class="content-note rv" style="--d:.16s">${esc(T('contentNote'))}</div>` : ''}
      ${comingHero}
      <div class="body">${docBodyHtml(doc.body)}</div>
      <div class="d-links">
        ${prev ? `<a href="/docs/${prev.slug}">← ${esc(docTitle(prev.slug))}</a>` : '<span></span>'}
        ${next ? `<a href="/docs/${next.slug}">${esc(docTitle(next.slug))} →</a>` : '<span></span>'}
      </div>
    </div>
  </div>`;
}

function docBodyHtml(blocks) {
  let html = '', list = false, i = 0;
  const closeList = () => { if (list) { html += '</ul>'; list = false; } };
  blocks.forEach(b => {
    const d = (200 + i * 55);
    i++;
    if (b.t === 'li') {
      if (!list) { html += `<ul style="--d:${d}ms">`; list = true; }
      html += `<li>${esc(b.x)}</li>`;
      return;
    }
    closeList();
    if (b.t === 'h2') html += `<h2 style="--d:${d}ms">${esc(b.x)}</h2>`;
    else if (b.t === 'quote') html += `<div style="--d:${d}ms"><blockquote>${esc(b.x)}</blockquote></div>`;
    else html += `<div style="--d:${d}ms"><p>${esc(b.x)}</p></div>`;
  });
  closeList();
  return html;
}

/* pricing */
function plans() {
  return [
    { name: 'Free', badge: 'now', badgeLabel: T('badgeNow'), desc: T('planFreeDesc'), price: '$0', per: T('freeForever'), feats: [T('freeF1'), T('freeF2'), T('freeF3'), T('freeF4')], cta: T('startFree'), href: '/register', featured: true },
    { name: 'Maker', badge: 'soon', badgeLabel: T('badgeSoon'), desc: T('planMakerDesc'), tbd: true, feats: [T('makerF1'), T('makerF2'), T('makerF3'), T('makerF4')], cta: T('comingSoon') },
    { name: 'Expert', badge: 'soon', badgeLabel: T('badgeSoon'), desc: T('planExpertDesc'), tbd: true, feats: [T('expertF1'), T('expertF2'), T('expertF3'), T('expertF4')], cta: T('comingSoon') },
    { name: 'Core', badge: 'soon', badgeLabel: T('badgeSoon'), desc: T('planCoreDesc'), tbd: true, feats: [T('coreF1'), T('coreF2'), T('coreF3'), T('coreF4')], cta: T('comingSoon') },
    { name: 'Enterprise', badge: 'soon', badgeLabel: T('badgeSoon'), desc: T('planEntDesc'), tbd: true, feats: [T('entF1'), T('entF2'), T('entF3'), T('entF4')], cta: T('comingSoon') },
  ];
}
const PRICING_FAQ_KEYS = ['pq1', 'pq2', 'pq3', 'pq4'];

function viewPricing() {
  const PLANS = plans();
  return `
  <div class="pricing">
    <div class="pricing-bg" aria-hidden="true"><div class="orb orb1"></div><div class="orb orb2"></div></div>
    <div class="wrap">
      <div class="page-head" style="text-align:center">
        <span class="eyebrow rv-fade" style="justify-content:center"><span class="tick"></span>${esc(T('navPricing'))}</span>
        <h1 class="rv" style="--d:.08s">${esc(T('pricingHead'))}</h1>
        <p class="sub rv" style="--d:.16s;margin:0 auto">${esc(T('pricingSub'))}</p>
      </div>
      <div class="pricing-grid">
        ${PLANS.map((p, i) => `
        <div class="plan ${p.featured ? 'featured' : ''}" style="--i:${i}">
          <span class="p-badge ${p.badge === 'now' ? 'now' : 'soon'}"><span class="dot"></span>${esc(p.badgeLabel)}</span>
          <h3>${esc(p.name)}</h3>
          <p class="p-desc">${esc(p.desc)}</p>
          <div class="p-price">${p.price ? `<span class="amt">${esc(p.price)}</span><span class="per">${esc(p.per)}</span>` : `<span class="tbd">${esc(T('priceTbd'))}</span>`}</div>
          <div class="p-div"></div>
          <ul class="p-feats">
            ${p.feats.map(f => `<li><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.8l2.6 2.7L10.5 3.6" stroke="rgba(245,245,245,0.55)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${esc(f)}</span></li>`).join('')}
          </ul>
          ${p.href ? `<a class="btn btn-primary p-cta" href="${p.href}">${esc(p.cta)}</a>` : `<button class="btn btn-ghost p-cta" disabled>${esc(p.cta)}</button>`}
        </div>`).join('')}
      </div>
      <p class="pricing-note rv-fade" style="--d:.9s">${esc(T('pricingNote'))}</p>
      <div class="faq">
        <h2 class="rv" style="--d:1s">${esc(T('pqTitle'))}</h2>
        ${PRICING_FAQ_KEYS.map((k, i) => `
        <div class="faq-item rv" style="--d:${(1.05 + i * 0.08).toFixed(2)}s">
          <button class="faq-q" data-faq="${i}">${esc(T(k))}<span class="ic"></span></button>
          <div class="faq-a"><div><p>${esc(T('pa' + k.slice(2)))}</p></div></div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function onFaq() {
  $$('.faq-q').forEach(btn => btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const open = item.classList.contains('open');
    $$('.faq-item.open').forEach(x => x.classList.remove('open'));
    if (!open) item.classList.add('open');
  }));
}

/* status */
function incStamp(iso) {
  try { return new Date(iso).toLocaleString(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
function svcById(svc, id) {
  const s = svc.find(x => x.id === id);
  return s ? svcLabel(s) : T('incAllSvc');
}
async function viewStatus() {
  const data = await fetchJSON('/api/status');
  const svc = data.services;
  const worst = svc.some(s => s.status === 'outage') ? 'bad' : svc.some(s => s.status === 'degraded') ? 'warn' : 'ok';
  const title = worst === 'ok' ? T('stOk') : worst === 'warn' ? T('stWarn') : T('stBad');
  const incs = data.incidents || [];
  const active = incs.filter(i => !i.resolved);
  const resolved = incs.filter(i => i.resolved).slice(0, 8);
  const sevKey = i => i.severity === 'outage' ? 'incOutage' : i.severity === 'maintenance' ? 'incMaint' : 'incDegraded';
  return `
  <div class="wrap">
    <div class="page-head" style="padding-bottom:26px">
      <span class="eyebrow rv-fade"><span class="tick"></span>${esc(T('navStatus'))}</span>
    </div>
    <div class="status-head rv" style="--d:.1s"><span class="status-dot ${worst}"></span><span class="status-title">${esc(title)}</span></div>
    <p class="status-updated rv" style="--d:.16s">${esc(T('stUpdated', { t: timeAgo(data.updated) }))}</p>
    <div class="svc-grid">
      ${svc.map((s, si) => `
      <div class="svc-card rv" style="--d:${(0.2 + si * 0.09).toFixed(2)}s">
        <div class="s-top"><span class="s-name">${esc(svcLabel(s))}</span><span class="status-dot ${s.status === 'ok' ? 'ok' : s.status === 'degraded' ? 'warn' : 'bad'}" style="width:10px;height:10px"></span></div>
        <div class="s-desc">${esc(svcLabel(s, '_d'))}</div>
        <div class="s-strip">${s.history.map((v, i) => `<i class="${v === 'degraded' ? 'd' : v === 'outage' ? 'o' : ''}" style="--d:${i * 6 + si * 40}ms"></i>`).join('')}</div>
      </div>`).join('')}
    </div>
    <div class="status-label rv" style="--d:.5s"><span>${esc(T('history90'))}</span>
      <span class="legend">
        <span><i style="background:rgba(62,207,142,0.55)"></i>${esc(T('legendOk'))}</span>
        <span><i style="background:var(--amber)"></i>${esc(T('legendDeg'))}</span>
        <span><i style="background:var(--red)"></i>${esc(T('legendOut'))}</span>
      </span>
    </div>
    ${active.length ? `
    <div class="inc-pub rv" style="--d:.52s">
      <div class="inc-pub-head"><span class="inc-live-dot ${worst === 'ok' ? 'warn' : worst}"></span>${esc(T('incActiveT'))}</div>
      ${active.map(i => `
      <div class="inc-pub-item ${i.severity}">
        <div class="ip-top">
          <span class="ip-sev">${esc(T(sevKey(i)))}</span>
          <span class="ip-svc">${esc(svcById(svc, i.serviceId))}</span>
          <span class="ip-time">${esc(T('incPosted', { t: timeAgo(i.created) }))}</span>
        </div>
        <div class="ip-title">${esc(i.title)}</div>
        <div class="ip-msg">${esc(i.message)}</div>
        ${(i.updates && i.updates.length) ? `<ul class="ip-updates">${i.updates.map(u => `<li><span class="iu-t">${esc(incStamp(u.at))}</span><span>${esc(u.text)}</span></li>`).join('')}</ul>` : ''}
      </div>`).join('')}
    </div>` : ''}
    <div class="incidents rv" style="--d:.6s">
      <div class="inc-h">${esc(T('incHistT'))}</div>
      ${resolved.length ? resolved.map(i => `
        <div class="incident">
          <span class="i-dot ${i.severity === 'outage' ? 'o' : 'd'}"></span>
          <div><div class="i-title">${esc(i.title)}</div>
          <div class="i-sub">${esc(T('incResolvedOn', { t: incStamp(i.resolvedAt || i.created) }))} · ${esc(svcById(svc, i.serviceId))}</div></div>
          <span class="i-date">${fmtDay(new Date(i.resolvedAt || i.created).getTime())}</span>
        </div>`).join('') : `<div class="no-incidents">${esc(T('noIncidents'))}</div>`}
    </div>
  </div>`;
}

/* support */
const TOPIC_KEYS = [
  ['General', 'topGeneral'], ['Bug report', 'topBug'], ['Feature request', 'topFeature'],
  ['API access', 'topApi'], ['Billing', 'topBilling'], ['Other', 'topOther'],
];

function viewSupport() {
  return `
  <div class="wrap">
    <div class="page-head">
      <span class="eyebrow rv-fade"><span class="tick"></span>${esc(T('navSupport'))}</span>
      <h1 class="rv" style="--d:.08s">${esc(T('supportHead'))}</h1>
      <p class="sub rv" style="--d:.16s">${esc(T('supportSub'))}</p>
    </div>
    <div class="support-grid">
      <div>
        <form id="supportForm" novalidate>
          <div class="field-row">
            <div class="field" data-f="name"><label for="s-name">${esc(T('fName'))}</label><input id="s-name" name="name" type="text" placeholder="${esc(T('phName'))}" autocomplete="name"><span class="err">${esc(T('errName'))}</span></div>
            <div class="field" data-f="email"><label for="s-email">${esc(T('fEmail'))}</label><input id="s-email" name="email" type="email" placeholder="${esc(T('phEmail'))}" autocomplete="email"><span class="err">${esc(T('errEmail'))}</span></div>
          </div>
          <div class="field"><label for="s-topic">${esc(T('fTopic'))}</label>
            <select id="s-topic" name="topic">
              ${TOPIC_KEYS.map(([v, k]) => `<option value="${esc(v)}">${esc(T(k))}</option>`).join('')}
            </select>
          </div>
          <div class="field" data-f="message"><label for="s-msg">${esc(T('fMessage'))}</label><textarea id="s-msg" name="message" placeholder="${esc(T('phMessage'))}"></textarea><span class="err">${esc(T('errMessage'))}</span></div>
          <button class="btn btn-primary" type="submit" style="width:100%">${esc(T('send'))} <span class="arr">→</span></button>
        </form>
      </div>
      <div class="support-info">
        <div class="info-card rv" style="--d:.2s"><div class="ic-t"><span>⏱</span>${esc(T('infoRt'))}</div><div class="ic-b">${esc(T('infoRtB'))}</div></div>
        <div class="info-card rv" style="--d:.3s"><div class="ic-t"><span>◈</span>${esc(T('infoApi'))}</div><div class="ic-b">${esc(T('infoApiB'))}</div></div>
        <div class="info-card rv" style="--d:.4s"><div class="ic-t"><span>▤</span>${esc(T('infoBefore'))}</div><div class="ic-b">${T('infoBeforeB', { status: `<a href="/status" style="color:var(--text);font-weight:600">${esc(T('statusPage'))}</a>` })}</div></div>
      </div>
    </div>
  </div>`;
}

function onSupport() {
  const form = el('#supportForm');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    let ok = true;
    const mark = (f, bad) => { form.querySelector(`[data-f="${f}"]`).classList.toggle('invalid', bad); if (bad) ok = false; };
    mark('name', !data.name.trim());
    mark('email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()));
    mark('message', !data.message.trim());
    if (!ok) return;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${esc(T('sending'))}`;
    try {
      await fetchJSON('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      form.closest('.support-grid').firstElementChild.innerHTML = `
        <div class="success-view">
          <svg viewBox="0 0 80 80" fill="none"><circle class="sv-circle" cx="40" cy="40" r="36" stroke-width="1.5"/><path class="sv-check" d="M26 41.5l9.5 9.5L55 30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <h2>${esc(T('msgOk'))}</h2>
          <p>${T('msgOkB', { email: `<b>${esc(data.email.trim())}</b>` })}</p>
        </div>`;
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${esc(T('send'))} <span class="arr">→</span>`;
    }
  });
}

/* ---------- auth ---------- */
let philTimer = null;

function authShell(viewName, cardInner, title) {
  return `
  <section class="auth">
    <div class="auth-side" aria-hidden="true">
      <div class="auth-side-lines">
        <i style="left:12%;animation-delay:0s"></i><i style="left:32%;animation-delay:-3s"></i><i style="left:52%;animation-delay:-6s"></i><i style="left:72%;animation-delay:-9s"></i><i style="left:90%;animation-delay:-12s"></i>
      </div>
      <div class="auth-side-glow"></div>
      <div class="phil" id="phil">
        <div class="phil-phrase" id="philPhrase"></div>
        <div class="phil-index"><span id="philIdx">01</span> / 06</div>
      </div>
      <div class="auth-side-mark"><span class="dot"></span>Turing</div>
    </div>
    <div class="auth-main">
      <div class="auth-card">
        <a class="a-logo" href="/">Turing</a>
        <h1 class="rv" style="--d:.05s">${esc(title)}</h1>
        ${cardInner}
      </div>
    </div>
  </section>`;
}

function startPhilosophy() {
  const phrase = el('#philPhrase');
  const idx = el('#philIdx');
  if (!phrase) { clearInterval(philTimer); return; }
  const PHIL = [1, 2, 3, 4, 5, 6].map(i => T('phil' + i));
  let i = 0;
  const show = () => {
    const text = PHIL[i];
    const words = text.split(' ');
    phrase.innerHTML = words.map((w, wi) => `<span class="pw" style="--d:${(wi * 0.075).toFixed(3)}s">${esc(w)}</span>`).join(' ');
    idx.textContent = String(i + 1).padStart(2, '0');
    phrase.classList.remove('out');
    phrase.classList.add('in');
    setTimeout(() => phrase.classList.add('out'), 3400);
    setTimeout(() => { phrase.classList.remove('in'); i = (i + 1) % PHIL.length; show(); }, 3900);
  };
  show();
  clearInterval(philTimer);
}

function blockBanner(text) {
  return `<div class="banner"><span class="b-ic">⚠</span><span>${text}</span></div>`;
}
function pwField(id, label, value = '') {
  return `<div class="field">
    <label for="${id}">${label}</label>
    <div class="pw-wrap"><input id="${id}" type="password" autocomplete="new-password" value="${esc(value)}"><button type="button" class="pw-toggle" data-target="${id}">${esc(T('show'))}</button></div>
  </div>`;
}
function bindPwToggles() {
  $$('.pw-toggle').forEach(b => b.addEventListener('click', () => {
    const inp = el('#' + b.dataset.target);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.textContent = show ? T('hide') : T('show');
  }));
}
function asyncSubmit(btn, fn) {
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> …';
  fn().finally(() => { btn.disabled = false; btn.innerHTML = orig; });
}

function viewLogin() {
  const blocked = state.site && state.site.blockLogins;
  return authShell('login', `
    <p class="a-sub rv" style="--d:.1s">${esc(T('loginSub'))}</p>
    ${blocked ? blockBanner(esc(T('blockLogins'))) : ''}
    <form id="loginForm" novalidate ${blocked ? 'data-disabled="1"' : ''}>
      <div class="field"><label for="l-email">${esc(T('fEmail'))}</label><input id="l-email" type="email" placeholder="${esc(T('phEmail'))}" autocomplete="email"></div>
      <div class="field"><label for="l-pass">${esc(T('fPassword'))}<a href="/reset" style="float:right;color:var(--text-3);font-weight:500;font-size:12.5px">${esc(T('forgot'))}</a></label>
        <div class="pw-wrap"><input id="l-pass" type="password" autocomplete="current-password"><button type="button" class="pw-toggle" data-target="l-pass">${esc(T('show'))}</button></div>
      </div>
      <div id="loginErr" class="form-err" hidden></div>
      <button class="btn btn-primary" type="submit" style="width:100%">${esc(T('loginTitle'))} <span class="arr">→</span></button>
    </form>
    <p class="a-alt rv" style="--d:.2s">${esc(T('noAccount'))} <a href="/register">${esc(T('createOne'))}</a></p>`, T('loginTitle'));
}

function onLogin() {
  const form = el('#loginForm');
  if (!form) return;
  bindPwToggles();
  if (form.dataset.disabled) { $$('input, button', form).forEach(x => x.disabled = true); return; }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = el('#loginErr');
    err.style.display = 'none';
    asyncSubmit(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await fetchJSON('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: $('#l-email').value, password: $('#l-pass').value }) });
        state.user = r.user;
        renderHeader();
        const next = new URLSearchParams(location.search).get('next') || '';
        if (next.startsWith('/') && !next.startsWith('//')) {
          withTransition(() => location.assign(next));
        } else {
          withTransition(() => { history.pushState({}, '', '/'); return renderRoute('/'); });
        }
      } catch (e2) {
        err.textContent = apiError(e2, { invalid: 'e_invalidCreds', blocked: 'e_blockedLogin', banned: 'e_bannedLogin' });
        err.style.display = 'block';
      }
    });
  });
}

function viewRegister() {
  const blocked = state.site && state.site.blockRegistrations;
  return authShell('register', `
    <p class="a-sub rv" style="--d:.1s">${esc(T('regSub'))}</p>
    ${blocked ? blockBanner(esc(T('blockRegs'))) : ''}
    <form id="regForm" novalidate ${blocked ? 'data-disabled="1"' : ''}>
      <div class="field"><label for="r-name">${esc(T('fName'))}</label><input id="r-name" type="text" placeholder="${esc(T('namePh'))}" autocomplete="name"></div>
      <div class="field"><label for="r-email">${esc(T('fEmail'))}</label><input id="r-email" type="email" placeholder="${esc(T('phEmail'))}" autocomplete="email"></div>
      <div class="field"><label for="r-pass">${esc(T('fPassword'))}</label>
        <div class="pw-wrap"><input id="r-pass" type="password" placeholder="${esc(T('passPh'))}" autocomplete="new-password"><button type="button" class="pw-toggle" data-target="r-pass">${esc(T('show'))}</button></div>
      </div>
      <div class="field"><label for="r-pass2">${esc(T('fConfirm'))}</label>
        <div class="pw-wrap"><input id="r-pass2" type="password" autocomplete="new-password"><button type="button" class="pw-toggle" data-target="r-pass2">${esc(T('show'))}</button></div>
      </div>
      <div id="regErr" style="font-size:13px;color:var(--red);margin-bottom:14px;display:none"></div>
      <button class="btn btn-primary" type="submit" style="width:100%">${esc(T('createAccount'))} <span class="arr">→</span></button>
    </form>
    <p class="a-alt rv" style="--d:.2s">${esc(T('haveAccount'))} <a href="/login">${esc(T('loginTitle'))}</a></p>`, T('regTitle'));
}

function onRegister() {
  const form = el('#regForm');
  if (!form) return;
  bindPwToggles();
  if (form.dataset.disabled) { $$('input, button', form).forEach(x => x.disabled = true); return; }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = el('#regErr');
    err.style.display = 'none';
    const name = $('#r-name').value.trim(), email = $('#r-email').value.trim(), p1 = $('#r-pass').value, p2 = $('#r-pass2').value;
    if (p1 !== p2) { err.textContent = T('pwMismatch'); err.style.display = 'block'; return; }
    asyncSubmit(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await fetchJSON('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password: p1 }) });
        state.user = r.user;
        renderHeader();
        withTransition(() => { history.pushState({}, '', '/onboard'); return renderRoute('/onboard'); });
      } catch (e2) {
        err.textContent = apiError(e2, { invalid: 'e_regInvalid', exists: 'e_exists', blocked: 'e_blockedReg' });
        err.style.display = 'block';
      }
    });
  });
}

function viewReset() {
  return authShell('reset', `
    <p class="a-sub rv" style="--d:.1s">${esc(T('resetSub'))}</p>
    <form id="resetForm" novalidate>
      <div class="field"><label for="rt-email">${esc(T('fEmail'))}</label><input id="rt-email" type="email" placeholder="${esc(T('phEmail'))}" autocomplete="email"></div>
      <button class="btn btn-primary" type="submit" style="width:100%">${esc(T('sendReset'))} <span class="arr">→</span></button>
    </form>
    <p class="a-alt rv" style="--d:.2s">${esc(T('remembered'))} <a href="/login">${esc(T('loginTitle'))}</a></p>`, T('resetTitle'));
}

function onReset() {
  const form = el('#resetForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = $('#rt-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    const card = form.closest('.auth-card');
    asyncSubmit(form.querySelector('button[type=submit]'), async () => {
      const r = await fetchJSON('/api/auth/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const title = r.state === 'sent' ? T('checkInbox') : r.state === 'not_configured' ? T('almostThere') : T('requestReceived');
      const msg = r.state === 'not_configured'
        ? esc(T('notConfigured')).replace('config.json', '<b style="color:var(--text)">config.json</b>')
        : T('resetSent', { email: `<b style="color:var(--text)">${esc(email)}</b>` });
      card.innerHTML = `<a class="a-logo" href="/">Turing</a>
        <div class="sent-state">
          <span class="s-ic">✉</span>
          <h3>${esc(title)}</h3>
          <p>${msg}</p>
          <a class="btn btn-ghost" href="/login" style="margin-top:8px">${esc(T('backSignIn'))}</a>
        </div>`;
    });
  });
}

function viewRecovery() {
  return authShell('recovery', `
    <p class="a-sub rv" style="--d:.1s">${esc(T('validating'))}</p>
    <div id="recoverBox"></div>
    <p class="a-alt rv" style="--d:.2s"><a href="/reset">${esc(T('linkExpired'))}</a> &nbsp;·&nbsp; <a href="/login">${esc(T('backSignIn'))}</a></p>`, T('recTitle'));
}

function expiredBox(msg) {
  return `<div class="sent-state"><span class="s-ic">⌛</span><h3>${esc(T('expT'))}</h3><p>${esc(msg)}</p><a class="btn btn-ghost" href="/reset" style="margin-top:8px">${esc(T('requestNew'))}</a></div>`;
}

async function onRecovery() {
  const box = el('#recoverBox');
  if (!box) return;
  const token = new URLSearchParams(location.search).get('token') || '';
  try {
    const r = await fetchJSON(`/api/auth/recovery-check?token=${encodeURIComponent(token)}`);
    if (!r.valid) { box.innerHTML = expiredBox(T('expB')); return; }
  } catch {
    box.innerHTML = expiredBox(T('expB2'));
    return;
  }
  box.innerHTML = `
    <form id="recForm" novalidate>
      <div class="field"><label for="n-pass">${esc(T('fNewPass'))}</label>
        <div class="pw-wrap"><input id="n-pass" type="password" placeholder="${esc(T('passPh'))}" autocomplete="new-password"><button type="button" class="pw-toggle" data-target="n-pass">${esc(T('show'))}</button></div>
      </div>
      <div class="field"><label for="n-pass2">${esc(T('fConfirmNew'))}</label>
        <div class="pw-wrap"><input id="n-pass2" type="password" autocomplete="new-password"><button type="button" class="pw-toggle" data-target="n-pass2">${esc(T('show'))}</button></div>
      </div>
      <div id="recErr" style="font-size:13px;color:var(--red);margin-bottom:14px;display:none"></div>
      <button class="btn btn-primary" type="submit" style="width:100%">${esc(T('setNewPass'))} <span class="arr">→</span></button>
    </form>`;
  bindPwToggles();
  box.querySelector('#recForm').addEventListener('submit', e => {
    e.preventDefault();
    const err = el('#recErr');
    err.style.display = 'none';
    const p1 = $('#n-pass').value, p2 = $('#n-pass2').value;
    if (p1 !== p2) { err.textContent = T('pwMismatch'); err.style.display = 'block'; return; }
    asyncSubmit(box.querySelector('button[type=submit]'), async () => {
      try {
        await fetchJSON('/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: p1 }) });
        box.innerHTML = `<div class="sent-state"><span class="s-ic">✓</span><h3>${esc(T('pwOkT'))}</h3><p>${esc(T('pwOkB'))}</p><a class="btn btn-primary" href="/login" style="margin-top:8px">${esc(T('loginTitle'))} <span class="arr">→</span></a></div>`;
      } catch (e2) {
        err.textContent = apiError(e2, { expired: 'e_recExpired', invalid: 'e_recShort' });
        err.style.display = 'block';
      }
    });
  });
}

/* ---------- onboarding ---------- */
const USAGE_KEYS = [
  ['Writing', 'useWriting'], ['Research', 'useResearch'], ['Coding', 'useCoding'],
  ['Learning', 'useLearning'], ['Planning', 'usePlanning'], ['Ideas & thinking', 'useIdeas'],
];

function onbWords(text, base = 0.16, gap = 0.085) {
  return text.split(' ').map((w, i) => `<span class="w"><span class="wi" style="--d:${(base + i * gap).toFixed(3)}s">${w}</span></span>`).join(' ');
}

function viewOnboard() {
  return `
  <section class="onb">
    <div class="onb-progress" aria-hidden="true"><div class="onb-progress-fill" id="onbFill"></div></div>
    <div class="onb-stage" id="onbStage"></div>
  </section>`;
}

async function onOnboard() {
  if (!state.user) { go('/login'); return; }
  let onboard = null;
  try { onboard = (await fetchJSON('/api/onboard')).onboard; } catch {}
  const stage = el('#onbStage');
  const fill = el('#onbFill');
  const first = state.user.name.trim().split(' ')[0];
  const sel = { age: null, usage: new Set(), terms: false };
  const STEPS = 5; // welcome..done

  function setProgress(i) { fill.style.width = `${(i / STEPS) * 100}%`; }
  function words(h, base = 0.16, gap = 0.085) { return onbWords(h, base, gap); }

  function stepHtml(i) {
    if (i === 0) return `
      <div class="onb-step" data-step="0">
        <span class="onb-eyebrow rv-fade">${esc(T('onbEyebrow'))}</span>
        <h1>${words(esc(T('onbWelcome', { name: first })))}</h1>
        <p class="onb-sub rv" style="--d:.7s">${esc(T('onbSub'))}</p>
        <button class="btn btn-primary onb-next" style="margin-top:34px">${esc(T('letsGo'))} <span class="arr">→</span></button>
      </div>`;
    if (i === 1) return `
      <div class="onb-step" data-step="1">
        <span class="onb-eyebrow rv-fade">${esc(T('step', { n: '01' }))}</span>
        <h1>${words(esc(T('ageT')))}</h1>
        <p class="onb-sub rv" style="--d:.6s">${esc(T('ageSub'))}</p>
        <div class="onb-age rv" style="--d:.7s">
          <input id="ageInput" type="text" inputmode="numeric" placeholder="${esc(T('agePh'))}" maxlength="3" autocomplete="off">
        </div>
        <div class="onb-warn" id="ageWarn" hidden>${esc(T('ageWarn'))}</div>
        <button class="btn btn-primary onb-next" disabled style="margin-top:30px">${esc(T('continue_'))} <span class="arr">→</span></button>
      </div>`;
    if (i === 2) return `
      <div class="onb-step" data-step="2">
        <span class="onb-eyebrow rv-fade">${esc(T('step', { n: '02' }))}</span>
        <h1>${words(esc(T('useT')))}</h1>
        <p class="onb-sub rv" style="--d:.6s">${esc(T('useSub'))}</p>
        <div class="onb-chips rv" style="--d:.7s" id="usageChips">
          ${USAGE_KEYS.map(([v, k]) => `<button class="chip-opt" data-usage="${esc(v)}">${esc(T(k))}</button>`).join('')}
        </div>
        <button class="btn btn-primary onb-next" style="margin-top:30px">${esc(T('continue_'))} <span class="arr">→</span></button>
      </div>`;
    if (i === 3) return `
      <div class="onb-step" data-step="3">
        <span class="onb-eyebrow rv-fade">${esc(T('step', { n: '03' }))}</span>
        <h1>${words(esc(T('thinkT')))}</h1>
        <p class="onb-sub rv" style="--d:.6s">${esc(T('thinkSub'))}</p>
        <div class="onb-cards">
          <div class="onb-card rv" style="--d:.75s"><div class="oc-n">01</div><h3>${esc(T('oc1t'))}</h3><p>${esc(T('oc1b'))}</p></div>
          <div class="onb-card rv" style="--d:.9s"><div class="oc-n">02</div><h3>${esc(T('oc2t'))}</h3><p>${esc(T('oc2b'))}</p></div>
          <div class="onb-card rv" style="--d:1.05s"><div class="oc-n">03</div><h3>${esc(T('oc3t'))}</h3><p>${esc(T('oc3b'))}</p></div>
        </div>
        <button class="btn btn-primary onb-next" style="margin-top:30px">${esc(T('gotIt'))} <span class="arr">→</span></button>
      </div>`;
    if (i === 4) return `
      <div class="onb-step" data-step="4">
        <span class="onb-eyebrow rv-fade">${esc(T('step', { n: '04' }))}</span>
        <h1>${words(esc(T('beforeT')))}</h1>
        <div class="onb-terms rv" style="--d:.6s">
          <div class="ot-row"><span class="ot-k">${esc(T('otData'))}</span><span>${T('otDataB', { privacy: `<a href="/privacy">${esc(T('privacyPolicy'))}</a>` })}</span></div>
          <div class="ot-row"><span class="ot-k">${esc(T('otAi'))}</span><span>${esc(T('otAiB'))}</span></div>
          <div class="ot-row"><span class="ot-k">${esc(T('otRights'))}</span><span>${esc(T('otRightsB'))}</span></div>
        </div>
        <label class="onb-check rv" style="--d:.75s">
          <input type="checkbox" id="termsCheck">
          <span class="onb-box" aria-hidden="true"><svg viewBox="0 0 12 10" fill="none"><path d="M1.5 5.2l3 3L10.5 1.6" stroke="#0A0A0A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span>${T('onbAgree', { terms: `<a href="/terms">${esc(T('termsService'))}</a>`, privacy: `<a href="/privacy">${esc(T('privacyPolicy'))}</a>` })}</span>
        </label>
        <button class="btn btn-primary onb-next" disabled style="margin-top:26px">${esc(T('finish'))} <span class="arr">→</span></button>
      </div>`;
    // 5 = done
    return `
      <div class="onb-step onb-final" data-step="5">
        <div class="onb-sparks" aria-hidden="true">
          <span style="--x:-90px;--y:-120px;--d:.05s"></span><span style="--x:70px;--y:-150px;--d:.15s"></span><span style="--x:-140px;--y:-40px;--d:.25s"></span><span style="--x:130px;--y:-70px;--d:.35s"></span><span style="--x:-40px;--y:-180px;--d:.45s"></span><span style="--x:30px;--y:-110px;--d:.55s"></span>
        </div>
        <svg class="onb-checkmark" viewBox="0 0 80 80" fill="none"><circle class="sv-circle" cx="40" cy="40" r="36" stroke-width="1.5"/><path class="sv-check" d="M26 41.5l9.5 9.5L55 30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h1>${words(esc(T('finalT', { name: first })), 0.5)}</h1>
        <p class="onb-sub rv" style="--d:1.1s">${esc(T('finalSub'))}</p>
        <a class="btn btn-primary rv onb-final-cta" style="--d:1.3s" href="/ia.html">${esc(T('startConv'))} <span class="arr">→</span></a>
      </div>`;
  }

  function renderStep(i, animate = true) {
    setProgress(i);
    if (animate) {
      const prev = stage.firstElementChild;
      if (prev) {
        prev.classList.add('out');
        setTimeout(() => paint(i), 260);
        return;
      }
    }
    paint(i);
    function paint(idx) {
      stage.innerHTML = stepHtml(idx);
      wire(idx);
    }
  }

  function wire(i) {
    const step = stage.querySelector('.onb-step');
    step.classList.add('in');
    const next = step.querySelector('.onb-next');
    if (i === 0 && next) next.addEventListener('click', () => renderStep(1));
    if (i === 1) {
      const ageInput = el('#ageInput');
      const validateAge = () => {
        const raw = ageInput.value.trim();
        const n = /^\d{1,3}$/.test(raw) ? parseInt(raw, 10) : null;
        const warn = el('#ageWarn');
        if (raw === '' || n === null) { warn.hidden = true; sel.age = null; next.disabled = true; return; }
        if (n < 13) { warn.hidden = false; sel.age = String(n); next.disabled = true; return; }
        warn.hidden = true; sel.age = String(n); next.disabled = false;
      };
      if (ageInput) { ageInput.addEventListener('input', validateAge); setTimeout(() => ageInput.focus(), 60); }
      next?.addEventListener('click', () => renderStep(2));
    }
    if (i === 2) {
      $$('.chip-opt', step).forEach(c => c.addEventListener('click', () => {
        c.classList.toggle('sel');
        if (c.classList.contains('sel')) sel.usage.add(c.dataset.usage); else sel.usage.delete(c.dataset.usage);
      }));
      next?.addEventListener('click', () => renderStep(3));
    }
    if (i === 3 && next) next.addEventListener('click', () => renderStep(4));
    if (i === 4) {
      const chk = el('#termsCheck');
      chk?.addEventListener('change', () => { sel.terms = chk.checked; next.disabled = !chk.checked; });
      next?.addEventListener('click', async () => {
        next.disabled = true;
        next.innerHTML = `<span class="spinner"></span> ${esc(T('saving'))}`;
        try {
          await fetchJSON('/api/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ageBracket: sel.age, useCases: [...sel.usage], acceptedTerms: true }) });
          renderStep(5);
        } catch (e2) {
          next.disabled = false;
          next.innerHTML = `${esc(T('finish'))} <span class="arr">→</span>`;
        }
      });
    }
  }

  renderStep(onboard ? 5 : 0, false);
}

/* ---------- legal ---------- */
function privacySections() {
  return [
    [T('pr1t'), T('pr1b')], [T('pr2t'), T('pr2b')], [T('pr3t'), T('pr3b')],
    [T('pr4t'), T('pr4b')], [T('pr5t'), T('pr5b')], [T('pr6t'), T('pr6b')],
  ];
}
function termsSections() {
  return [
    [T('tm1t'), T('tm1b')], [T('tm2t'), T('tm2b')], [T('tm3t'), T('tm3b')], [T('tm4t'), T('tm4b')],
    [T('tm5t'), T('tm5b')], [T('tm6t'), T('tm6b')], [T('tm7t'), T('tm7b')], [T('tm8t'), T('tm8b')],
  ];
}
function legalView(title, sections) {
  return `
  <div class="legal">
    <h1 class="rv">${esc(title)}</h1>
    <p class="l-date rv" style="--d:.08s">${esc(T('effective', { date: legalDate() }))}</p>
    <div class="body">${sections.map(([h, c], i) => {
      const d = (0.12 + i * 0.06).toFixed(2);
      const body = Array.isArray(c) ? `<ul style="--d:${d}s">${c.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p style="--d:${d}s">${esc(c)}</p>`;
      return `<h2 style="--d:${d}s">${esc(h)}</h2>${body}`;
    }).join('')}</div>
  </div>`;
}
const viewPrivacy = () => legalView(T('privacyTitle'), privacySections());
const viewTerms = () => legalView(T('termsTitle'), termsSections());

function viewNotFound() {
  return `
  <div class="nf">
    <div class="nf-bg"></div>
    <div class="nf-num">
      <span style="--i:0">4</span><span class="solid" style="--i:1">0</span><span style="--i:2">4</span>
    </div>
    <h1 class="rv" style="--d:.2s">${esc(T('nfT'))}</h1>
    <p class="rv" style="--d:.3s">${esc(T('nfB'))}</p>
    <a class="btn btn-primary rv" style="--d:.4s" href="/">${esc(T('backHome'))} <span class="arr">→</span></a>
  </div>`;
}

function viewMaintenance() {
  return `
  <div class="maint">
    <div class="m-ring"><i></i><i></i><i></i><span class="core"></span></div>
    <h1 class="rv" style="--d:.15s">${esc(T('maintT'))}</h1>
    <p class="rv" style="--d:.25s">${esc(T('maintB'))}</p>
    <div class="m-foot rv-fade" style="--d:.4s">${esc(T('maintFoot'))}</div>
  </div>`;
}

/* ---------- render ---------- */
const VIEWS = {
  home: { html: viewHome, onEnter: onFaq },
  research: { html: viewResearch, onEnter: () => { state.researchShown = 0; el('#researchGrid').innerHTML = ''; fillResearch(false); } },
  researchPost: { html: viewResearchPost },
  docs: { html: viewDocs },
  pricing: { html: viewPricing, onEnter: onFaq },
  status: { html: viewStatus },
  support: { html: viewSupport, onEnter: onSupport },
  onboard: { html: viewOnboard, onEnter: onOnboard },
  login: { html: viewLogin, onEnter: onLogin },
  register: { html: viewRegister, onEnter: onRegister },
  reset: { html: viewReset, onEnter: onReset },
  recovery: { html: viewRecovery, onEnter: onRecovery },
  privacy: { html: viewPrivacy },
  terms: { html: viewTerms },
  notFound: { html: viewNotFound },
  maintenance: { html: viewMaintenance },
};

async function refreshSite() {
  try { state.site = await fetchJSON('/api/site'); } catch { return; }
  renderAnnounce();
  if (state.site.maintenance && state.route !== 'maintenance') {
    state.route = 'maintenance';
    document.title = T('titleMaintenance');
    el('#siteHeader').innerHTML = '';
    el('#siteFooter').hidden = true;
    el('#page').innerHTML = VIEWS.maintenance.html();
  }
}

function renderRoute(path, { instant = false } = {}) {
  const route = matchRoute(String(path).split('?')[0]);
  state.route = route.view;
  document.title = T(route.titleKey);
  refreshSite();
  renderHeader();
  renderFooter();

  // auth redirects
  if (state.user && ['login', 'register', 'reset'].includes(route.view)) {
    history.replaceState({}, '', '/');
    return renderRoute('/');
  }

  const apply = () => {
    const v = VIEWS[route.view];
    el('#page').innerHTML = '';
    const finish = html => {
      el('#page').innerHTML = html;
      window.scrollTo(0, 0);
      if (v.onEnter) v.onEnter(route.param);
      startPhilosophy();
    };
    const p = v.html(route.param, new URLSearchParams(location.search));
    if (p && p.then) return p.then(finish).catch(() => finish(viewNotFound()));
    finish(p);
    return Promise.resolve();
  };

  return apply();
}

/* ---------- boot ---------- */
async function boot() {
  try { state.site = await fetchJSON('/api/site'); }
  catch { state.site = { maintenance: false, blockLogins: false, blockRegistrations: false, announcement: { enabled: false, text: '' } }; }
  try { const me = await fetchJSON('/api/auth/me'); state.user = me.user; } catch {}
  renderAnnounce();
  if (state.site.maintenance) {
    state.route = 'maintenance';
    document.title = T('titleMaintenance');
    el('#siteHeader').innerHTML = '';
    el('#siteFooter').hidden = true;
    el('#page').innerHTML = VIEWS.maintenance.html();
    return;
  }
  renderRoute(location.pathname);
}
boot();
