/* ============ Turing — SPA ============ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = s => $(s);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = { site: null, user: null, route: null, researchShown: 0, docsNav: null, researchList: null };

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
function fmtDate(dmy) { // '14/09/2026' → 'Sep 14, 2026'
  const [d, m, y] = String(dmy).split('/').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
/* ---------- transition overlay ---------- */
let transitioning = false;
function withTransition(fn) {
  if (reducedMotion) { fn(); return; }
  if (transitioning) { setTimeout(() => withTransition(fn), 120); return; }
  transitioning = true;
  const t = el('#transition');
  t.classList.remove('leaving');
  t.classList.add('active');
  setTimeout(() => {
    fn();
    requestAnimationFrame(() => {
      t.classList.add('leaving');
      setTimeout(() => { t.classList.remove('active', 'leaving'); transitioning = false; }, 580);
    });
  }, 470);
}

/* ---------- router ---------- */
const ROUTES = [
  { re: /^\/$/, view: 'home', title: 'Turing — Serious questions, serious answers' },
  { re: /^\/research$/, view: 'research', title: 'Research — Turing' },
  { re: /^\/research\/([a-z0-9-]+)$/, view: 'researchPost', param: 1, title: 'Research — Turing' },
  { re: /^\/docs$/, view: 'docs', param: 'introduction', title: 'Docs — Turing' },
  { re: /^\/docs\/([a-z0-9-]+)$/, view: 'docs', param: 1, title: 'Docs — Turing' },
  { re: /^\/pricing$/, view: 'pricing', title: 'Pricing — Turing' },
  { re: /^\/status$/, view: 'status', title: 'Status — Turing' },
  { re: /^\/support$/, view: 'support', title: 'Support — Turing' },
  { re: /^\/onboard$/, view: 'onboard', title: 'Welcome — Turing' },
  { re: /^\/login$/, view: 'login', title: 'Sign in — Turing' },
  { re: /^\/register$/, view: 'register', title: 'Create account — Turing' },
  { re: /^\/reset$/, view: 'reset', title: 'Reset password — Turing' },
  { re: /^\/recovery$/, view: 'recovery', title: 'New password — Turing' },
  { re: /^\/privacy$/, view: 'privacy', title: 'Privacy — Turing' },
  { re: /^\/terms$/, view: 'terms', title: 'Terms — Turing' },
];
function matchRoute(path) {
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (m) return { ...r, param: typeof r.param === 'number' ? m[r.param] : r.param };
  }
  return { view: 'notFound', title: '404 — Turing' };
}

function go(path) {
  if (path === location.pathname) return;
  withTransition(() => { history.pushState({}, '', path); renderRoute(path); });
}
document.addEventListener('click', e => {
  const a = e.target.closest('a');
  if (!a || a.defaultPrevented) return;
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return;
  if (a.target === '_blank' || a.hasAttribute('download')) return;
  e.preventDefault();
  closeMobileMenu();
  go(href);
});
window.addEventListener('popstate', () => renderRoute(location.pathname, { instant: true }));

/* ---------- chrome: header / footer / announce ---------- */
const NAV = [
  { href: '/research', label: 'Research' },
  { href: '/docs', label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/status', label: 'Status' },
  { href: '/support', label: 'Support' },
];

function renderHeader() {
  const h = el('#siteHeader');
  const isHome = state.route === 'home';
  const active = state.route === 'research' ? '/research' : state.route === 'docs' ? '/docs' : '';
  h.classList.toggle('sticky', !isHome);
  const chip = state.user ? `
    <span class="user-chip">
      <span class="avatar">${esc(state.user.name.trim().charAt(0).toUpperCase())}</span>
      <span class="uname">${esc(state.user.name)}</span>
      <button class="uout" data-act="logout" title="Sign out">Sign out</button>
    </span>` : '';
  h.innerHTML = `
    <a class="wordmark" href="/">Turing</a>
    <div style="display:flex;align-items:center;gap:6px">
      <nav class="nav">
        ${NAV.map(n => `<a href="${n.href}" class="${active === n.href || (active.startsWith('/docs') && n.href === '/docs') ? 'active' : ''}">${n.label}</a>`).join('')}
        ${chip}
      </nav>
      <button class="menu-btn" id="menuBtn" aria-label="Menu"><span></span><span></span></button>
    </div>`;
  const mb = $('#menuBtn');
  if (mb) mb.addEventListener('click', toggleMobileMenu);
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
        ${NAV.map((n, i) => `<a href="${n.href}" style="transition-delay:${0.05 + i * 0.05}s">${n.label}</a>`).join('')}
        <div class="mm-legal"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
      </div>`;
    document.body.appendChild(mobileMenu);
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
        ${NAV.map(n => `<a href="${n.href}">${n.label}</a>`).join('')}
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
      <span class="f-copy">© 2026 Turing. All rights reserved.</span>
    </div>`;
}

function renderAnnounce() {
  const a = el('#announce');
  const ann = state.site && state.site.announcement;
  if (!ann || !ann.enabled || !ann.text) { a.hidden = true; a.innerHTML = ''; return; }
  if (sessionStorage.getItem('turing_announce_dismissed')) { a.hidden = true; return; }
  a.hidden = false;
  a.innerHTML = `<span class="dot"></span><span>${esc(ann.text)}</span><button class="a-close" aria-label="Dismiss">×</button>`;
  a.querySelector('.a-close').addEventListener('click', () => {
    a.hidden = true;
    sessionStorage.setItem('turing_announce_dismissed', '1');
  });
}

/* ---------- views ---------- */

const HOME_FAQS = [
  { q: 'What exactly is Turing?', a: 'A conversational AI built for precise reasoning. It works through your question step by step, leads with the answer, and shows the support only when it earns its place. No filler, no hedging.' },
  { q: 'How much does it cost?', a: 'The Free plan is live today and free forever — unlimited conversations, core reasoning, conversation memory, email support. The other plans are in development and will go live on the pricing page when they are ready.' },
  { q: 'What does the memory actually do?', a: 'Facts you state stay in the conversation, attributed to you and never invented. If it does not remember something, it says so. Nothing is carried across without you.' },
  { q: 'How is my data handled?', a: 'Your name, email and conversations exist to run the service. No selling, no ads, no tracking. You can ask to see, correct or delete everything at any time from the support page — a person reads it.' },
  { q: 'Can it be wrong?', a: 'Yes — any system that reasons can be wrong. Turing labels its guesses, says "I don\'t know" when it should, and states its confidence when it can. Verify anything with real stakes: medical, legal, financial, safety-critical.' },
  { q: 'Is there an API yet?', a: 'Not yet — no keys, no endpoints. When it ships, the full reference lands in the docs. Leave a note on the support page with "API access" as the topic and you will be told the day it opens.' },
];

function viewHome() {
  const words = ['Serious', 'questions,', 'serious', 'answers.'];
  const wHtml = words.map((w, i) => `<span class="w"><span class="wi" style="--d:${(0.28 + i * 0.09).toFixed(2)}s">${w}</span></span>`).join(' ');
  return `
  <section class="home">
    <div class="hero">
      <div class="hero-text">
        <h1 aria-label="Serious questions, serious answers.">${wHtml}</h1>
        <p class="hero-sub rv" style="--d:.86s">Precise reasoning. Real memory. Zero filler.</p>
        <div class="hero-cta rv" style="--d:1s">
          <a class="btn btn-primary" href="/register">Start for free <span class="arr">→</span></a>
          <a class="link-arrow" href="/docs">See how it works <span>→</span></a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="video-frame">
          <div class="frame-glow"></div>
          <svg class="frame-draw" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0.5" y="0.5" width="99" height="99" rx="2.2" pathLength="1"></rect></svg>
          <video src="https://cdn.oreateai.com/aivideo/videodownload/1818640512.mp4" autoplay loop muted playsinline preload="auto" aria-label="Turing in action"></video>
        </div>
        <div class="home-corner">© 2026 Turing</div>
      </div>
    </div>
    <section class="home-faq" id="faq">
      <div class="wrap">
        <div class="home-faq-head">
          <span class="eyebrow rv-fade"><span class="tick"></span>FAQ</span>
          <h2 class="rv" style="--d:.08s">Frequently asked questions</h2>
          <p class="home-faq-sub rv" style="--d:.16s">The short version of everything. For the rest, the support page has a person on the other side.</p>
        </div>
        <div class="faq home-faq-list">
          ${HOME_FAQS.map((f, i) => `
          <div class="faq-item rv" style="--d:${(0.22 + i * 0.07).toFixed(2)}s">
            <button class="faq-q" data-faq="${i}">${f.q}<span class="ic"></span></button>
            <div class="faq-a"><div><p>${f.a}</p></div></div>
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
      <span class="eyebrow rv-fade"><span class="tick"></span>Research</span>
      <h1 class="rv" style="--d:.08s">Notes from the core team</h1>
      <p class="sub rv" style="--d:.16s">How Turing is built — context, memory, latency, and the unglamorous parts that make a thinking partner feel alive.</p>
    </div>
    <div class="research-grid" id="researchGrid"></div>
    <div class="load-more-row" id="loadMoreRow"></div>
  </div>`;
}

function postCard(p, i, baseDelay = 0) {
  return `
  <a class="post-card rv" style="--d:${(baseDelay + i * 0.09).toFixed(2)}s" href="/research/${p.slug}">
    <div class="pc-top"><span class="chip">${esc(p.category)}</span><span class="pc-date">${fmtDate(p.date)}</span></div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.excerpt)}</p>
    <div class="pc-foot"><span>${p.readMin} min read</span><span class="pc-go">Read <span>→</span></span></div>
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
    row.innerHTML = `<span class="rv-fade" style="font-size:13.5px;color:var(--text-3)">You're all caught up. That's everything for now.</span>`;
  } else {
    row.innerHTML = `<button class="btn-loadmore rv-fade" id="loadMore">Load more research <span class="chev">↓</span></button>`;
    $('#loadMore').addEventListener('click', loadMoreResearch);
  }
}

function loadMoreResearch() {
  const btn = el('#loadMore');
  if (btn) btn.disabled = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    withTransition(() => { fillResearch(true); });
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
  document.title = `${post.title} — Research — Turing`;
  return `
  <article class="article">
    <a class="back rv-fade" href="/research"><span>←</span> Research</a>
    <div class="a-meta rv" style="--d:.08s"><span class="chip">${esc(post.category)}</span><span class="m">${fmtDate(post.date)}</span><span class="m">·</span><span class="m">${post.readMin} min read</span></div>
    <h1 class="rv" style="--d:.14s">${esc(post.title)}</h1>
    <div class="body">${body}</div>
    <div class="a-nav">
      ${prev ? `<a href="/research/${prev.slug}"><div class="lbl">← Previous</div><div class="ttl">${esc(prev.title)}</div></a>` : '<a class="empty"></a>'}
      ${next ? `<a class="next" href="/research/${next.slug}"><div class="lbl">Next →</div><div class="ttl">${esc(next.title)}</div></a>` : '<a class="empty"></a>'}
    </div>
  </article>`;
}

async function viewDocs(slug) {
  if (!state.docsNav) state.docsNav = (await fetchJSON('/api/docs')).docs;
  let doc;
  try { doc = await fetchJSON(`/api/docs/${slug}`); }
  catch { state.route = null; return viewNotFound(); }
  document.title = `${doc.title} — Docs — Turing`;
  const sections = [...new Set(state.docsNav.map(d => d.section))];
  const side = sections.map(sec => `
    <div class="ds-sec">${esc(sec)}</div>
    ${state.docsNav.filter(d => d.section === sec).map(d => `
      <a href="/docs/${d.slug}" class="${d.slug === doc.slug ? 'active' : ''}">${esc(d.title)}${d.comingSoon ? '<span class="soon">Soon</span>' : ''}</a>`).join('')}
  `).join('');
  const idx = state.docsNav.findIndex(d => d.slug === doc.slug);
  const prev = idx > 0 ? state.docsNav[idx - 1] : null;
  const next = idx >= 0 && idx < state.docsNav.length - 1 ? state.docsNav[idx + 1] : null;
  const comingHero = doc.comingSoon ? `
    <div class="coming-hero rv" style="--d:.1s">
      <span class="badge-coming"><span class="dot"></span>Coming soon</span>
      <h2>The API is on its way</h2>
      <p class="ch-sub">No keys, no endpoints, no reference — yet. When it ships, the full documentation lands here first.</p>
    </div>` : '';
  return `
  <div class="docs">
    <aside class="docs-side rv-fade" style="--d:.06s">${side}</aside>
    <div class="docs-main">
      <div class="d-crumb rv-fade" style="--d:.1s">Docs / ${esc(doc.section)}</div>
      <h1 class="rv" style="--d:.14s">${esc(doc.title)}</h1>
      ${comingHero}
      <div class="body">${docBodyHtml(doc.body)}</div>
      <div class="d-links">
        ${prev ? `<a href="/docs/${prev.slug}">← ${esc(prev.title)}</a>` : '<span></span>'}
        ${next ? `<a href="/docs/${next.slug}">${esc(next.title)} →</a>` : '<span></span>'}
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
const PLANS = [
  { name: 'Free', badge: 'now', badgeLabel: 'Available now', desc: 'The full conversation experience. No strings, no trial clock.', price: '$0', per: 'free forever', feats: ['Unlimited conversations', 'Core reasoning', 'Conversation memory', 'Email support'], cta: 'Start for free', href: '/register', featured: true },
  { name: 'Maker', badge: 'soon', badgeLabel: 'Coming soon', desc: 'For people building alongside Turing every day.', tbd: true, feats: ['Everything in Free', 'Longer context window', 'Faster responses', 'Priority queue'], cta: 'Coming soon' },
  { name: 'Expert', badge: 'soon', badgeLabel: 'Coming soon', desc: 'For deep, long-running work and heavy daily use.', tbd: true, feats: ['Everything in Maker', 'Deep research threads', 'Custom workflows', 'Early access features'], cta: 'Coming soon' },
  { name: 'Core', badge: 'soon', badgeLabel: 'Coming soon', desc: 'For teams that think together, in one place.', tbd: true, feats: ['Everything in Expert', 'Shared workspaces', 'Team memory', 'Admin controls'], cta: 'Coming soon' },
  { name: 'Enterprise', badge: 'soon', badgeLabel: 'Coming soon', desc: 'For organizations with serious requirements.', tbd: true, feats: ['Everything in Core', 'SSO and security review', 'Dedicated support', 'Custom terms'], cta: 'Coming soon' },
];
const FAQS = [
  { q: 'When do the other plans launch?', a: 'Maker, Expert, Core and Enterprise are in development. When a plan is ready, its card here turns live first — and we keep the Free plan exactly as it is today. There is no "launch surprise" that changes what Free includes.' },
  { q: 'Does the Free plan expire?', a: 'No. Free is not a trial. It has no date, no usage cliff, and no upgrade nags. If a future paid feature becomes part of the core experience, it will stay available on Free — that is the point of the plan.' },
  { q: 'What happens to my conversations when a plan launches?', a: 'Nothing. Your conversations and memory stay with you. Plan changes affect what is available, not what you already have. You choose when and if to move.' },
  { q: 'How do I get access to the API?', a: 'There is no public API yet — no keys, no endpoints. When it ships, the docs page for API access is where the full reference lands. Leave a note on the support page with "API access" as the topic and a person will tell you the day it opens.' },
];

function viewPricing() {
  return `
  <div class="pricing">
    <div class="pricing-bg" aria-hidden="true"><div class="orb orb1"></div><div class="orb orb2"></div></div>
    <div class="wrap">
      <div class="page-head" style="text-align:center">
        <span class="eyebrow rv-fade" style="justify-content:center"><span class="tick"></span>Pricing</span>
        <h1 class="rv" style="--d:.08s">Start free. Stay sharp.</h1>
        <p class="sub rv" style="--d:.16s;margin:0 auto">One plan is live today. The rest are being built — and when they land, this page is where you will see it first.</p>
      </div>
      <div class="pricing-grid">
        ${PLANS.map((p, i) => `
        <div class="plan ${p.featured ? 'featured' : ''}" style="--i:${i}">
          <span class="p-badge ${p.badge === 'now' ? 'now' : 'soon'}"><span class="dot"></span>${p.badgeLabel}</span>
          <h3>${p.name}</h3>
          <p class="p-desc">${p.desc}</p>
          <div class="p-price">${p.price ? `<span class="amt">${p.price}</span><span class="per">${p.per}</span>` : '<span class="tbd">Price at launch</span>'}</div>
          <div class="p-div"></div>
          <ul class="p-feats">
            ${p.feats.map(f => `<li><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.8l2.6 2.7L10.5 3.6" stroke="rgba(245,245,245,0.55)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${f}</span></li>`).join('')}
          </ul>
          ${p.href ? `<a class="btn btn-primary p-cta" href="${p.href}">${p.cta}</a>` : `<button class="btn btn-ghost p-cta" disabled>${p.cta}</button>`}
        </div>`).join('')}
      </div>
      <p class="pricing-note rv-fade" style="--d:.9s">Free is free. The rest arrives when it is ready.</p>
      <div class="faq">
        <h2 class="rv" style="--d:1s">Questions, answered</h2>
        ${FAQS.map((f, i) => `
        <div class="faq-item rv" style="--d:${(1.05 + i * 0.08).toFixed(2)}s">
          <button class="faq-q" data-faq="${i}">${f.q}<span class="ic"></span></button>
          <div class="faq-a"><div><p>${f.a}</p></div></div>
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
async function viewStatus() {
  const data = await fetchJSON('/api/status');
  const svc = data.services;
  const worst = svc.some(s => s.status === 'outage') ? 'bad' : svc.some(s => s.status === 'degraded') ? 'warn' : 'ok';
  const title = worst === 'ok' ? 'All systems operational' : worst === 'warn' ? 'Partial performance degradation' : 'Disruption in progress';
  const incidents = [];
  svc.forEach(s => {
    let run = null;
    for (let i = 0; i < 90; i++) {
      const v = s.history[i];
      if (v !== 'ok') {
        if (!run) run = { name: s.name, start: i, end: i, worst: v };
        else { run.end = i; if (v === 'outage') run.worst = 'outage'; }
      } else if (run) { incidents.push(run); run = null; }
    }
    if (run) incidents.push(run);
  });
  incidents.sort((a, b) => b.end - a.end);
  const day = i => new Date(Date.now() - (89 - i) * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `
  <div class="wrap">
    <div class="page-head" style="padding-bottom:26px">
      <span class="eyebrow rv-fade"><span class="tick"></span>Status</span>
    </div>
    <div class="status-head rv" style="--d:.1s"><span class="status-dot ${worst}"></span><span class="status-title">${title}</span></div>
    <p class="status-updated rv" style="--d:.16s">Updated ${timeAgo(data.updated)} · last 90 days</p>
    <div class="svc-grid">
      ${svc.map((s, si) => `
      <div class="svc-card rv" style="--d:${(0.2 + si * 0.09).toFixed(2)}s">
        <div class="s-top"><span class="s-name">${esc(s.name)}</span><span class="status-dot ${s.status === 'ok' ? 'ok' : s.status === 'degraded' ? 'warn' : 'bad'}" style="width:10px;height:10px"></span></div>
        <div class="s-desc">${esc(s.description)}</div>
        <div class="s-strip">${s.history.map((v, i) => `<i class="${v === 'degraded' ? 'd' : v === 'outage' ? 'o' : ''}" style="--d:${i * 6 + si * 40}ms"></i>`).join('')}</div>
      </div>`).join('')}
    </div>
    <div class="status-label rv" style="--d:.5s"><span>90-day history</span>
      <span class="legend">
        <span><i style="background:rgba(62,207,142,0.55)"></i>Operational</span>
        <span><i style="background:var(--amber)"></i>Degraded</span>
        <span><i style="background:var(--red)"></i>Outage</span>
      </span>
    </div>
    <div class="incidents rv" style="--d:.56s">
      ${incidents.length ? incidents.slice(0, 6).map(inc => `
        <div class="incident">
          <span class="i-dot ${inc.worst === 'outage' ? 'o' : 'd'}"></span>
          <div><div class="i-title">${esc(inc.name)} — ${inc.worst === 'outage' ? 'Outage' : 'Degraded performance'}</div>
          <div class="i-sub">Resolved · history ${day(inc.start)} – ${day(inc.end)}</div></div>
          <span class="i-date">${day(inc.end)}</span>
        </div>`).join('') : '<div class="no-incidents">No incidents in the last 90 days.</div>'}
    </div>
  </div>`;
}

/* support */
function viewSupport() {
  return `
  <div class="wrap">
    <div class="page-head">
      <span class="eyebrow rv-fade"><span class="tick"></span>Support</span>
      <h1 class="rv" style="--d:.08s">Talk to a person</h1>
      <p class="sub rv" style="--d:.16s">Bug, idea, problem with a memory, or a note for the API team — it all lands on a real inbox that a person reads.</p>
    </div>
    <div class="support-grid">
      <div>
        <form id="supportForm" novalidate>
          <div class="field-row">
            <div class="field" data-f="name"><label for="s-name">Name</label><input id="s-name" name="name" type="text" placeholder="Your name" autocomplete="name"><span class="err">Please tell us your name.</span></div>
            <div class="field" data-f="email"><label for="s-email">Email</label><input id="s-email" name="email" type="email" placeholder="you@example.com" autocomplete="email"><span class="err">A valid email lets us reply.</span></div>
          </div>
          <div class="field"><label for="s-topic">Topic</label>
            <select id="s-topic" name="topic">
              <option>General</option><option>Bug report</option><option>Feature request</option><option>API access</option><option>Billing</option><option>Other</option>
            </select>
          </div>
          <div class="field" data-f="message"><label for="s-msg">Message</label><textarea id="s-msg" name="message" placeholder="What is on your mind?"></textarea><span class="err">A message, even a short one.</span></div>
          <button class="btn btn-primary" type="submit" style="width:100%">Send message <span class="arr">→</span></button>
        </form>
      </div>
      <div class="support-info">
        <div class="info-card rv" style="--d:.2s"><div class="ic-t"><span>⏱</span>Response time</div><div class="ic-b">Every message is answered within 24 hours on working days. Usually much faster.</div></div>
        <div class="info-card rv" style="--d:.3s"><div class="ic-t"><span>◈</span>API access</div><div class="ic-b">There is no public API yet — no keys, no endpoints. If you are waiting for it, choose "API access" as the topic and you will be told the day it opens.</div></div>
        <div class="info-card rv" style="--d:.4s"><div class="ic-t"><span>▤</span>Before you write</div><div class="ic-b">If it is about the product not working, check the <a href="/status" style="color:var(--text);font-weight:600">status page</a> first — it keeps 90 days of history.</div></div>
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
    btn.innerHTML = '<span class="spinner"></span> Sending…';
    try {
      await fetchJSON('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      form.closest('.support-grid').firstElementChild.innerHTML = `
        <div class="success-view">
          <svg viewBox="0 0 80 80" fill="none"><circle class="sv-circle" cx="40" cy="40" r="36" stroke-width="1.5"/><path class="sv-check" d="M26 41.5l9.5 9.5L55 30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <h2>Message received</h2>
          <p>We will reply to <b>${esc(data.email.trim())}</b> by email within 24 hours on working days. No chat, no tickets — the conversation continues in your inbox.</p>
        </div>`;
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = 'Send message <span class="arr">→</span>';
    }
  });
}

/* ---------- auth ---------- */
const PHIL = [
  'Most answers are noise with confidence.',
  'The first question is the easy part.',
  'Clarity is a discipline, not a style.',
  'Think quietly. Answer sharply.',
  'You do not need more information. You need better questions.',
  'A good conversation makes you sharper than the debate.',
];
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
        <div class="phil-index"><span id="philIdx">01</span> / 0${PHIL.length}</div>
      </div>
      <div class="auth-side-mark"><span class="dot"></span>Turing</div>
    </div>
    <div class="auth-main">
      <div class="auth-card">
        <a class="a-logo" href="/">Turing</a>
        <h1 class="rv" style="--d:.05s">${title}</h1>
        ${cardInner}
      </div>
    </div>
  </section>`;
}

function startPhilosophy() {
  const phrase = el('#philPhrase');
  const idx = el('#philIdx');
  if (!phrase) { clearInterval(philTimer); return; }
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
    <div class="pw-wrap"><input id="${id}" type="password" autocomplete="new-password" value="${esc(value)}"><button type="button" class="pw-toggle" data-target="${id}">SHOW</button></div>
  </div>`;
}
function bindPwToggles() {
  $$('.pw-toggle').forEach(b => b.addEventListener('click', () => {
    const inp = el('#' + b.dataset.target);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.textContent = show ? 'HIDE' : 'SHOW';
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
    <p class="a-sub rv" style="--d:.1s">Welcome back. The conversation continues.</p>
    ${blocked ? blockBanner('Logins are temporarily disabled. We will turn them back on shortly.') : ''}
    <form id="loginForm" novalidate ${blocked ? 'data-disabled="1"' : ''}>
      <div class="field"><label for="l-email">Email</label><input id="l-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
      <div class="field"><label for="l-pass">Password <a href="/reset" style="float:right;color:var(--text-3);font-weight:500;font-size:12.5px">Forgot?</a></label>
        <div class="pw-wrap"><input id="l-pass" type="password" autocomplete="current-password"><button type="button" class="pw-toggle" data-target="l-pass">SHOW</button></div>
      </div>
      <div id="loginErr" class="form-err" hidden></div>
      <button class="btn btn-primary" type="submit" style="width:100%">Sign in <span class="arr">→</span></button>
    </form>
    <p class="a-alt rv" style="--d:.2s">No account yet? <a href="/register">Create one</a></p>`, 'Sign in');
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
        withTransition(() => { history.pushState({}, '', '/'); renderRoute('/'); });
      } catch (e2) {
        err.textContent = e2.data?.message || 'Something went wrong.';
        err.style.display = 'block';
      }
    });
  });
}

function viewRegister() {
  const blocked = state.site && state.site.blockRegistrations;
  return authShell('register', `
    <p class="a-sub rv" style="--d:.1s">One account. Everything you say stays with you.</p>
    ${blocked ? blockBanner('Registrations are temporarily disabled. We will turn them back on shortly.') : ''}
    <form id="regForm" novalidate ${blocked ? 'data-disabled="1"' : ''}>
      <div class="field"><label for="r-name">Name</label><input id="r-name" type="text" placeholder="What should we call you?" autocomplete="name"></div>
      <div class="field"><label for="r-email">Email</label><input id="r-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
      <div class="field"><label for="r-pass">Password</label>
        <div class="pw-wrap"><input id="r-pass" type="password" placeholder="At least 8 characters" autocomplete="new-password"><button type="button" class="pw-toggle" data-target="r-pass">SHOW</button></div>
      </div>
      <div class="field"><label for="r-pass2">Confirm password</label>
        <div class="pw-wrap"><input id="r-pass2" type="password" autocomplete="new-password"><button type="button" class="pw-toggle" data-target="r-pass2">SHOW</button></div>
      </div>
      <div id="regErr" style="font-size:13px;color:var(--red);margin-bottom:14px;display:none"></div>
      <button class="btn btn-primary" type="submit" style="width:100%">Create account <span class="arr">→</span></button>
    </form>
    <p class="a-alt rv" style="--d:.2s">Already have one? <a href="/login">Sign in</a></p>`, 'Create your account');
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
    if (p1 !== p2) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return; }
    asyncSubmit(form.querySelector('button[type=submit]'), async () => {
      try {
        const r = await fetchJSON('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password: p1 }) });
        state.user = r.user;
        renderHeader();
        withTransition(() => { history.pushState({}, '', '/onboard'); renderRoute('/onboard'); });
      } catch (e2) {
        err.textContent = e2.data?.message || 'Something went wrong.';
        err.style.display = 'block';
      }
    });
  });
}

function viewReset() {
  return authShell('reset', `
    <p class="a-sub rv" style="--d:.1s">Enter the email on your account and we will send a reset link. It expires in 24 hours.</p>
    <form id="resetForm" novalidate>
      <div class="field"><label for="rt-email">Email</label><input id="rt-email" type="email" placeholder="you@example.com" autocomplete="email"></div>
      <button class="btn btn-primary" type="submit" style="width:100%">Send reset link <span class="arr">→</span></button>
    </form>
    <p class="a-alt rv" style="--d:.2s">Remembered it after all? <a href="/login">Sign in</a></p>`, 'Reset your password');
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
      const title = r.state === 'sent' ? 'Check your inbox' : r.state === 'not_configured' ? 'Almost there' : 'Request received';
      const msg = r.state === 'not_configured'
        ? `Your account exists, but email delivery is not configured yet. Add your Resend API key to <b style="color:var(--text)">config.json</b> and try again.`
        : `If an account exists for <b style="color:var(--text)">${esc(email)}</b>, a reset link is on its way. It expires in 24 hours.`;
      card.innerHTML = `<a class="a-logo" href="/">Turing</a>
        <div class="sent-state">
          <span class="s-ic">✉</span>
          <h3>${title}</h3>
          <p>${msg}</p>
          <a class="btn btn-ghost" href="/login" style="margin-top:8px">Back to sign in</a>
        </div>`;
    });
  });
}

function viewRecovery() {
  return authShell('recovery', `
    <p class="a-sub rv" style="--d:.1s">Validating your link…</p>
    <div id="recoverBox"></div>
    <p class="a-alt rv" style="--d:.2s"><a href="/reset">Link expired?</a> &nbsp;·&nbsp; <a href="/login">Back to sign in</a></p>`, 'Choose a new password');
}

async function onRecovery() {
  const box = el('#recoverBox');
  if (!box) return;
  const token = new URLSearchParams(location.search).get('token') || '';
  try {
    const r = await fetchJSON(`/api/auth/recovery-check?token=${encodeURIComponent(token)}`);
    if (!r.valid) {
      box.innerHTML = `<div class="sent-state"><span class="s-ic">⌛</span><h3>This link has expired</h3><p>Reset links are valid for 24 hours. Request a fresh one and it will arrive in seconds.</p><a class="btn btn-ghost" href="/reset" style="margin-top:8px">Request a new link</a></div>`;
      return;
    }
  } catch {
    box.innerHTML = `<div class="sent-state"><span class="s-ic">⌛</span><h3>This link has expired</h3><p>Request a fresh reset link to continue.</p><a class="btn btn-ghost" href="/reset" style="margin-top:8px">Request a new link</a></div>`;
    return;
  }
  box.innerHTML = `
    <form id="recForm" novalidate>
      <div class="field"><label for="n-pass">New password</label>
        <div class="pw-wrap"><input id="n-pass" type="password" placeholder="At least 8 characters" autocomplete="new-password"><button type="button" class="pw-toggle" data-target="n-pass">SHOW</button></div>
      </div>
      <div class="field"><label for="n-pass2">Confirm new password</label>
        <div class="pw-wrap"><input id="n-pass2" type="password" autocomplete="new-password"><button type="button" class="pw-toggle" data-target="n-pass2">SHOW</button></div>
      </div>
      <div id="recErr" style="font-size:13px;color:var(--red);margin-bottom:14px;display:none"></div>
      <button class="btn btn-primary" type="submit" style="width:100%">Set new password <span class="arr">→</span></button>
    </form>`;
  bindPwToggles();
  box.querySelector('#recForm').addEventListener('submit', e => {
    e.preventDefault();
    const err = el('#recErr');
    err.style.display = 'none';
    const p1 = $('#n-pass').value, p2 = $('#n-pass2').value;
    if (p1 !== p2) { err.textContent = 'Passwords do not match.'; err.style.display = 'block'; return; }
    asyncSubmit(box.querySelector('button[type=submit]'), async () => {
      try {
        await fetchJSON('/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: p1 }) });
        box.innerHTML = `<div class="sent-state"><span class="s-ic">✓</span><h3>Password updated</h3><p>Your new password is set. Sign in with it from here.</p><a class="btn btn-primary" href="/login" style="margin-top:8px">Sign in <span class="arr">→</span></a></div>`;
      } catch (e2) {
        err.textContent = e2.data?.message || 'Something went wrong.';
        err.style.display = 'block';
      }
    });
  });
}

/* ---------- onboarding ---------- */
const USAGE_OPTIONS = ['Writing', 'Research', 'Coding', 'Learning', 'Planning', 'Ideas & thinking'];

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
        <span class="onb-eyebrow rv-fade">Onboarding</span>
        <h1>${words('Welcome, ' + esc(first) + '.')}</h1>
        <p class="onb-sub rv" style="--d:.7s">Two minutes. A few questions so Turing works the way you think — not the other way around.</p>
        <button class="btn btn-primary onb-next" style="margin-top:34px">Let's go <span class="arr">→</span></button>
      </div>`;
    if (i === 1) return `
      <div class="onb-step" data-step="1">
        <span class="onb-eyebrow rv-fade">Step 01</span>
        <h1>${words('How old are you?')}</h1>
        <p class="onb-sub rv" style="--d:.6s">Turing is for people 13 and up. This stays on your account — it is used for nothing else.</p>
        <div class="onb-age rv" style="--d:.7s">
          <input id="ageInput" type="text" inputmode="numeric" placeholder="Your age" maxlength="3" autocomplete="off">
        </div>
        <div class="onb-warn" id="ageWarn" hidden>Turing is for 13 and up. Come back when the time is right.</div>
        <button class="btn btn-primary onb-next" disabled style="margin-top:30px">Continue <span class="arr">→</span></button>
      </div>`;
    if (i === 2) return `
      <div class="onb-step" data-step="2">
        <span class="onb-eyebrow rv-fade">Step 02</span>
        <h1>${words('What will you put it to?')}</h1>
        <p class="onb-sub rv" style="--d:.6s">Pick as many as you like. It tunes nothing — it just means you and Turing start speaking the same language.</p>
        <div class="onb-chips rv" style="--d:.7s" id="usageChips">
          ${USAGE_OPTIONS.map(u => `<button class="chip-opt" data-usage="${u}">${u}</button>`).join('')}
        </div>
        <button class="btn btn-primary onb-next" style="margin-top:30px">Continue <span class="arr">→</span></button>
      </div>`;
    if (i === 3) return `
      <div class="onb-step" data-step="3">
        <span class="onb-eyebrow rv-fade">Step 03</span>
        <h1>${words('How Turing thinks')}</h1>
        <p class="onb-sub rv" style="--d:.6s">Three commitments. They are the whole design.</p>
        <div class="onb-cards">
          <div class="onb-card rv" style="--d:.75s"><div class="oc-n">01</div><h3>Precise reasoning</h3><p>It works through your question step by step and leads with the point — the support comes after, only if it earns its place.</p></div>
          <div class="onb-card rv" style="--d:.9s"><div class="oc-n">02</div><h3>Real memory</h3><p>Facts you state stay in the conversation, attributed to you and never invented. If it does not remember, it says so.</p></div>
          <div class="onb-card rv" style="--d:1.05s"><div class="oc-n">03</div><h3>Honest confidence</h3><p>When it is guessing, it tells you it is guessing. You always know which side of the line an answer sits on.</p></div>
        </div>
        <button class="btn btn-primary onb-next" style="margin-top:30px">Got it <span class="arr">→</span></button>
      </div>`;
    if (i === 4) return `
      <div class="onb-step" data-step="4">
        <span class="onb-eyebrow rv-fade">Step 04</span>
        <h1>${words('Before you start')}</h1>
        <div class="onb-terms rv" style="--d:.6s">
          <div class="ot-row"><span class="ot-k">Your data</span><span>Your name, email and conversations exist to run the service. No selling, no ads, no tracking. Full detail in the <a href="/privacy">privacy policy</a>.</span></div>
          <div class="ot-row"><span class="ot-k">The AI</span><span>Turing reasons — it can be wrong. It labels its guesses and says "I don't know" when it should. Verify anything with real stakes.</span></div>
          <div class="ot-row"><span class="ot-k">Your rights</span><span>You can ask to see, correct or delete your data at any time. The support page is the route; a person reads everything.</span></div>
        </div>
        <label class="onb-check rv" style="--d:.75s">
          <input type="checkbox" id="termsCheck">
          <span class="onb-box" aria-hidden="true"><svg viewBox="0 0 12 10" fill="none"><path d="M1.5 5.2l3 3L10.5 1.6" stroke="#0A0A0A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <span>I'm 13 or older and I accept the <a href="/terms">terms of service</a> and the <a href="/privacy">privacy policy</a>.</span>
        </label>
        <button class="btn btn-primary onb-next" disabled style="margin-top:26px">Finish setup <span class="arr">→</span></button>
      </div>`;
    // 5 = done
    return `
      <div class="onb-step onb-final" data-step="5">
        <div class="onb-sparks" aria-hidden="true">
          <span style="--x:-90px;--y:-120px;--d:.05s"></span><span style="--x:70px;--y:-150px;--d:.15s"></span><span style="--x:-140px;--y:-40px;--d:.25s"></span><span style="--x:130px;--y:-70px;--d:.35s"></span><span style="--x:-40px;--y:-180px;--d:.45s"></span><span style="--x:30px;--y:-110px;--d:.55s"></span>
        </div>
        <svg class="onb-checkmark" viewBox="0 0 80 80" fill="none"><circle class="sv-circle" cx="40" cy="40" r="36" stroke-width="1.5"/><path class="sv-check" d="M26 41.5l9.5 9.5L55 30" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <h1>${words("You're set, " + esc(first) + '.', 0.5)}</h1>
        <p class="onb-sub rv" style="--d:1.1s">Turing is tuned to you. No settings screens, no dials — the rest happens in the conversation.</p>
        <a class="btn btn-primary rv onb-final-cta" style="--d:1.3s" href="/">Start a conversation <span class="arr">→</span></a>
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
        next.innerHTML = '<span class="spinner"></span> Saving…';
        try {
          await fetchJSON('/api/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ageBracket: sel.age, useCases: [...sel.usage], acceptedTerms: true }) });
          renderStep(5);
        } catch (e2) {
          next.disabled = false;
          next.innerHTML = 'Finish setup <span class="arr">→</span>';
        }
      });
    }
  }

  renderStep(onboard ? 5 : 0, false);
}

/* ---------- legal ---------- */
const PRIVACY = [
  ['What we collect', 'When you create an account we store your name and email address, and a hash of your password. When you use the product, your conversation content is processed to generate responses. When you write to support, we store your name, email, topic and message. We also keep basic technical data — such as the status history on this site — that the product needs to operate.'],
  ['How we use it', [
    'To provide the service: conversations are used to run conversations. Nothing else.',
    'To reply to you: support messages are read by a person and answered by email.',
    'Transactional email: account and password emails are sent through Resend. We do not send marketing email.',
    'To keep things working: status history is generated from operational data and shown publicly.',
  ]],
  ['What we do not do', [
    'We do not sell your data. There is no data broker in the loop, ever.',
    'We do not run advertising. There is no tracking pixel, no ad network, no third-party analytics scripts on this site.',
    'We do not cross conversations. Facts stated in one conversation are not used in another.',
  ]],
  ['Your data, your call', 'You can ask us to show you what we have on you, correct it, or delete your account entirely. The support page is the route — choose a topic, write the word "delete", and a person will take care of it.'],
  ['Email provider', 'Transactional email (welcome, password reset, support replies) is delivered by Resend on our behalf. They process email addresses to deliver mail and nothing more.'],
  ['Contact', 'Questions about this policy go to the support page. A person reads everything.'],
];
const TERMS = [
  ['The service', 'Turing is a conversational AI product. It reasons over your questions, remembers what you tell it within a conversation, and answers directly. It is a tool for thinking, not a source of verified truth.'],
  ['Accounts', 'You are responsible for the activity under your account and for keeping your password private. One person, one account. We may suspend accounts that are abused, and we will tell you why when we do.'],
  ['Output', 'Turing generates answers. Answers can be wrong — any system that reasons can be wrong, and ours is no exception. Verify anything that matters: medical, legal, financial, safety-critical. The product states its own confidence when it can, and says "I don\'t know" when it should. Do not paste credentials, keys or private data into conversations.'],
  ['Acceptable use', [
    'No illegal use, no attempts to extract system prompts, no abuse that degrades the service for others.',
    'No using the product to generate content you know to be harmful.',
    'Automated scraping of this site is not permitted.',
  ]],
  ['Plans', 'The Free plan is free, indefinitely, as described on the pricing page. Other plans are in development and will be described fully before they launch. Nothing about an existing plan changes without notice to you.'],
  ['Availability', 'We aim to be up and we show our 90-day record publicly on the status page. We do not guarantee uptime. If something breaks, it will appear there first.'],
  ['Liability', 'The service is provided as is. To the maximum extent permitted by law, we are not liable for indirect or consequential damages arising from its use.'],
  ['Changes', 'If these terms change materially, we will update this page and note the date above. Continued use after a change means you are fine with it.'],
];
function legalView(title, date, sections) {
  return `
  <div class="legal">
    <h1 class="rv">${title}</h1>
    <p class="l-date rv" style="--d:.08s">Effective ${date}</p>
    <div class="body">${sections.map(([h, c], i) => {
      const d = (0.12 + i * 0.06).toFixed(2);
      const body = Array.isArray(c) ? `<ul style="--d:${d}s">${c.map(x => `<li>${x}</li>`).join('')}</ul>` : `<p style="--d:${d}s">${c}</p>`;
      return `<h2 style="--d:${d}s">${h}</h2>${body}`;
    }).join('')}</div>
  </div>`;
}
const viewPrivacy = () => legalView('Privacy', 'September 14, 2026', PRIVACY);
const viewTerms = () => legalView('Terms of service', 'September 14, 2026', TERMS);

function viewNotFound() {
  return `
  <div class="nf">
    <div class="nf-bg"></div>
    <div class="nf-num">
      <span style="--i:0">4</span><span class="solid" style="--i:1">0</span><span style="--i:2">4</span>
    </div>
    <h1 class="rv" style="--d:.2s">This page doesn't exist.</h1>
    <p class="rv" style="--d:.3s">The link may be broken, or the page may have moved. Either way, the front door still works.</p>
    <a class="btn btn-primary rv" style="--d:.4s" href="/">Back to home <span class="arr">→</span></a>
  </div>`;
}

function viewMaintenance() {
  return `
  <div class="maint">
    <div class="m-ring"><i></i><i></i><i></i><span class="core"></span></div>
    <h1 class="rv" style="--d:.15s">We're doing some work.</h1>
    <p class="rv" style="--d:.25s">Turing is briefly in maintenance. Nothing is lost — your conversations are waiting. We'll be back shortly.</p>
    <div class="m-foot rv-fade" style="--d:.4s">© 2026 TURING</div>
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
    document.title = 'Maintenance — Turing';
    el('#siteHeader').innerHTML = '';
    el('#siteFooter').hidden = true;
    el('#page').innerHTML = VIEWS.maintenance.html();
  }
}

function renderRoute(path, { instant = false } = {}) {
  const route = matchRoute(String(path).split('?')[0]);
  state.route = route.view;
  document.title = route.title;
  refreshSite();
  renderHeader();
  renderFooter();

  // auth redirects
  if (state.user && ['login', 'register', 'reset'].includes(route.view)) {
    history.replaceState({}, '', '/');
    renderRoute('/');
    return;
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
    if (p && p.then) p.then(finish).catch(() => finish(viewNotFound()));
    else finish(p);
  };

  if (instant) { apply(); return; }
  apply();
}

/* ---------- boot ---------- */
async function boot() {
  try { state.site = await fetchJSON('/api/site'); }
  catch { state.site = { maintenance: false, blockLogins: false, blockRegistrations: false, announcement: { enabled: false, text: '' } }; }
  try { const me = await fetchJSON('/api/auth/me'); state.user = me.user; } catch {}
  renderAnnounce();
  if (state.site.maintenance) {
    state.route = 'maintenance';
    document.title = 'Maintenance — Turing';
    el('#siteHeader').innerHTML = '';
    el('#siteFooter').hidden = true;
    el('#page').innerHTML = VIEWS.maintenance.html();
    return;
  }
  renderRoute(location.pathname);
}
boot();
