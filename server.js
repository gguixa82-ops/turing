/* Turing — zero-dependency Node.js server.
   Public SPA + /admin1042024 admin panel + JSON API (auth, support, status, admin).
   Run: node server.js  (PORT env optional, default 3000) */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const { RESEARCH, DOCS } = require('./data/content');

/* ---------------- data store ---------------- */

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return null; }
}
let db = loadDB();
function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function migrate() {
  // shape upgrades for older databases
  if (db && db.status && !Array.isArray(db.status.incidents)) db.status.incidents = [];
}

function hashPw(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 64).toString('hex');
}
function newSalt() { return crypto.randomBytes(16).toString('hex'); }

function seedStatus() {
  const days = 90;
  const mk = () => Array.from({ length: days }, () => 'ok');
  const web = mk(), conv = mk(), inf = mk(), mail = mk();
  web[71] = 'degraded';
  conv[45] = 'degraded'; conv[46] = 'degraded';
  inf[70] = 'outage'; inf[71] = 'degraded'; inf[72] = 'degraded';
  mail[12] = 'degraded';
  return [
    { id: 'web', name: 'Web experience', description: 'The Turing web application', status: 'ok', history: web },
    { id: 'conversations', name: 'Conversations', description: 'Chat and session infrastructure', status: 'ok', history: conv },
    { id: 'inference', name: 'Model inference', description: 'Reasoning and generation', status: 'ok', history: inf },
    { id: 'email', name: 'Email delivery', description: 'Transactional email via Resend', status: 'ok', history: mail },
  ];
}

function seed() {
  const salt = newSalt();
  db = {
    users: [],
    admin: { username: 'genisguixa', salt, passHash: hashPw('2011824', salt) },
    resets: {},
    support: [],
    status: { services: seedStatus(), incidents: [], updated: new Date().toISOString() },
    site: {
      maintenance: false,
      blockLogins: false,
      blockRegistrations: false,
      announcement: { enabled: false, text: '' },
    },
    activity: [{ at: new Date().toISOString(), text: 'Admin panel initialized' }],
    sessions: {},
  };
  save();
}
if (!db) seed(); else { migrate(); save(); } // ensure shape persists

function logActivity(text) {
  db.activity.unshift({ at: new Date().toISOString(), text });
  db.activity = db.activity.slice(0, 80);
  save();
}

/* ---------------- sessions ---------------- */

const SESSION_TTL = 7 * 24 * 3600 * 1000;

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `turing_session=${token}; HttpOnly; Path=/; Max-Age=${SESSION_TTL / 1000}; SameSite=Lax`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'turing_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
}
function createSession(role, id) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { role, id, exp: Date.now() + SESSION_TTL };
  save();
  return token;
}
function getSession(req) {
  const raw = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('turing_session='));
  if (!raw) return null;
  const token = raw.slice('turing_session='.length);
  const s = db.sessions[token];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[token]; save(); return null; }
  return { token, ...s };
}
function requireUser(req) {
  const s = getSession(req);
  if (!s || s.role !== 'user') return null;
  return db.users.find(u => u.id === s.id) || null;
}
function requireAdmin(req) {
  const s = getSession(req);
  return s && s.role === 'admin' ? s : null;
}

/* ---------------- email (Resend) ---------------- */

async function sendEmail({ to, subject, html }) {
  const key = (cfg.resend_api_key || '').trim();
  if (!key) return { ok: false, reason: 'not_configured' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.resend_from || 'Turing <onboarding@resend.dev>', to: [to], subject, html }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error('resend error', r.status, JSON.stringify(j)); return { ok: false, reason: 'api_error' }; }
    return { ok: true, id: j.id };
  } catch (e) {
    console.error('resend network error', e);
    return { ok: false, reason: 'network' };
  }
}

const emailShell = (title, inner) => `<!doctype html><html><body style="margin:0;background:#0A0A0A;padding:40px 16px;font-family:Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;background:#111113;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:40px 36px;">
<div style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#F5F5F5;margin-bottom:28px;">Turing</div>
${inner}
<div style="margin-top:36px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;color:#6B6B70;line-height:1.6;">This email was sent by Turing, your thinking copilot. If you did not expect it, you can safely ignore it.</div>
</div></body></html>`;
const emailBtn = (href, label) => `<div style="margin:24px 0;"><a href="${href}" style="display:inline-block;background:#F5F5F5;color:#0A0A0A;font-size:14px;font-weight:600;padding:12px 22px;border-radius:10px;text-decoration:none;">${label}</a></div>`;

function welcomeEmail(name, origin) {
  return emailShell('Welcome', `
  <p style="color:#B8B8BE;font-size:14px;line-height:1.7;margin:0 0 8px;">Welcome, ${escapeHtml(name)}.</p>
  <p style="color:#B8B8BE;font-size:14px;line-height:1.7;margin:0;">Your account is ready. Precise reasoning, real memory, zero filler.</p>
  ${emailBtn(origin + '/', 'Open Turing')}`);
}
function resetEmail(name, link) {
  return emailShell('Reset', `
  <p style="color:#B8B8BE;font-size:14px;line-height:1.7;margin:0 0 8px;">Hi ${escapeHtml(name)},</p>
  <p style="color:#B8B8BE;font-size:14px;line-height:1.7;margin:0;">We received a request to reset your password. Use the button below — it expires in 24 hours. If you did not request this, you can ignore this email and your password stays as it is.</p>
  ${emailBtn(link, 'Reset password')}`);
}
function replyEmail(name, message) {
  return emailShell('Support', `
  <p style="color:#B8B8BE;font-size:14px;line-height:1.7;margin:0 0 8px;">Hi ${escapeHtml(name)},</p>
  <div style="background:#0A0A0A;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin:16px 0;"><p style="color:#E8E8EC;font-size:14px;line-height:1.7;margin:0;">${escapeHtml(message)}</p></div>
  <p style="color:#8A8A90;font-size:13px;line-height:1.7;margin:14px 0 0;">Reply to this email to keep the conversation going. — Turing support</p>`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- helpers ---------------- */

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > 1e6) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function serveFile(req, res, file) {
  const ext = path.extname(file).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  // revalidate every time so updated assets are never served stale
  try {
    const st = fs.statSync(file);
    const etag = `W/"${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}"`;
    headers['ETag'] = etag;
    headers['Last-Modified'] = new Date(st.mtimeMs).toUTCString();
    headers['Cache-Control'] = 'no-cache';
    if (req && req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag });
      return res.end();
    }
  } catch {}
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}

const readMin = p => Math.max(2, Math.round(p.body.reduce((n, b) => n + (b.x ? b.x.split(/\s+/).length : 0), 0) / 200));

function researchMeta() {
  return RESEARCH.map(p => ({ slug: p.slug, title: p.title, category: p.category, date: p.date, excerpt: p.excerpt, readMin: readMin(p) }));
}
const RESEARCH_LIST = researchMeta();
const RESEARCH_BY_SLUG = Object.fromEntries(RESEARCH.map(p => [p.slug, p]));

const DOCS_NAV = Object.entries(DOCS).map(([slug, d]) => ({ slug, title: d.title, section: d.section, comingSoon: !!d.comingSoon }));

/* ---------------- API ---------------- */

async function handleApi(req, res, url) {
  const p = url.pathname.replace(/\/+$/, '');
  const m = req.method;
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

  // ---- public site flags ----
  if (m === 'GET' && p === '/api/site') {
    return json(res, 200, { maintenance: db.site.maintenance, blockLogins: db.site.blockLogins, blockRegistrations: db.site.blockRegistrations, announcement: db.site.announcement });
  }

  // ---- research ----
  if (m === 'GET' && p === '/api/research') return json(res, 200, { posts: RESEARCH_LIST });
  const rp = p.match(/^\/api\/research\/([a-z0-9-]+)$/);
  if (m === 'GET' && rp) {
    const post = RESEARCH_BY_SLUG[rp[1]];
    if (!post) return json(res, 404, { error: 'not_found' });
    return json(res, 200, { ...post, body: post.body, readMin: readMin(post) });
  }

  // ---- docs ----
  if (m === 'GET' && p === '/api/docs') return json(res, 200, { docs: DOCS_NAV });
  const dp = p.match(/^\/api\/docs\/([a-z0-9-]+)$/);
  if (m === 'GET' && dp) {
    const doc = DOCS[dp[1]];
    if (!doc) return json(res, 404, { error: 'not_found' });
    return json(res, 200, { ...doc, slug: dp[1] });
  }

  // ---- status (public) ----
  if (m === 'GET' && p === '/api/status') {
    const services = db.status.services.map(s => ({ id: s.id, name: s.name, description: s.description, status: s.status, history: s.history }));
    const incidents = (db.status.incidents || []).map(i => ({ ...i, updates: i.updates || [] }));
    return json(res, 200, { services, incidents, updated: db.status.updated });
  }

  // ---- support (public submit) ----
  if (m === 'POST' && p === '/api/support') {
    const b = await readBody(req);
    const name = String(b.name || '').trim().slice(0, 80);
    const email = String(b.email || '').trim().slice(0, 120);
    const topic = String(b.topic || 'General').slice(0, 60);
    const message = String(b.message || '').trim().slice(0, 4000);
    if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'invalid', message: 'Name, a valid email and a message are required.' });
    const id = crypto.randomBytes(6).toString('hex');
    db.support.unshift({ id, name, email, topic, message, created: new Date().toISOString(), read: false, resolved: false, replies: [], followups: [] });
    logActivity(`New support message from ${name}`);
    return json(res, 201, { ok: true, id });
  }

  // ---- onboarding (per user) ----
  if (m === 'GET' && p === '/api/onboard') {
    const u = requireUser(req);
    if (!u) return json(res, 401, { error: 'unauthorized' });
    return json(res, 200, { onboard: u.onboard || null });
  }
  if (m === 'POST' && p === '/api/onboard') {
    const u = requireUser(req);
    if (!u) return json(res, 401, { error: 'unauthorized' });
    const b = await readBody(req);
    const ageBracket = String(b.ageBracket || '').slice(0, 12);
    const useCases = Array.isArray(b.useCases) ? b.useCases.filter(x => typeof x === 'string').slice(0, 8).map(x => x.slice(0, 30)) : [];
    const acceptedTerms = b.acceptedTerms === true;
    if (!ageBracket || !acceptedTerms) return json(res, 400, { error: 'invalid', message: 'Age and terms acceptance are required.' });
    u.onboard = { ageBracket, useCases, acceptedTerms, at: new Date().toISOString(), ...(u.onboard || {}) };
    logActivity(`Onboarding completed: ${u.name}`);
    return json(res, 200, { ok: true, onboard: u.onboard });
  }

  // ---- auth: me ----
  if (m === 'GET' && p === '/api/auth/me') {
    const u = requireUser(req);
    if (!u) return json(res, 401, { error: 'unauthorized' });
    return json(res, 200, { user: { name: u.name, email: u.email, created: u.created } });
  }
  if (m === 'POST' && p === '/api/auth/logout') {
    const s = getSession(req);
    if (s) { delete db.sessions[s.token]; save(); }
    clearSessionCookie(res);
    return json(res, 200, { ok: true });
  }

  // ---- auth: register ----
  if (m === 'POST' && p === '/api/auth/register') {
    if (db.site.blockRegistrations) return json(res, 403, { error: 'blocked', message: 'Registrations are temporarily disabled.' });
    const b = await readBody(req);
    const name = String(b.name || '').trim().slice(0, 60);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
    const password = String(b.password || '');
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) return json(res, 400, { error: 'invalid', message: 'Provide a name, a valid email and a password of at least 8 characters.' });
    if (db.users.some(u => u.email === email)) return json(res, 409, { error: 'exists', message: 'An account with this email already exists.' });
    const salt = newSalt();
    const user = { id: crypto.randomBytes(8).toString('hex'), name, email, salt, passHash: hashPw(password, salt), created: new Date().toISOString(), lastLogin: null };
    db.users.push(user);
    logActivity(`New user registered: ${name} <${email}>`);
    const r = await sendEmail({ to: email, subject: 'Welcome to Turing', html: welcomeEmail(name, origin) });
    if (!r.ok) console.log('[email] welcome not delivered:', r.reason);
    const token = createSession('user', user.id);
    setSessionCookie(res, token);
    return json(res, 201, { ok: true, email: r.ok ? 'delivered' : 'pending', user: { name, email } });
  }

  // ---- auth: login ----
  if (m === 'POST' && p === '/api/auth/login') {
    if (db.site.blockLogins) return json(res, 403, { error: 'blocked', message: 'Logins are temporarily disabled.' });
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    const password = String(b.password || '');
    const u = db.users.find(x => x.email === email);
    if (!u || hashPw(password, u.salt) !== u.passHash) return json(res, 401, { error: 'invalid', message: 'Incorrect email or password.' });
    u.lastLogin = new Date().toISOString();
    logActivity(`User login: ${u.name}`);
    const token = createSession('user', u.id);
    setSessionCookie(res, token);
    return json(res, 200, { ok: true, user: { name: u.name, email: u.email } });
  }

  // ---- auth: password reset request ----
  if (m === 'POST' && p === '/api/auth/reset') {
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    const u = db.users.find(x => x.email === email);
    if (!u) return json(res, 200, { ok: true, state: 'unknown' });
    const token = crypto.randomBytes(24).toString('hex');
    db.resets[token] = { email, exp: Date.now() + 24 * 3600 * 1000 };
    const link = `${origin}/recovery?token=${token}`;
    const r = await sendEmail({ to: email, subject: 'Reset your Turing password', html: resetEmail(u.name, link) });
    if (r.ok) { logActivity(`Password reset link sent to ${email}`); return json(res, 200, { ok: true, state: 'sent' }); }
    logActivity(`Password reset requested for ${email} — email not delivered (${r.reason})`);
    return json(res, 200, { ok: true, state: 'not_configured', email: email });
  }

  // ---- auth: recovery token check ----
  if (m === 'GET' && p === '/api/auth/recovery-check') {
    const token = url.searchParams.get('token') || '';
    const t = db.resets[token];
    const valid = t && t.exp > Date.now();
    return json(res, 200, { valid: !!valid });
  }

  // ---- auth: recover (set new password) ----
  if (m === 'POST' && p === '/api/auth/recover') {
    const b = await readBody(req);
    const token = String(b.token || '');
    const password = String(b.password || '');
    const t = db.resets[token];
    if (!t || t.exp < Date.now()) return json(res, 400, { error: 'expired', message: 'This reset link has expired. Request a new one.' });
    if (password.length < 8) return json(res, 400, { error: 'invalid', message: 'Password must be at least 8 characters.' });
    const u = db.users.find(x => x.email === t.email);
    if (!u) return json(res, 400, { error: 'expired', message: 'This reset link is no longer valid.' });
    u.salt = newSalt(); u.passHash = hashPw(password, u.salt);
    delete db.resets[token];
    logActivity(`Password reset completed: ${u.name}`);
    return json(res, 200, { ok: true });
  }

  /* ================= ADMIN ================= */

  if (m === 'POST' && p === '/api/admin/login') {
    const b = await readBody(req);
    const un = String(b.username || '').trim();
    const pw = String(b.password || '');
    if (un !== db.admin.username || hashPw(pw, db.admin.salt) !== db.admin.passHash) return json(res, 401, { error: 'invalid', message: 'Invalid credentials.' });
    const token = createSession('admin', 'admin');
    setSessionCookie(res, token);
    logActivity('Admin login');
    return json(res, 200, { ok: true });
  }

  const adminOk = requireAdmin(req);
  if (!adminOk) {
    // all remaining /api/admin routes require auth
    if (p.startsWith('/api/admin')) return json(res, 401, { error: 'unauthorized' });
    return json(res, 404, { error: 'not_found' });
  }

  if (m === 'GET' && p === '/api/admin/overview') {
    return json(res, 200, {
      counts: {
        supportTotal: db.support.length,
        supportOpen: db.support.filter(s => !s.resolved).length,
        supportUnread: db.support.filter(s => !s.read).length,
        users: db.users.length,
        services: db.status.services.length,
      },
      site: db.site,
      status: db.status,
      recentActivity: db.activity.slice(0, 12),
      recentSupport: db.support.slice(0, 6).map(s => ({ id: s.id, name: s.name, email: s.email, topic: s.topic, created: s.created, read: s.read, resolved: s.resolved, preview: s.message.slice(0, 140) })),
    });
  }

  if (m === 'GET' && p === '/api/admin/support') {
    return json(res, 200, { messages: db.support });
  }
  const sm = p.match(/^\/api\/admin\/support\/([a-z0-9]+)$/);
  if (m === 'POST' && sm) {
    const msg = db.support.find(s => s.id === sm[1]);
    if (!msg) return json(res, 404, { error: 'not_found' });
    const b = await readBody(req);
    if (b.action === 'read') msg.read = true;
    if (b.action === 'unread') msg.read = false;
    if (b.action === 'resolve') msg.resolved = true;
    if (b.action === 'reopen') msg.resolved = false;
    if (typeof b.message === 'string' && b.message.trim()) {
      const text = b.message.trim().slice(0, 4000);
      msg.replies.push({ message: text, at: new Date().toISOString() });
      msg.read = true;
      const r = await sendEmail({ to: msg.email, subject: `Re: your message to Turing support`, html: replyEmail(msg.name, text) });
      if (!r.ok) console.log('[email] reply not delivered:', r.reason);
      logActivity(`Support reply sent to ${msg.name}`);
    }
    save();
    return json(res, 200, { ok: true, message: msg });
  }

  if (m === 'GET' && p === '/api/admin/status') return json(res, 200, { status: db.status });
  if (m === 'POST' && p === '/api/admin/status') {
    const b = await readBody(req);
    const st = db.status;
    if (b.op === 'addService') {
      const name = String(b.name || '').trim().slice(0, 60);
      if (!name) return json(res, 400, { error: 'invalid' });
      st.services.push({ id: crypto.randomBytes(4).toString('hex'), name, description: String(b.description || '').trim().slice(0, 120), status: 'ok', history: Array.from({ length: 90 }, () => 'ok') });
      logActivity(`Status service added: ${name}`);
    } else if (b.op === 'updateService') {
      const s = st.services.find(x => x.id === b.id);
      if (!s) return json(res, 404, { error: 'not_found' });
      if (typeof b.name === 'string') s.name = b.name.trim().slice(0, 60);
      if (typeof b.description === 'string') s.description = b.description.trim().slice(0, 120);
      if (['ok', 'degraded', 'outage'].includes(b.status)) { s.status = b.status; if (b.status !== 'ok') s.history[89] = b.status; }
      logActivity(`Status service updated: ${s.name}`);
    } else if (b.op === 'deleteService') {
      const s = st.services.find(x => x.id === b.id);
      st.services = st.services.filter(x => x.id !== b.id);
      if (s) logActivity(`Status service removed: ${s.name}`);
    } else if (b.op === 'setDay') {
      const s = st.services.find(x => x.id === b.id);
      if (!s) return json(res, 404, { error: 'not_found' });
      const i = Math.max(0, Math.min(89, parseInt(b.index, 10)));
      if (['ok', 'degraded', 'outage'].includes(b.value)) { s.history[i] = b.value; if (i === 89) s.status = b.value; }
      logActivity(`Status history updated: ${s.name}`);
    } else if (b.op === 'setHistory') {
      const s = st.services.find(x => x.id === b.id);
      if (!s) return json(res, 404, { error: 'not_found' });
      if (Array.isArray(b.history) && b.history.length === 90 && b.history.every(v => ['ok', 'degraded', 'outage'].includes(v))) {
        s.history = b.history; s.status = b.history[89];
        logActivity(`Status history replaced: ${s.name}`);
      } else return json(res, 400, { error: 'invalid' });
    } else if (b.op === 'bulkHistory') {
      const n = Math.max(1, Math.min(90, parseInt(b.days, 10) || 1));
      if (!['ok', 'degraded', 'outage'].includes(b.status)) return json(res, 400, { error: 'invalid' });
      st.services.forEach(s => { for (let i = 90 - n; i < 90; i++) s.history[i] = b.status; s.status = s.history[89]; });
      logActivity(`Status bulk update: last ${n} day(s) → ${b.status}`);
    } else if (b.op === 'addIncident') {
      const title = String(b.title || '').trim().slice(0, 120);
      const message = String(b.message || '').trim().slice(0, 1200);
      if (!title || !message) return json(res, 400, { error: 'invalid', message: 'Title and message are required.' });
      const severity = ['degraded', 'outage', 'maintenance'].includes(b.severity) ? b.severity : 'degraded';
      const serviceId = typeof b.serviceId === 'string' && st.services.some(s => s.id === b.serviceId) ? b.serviceId : null;
      if (!Array.isArray(st.incidents)) st.incidents = [];
      const inc = { id: crypto.randomBytes(6).toString('hex'), title, message, severity, serviceId, created: new Date().toISOString(), resolved: false, resolvedAt: null, updates: [] };
      st.incidents.unshift(inc);
      if (serviceId) {
        const s = st.services.find(x => x.id === serviceId);
        const dayVal = severity === 'outage' ? 'outage' : 'degraded';
        if (s) { s.history[89] = dayVal; s.status = dayVal; }
      }
      logActivity(`Incident created: ${title}`);
      return json(res, 200, { ok: true, incident: inc });
    } else if (b.op === 'incidentUpdate') {
      const inc = (st.incidents || []).find(i => i.id === b.id);
      if (!inc) return json(res, 404, { error: 'not_found' });
      const text = String(b.text || '').trim().slice(0, 1200);
      if (!text) return json(res, 400, { error: 'invalid', message: 'Update text is required.' });
      inc.updates = inc.updates || [];
      inc.updates.push({ text, at: new Date().toISOString() });
      logActivity(`Incident updated: ${inc.title}`);
    } else if (b.op === 'resolveIncident' || b.op === 'reopenIncident') {
      const inc = (st.incidents || []).find(i => i.id === b.id);
      if (!inc) return json(res, 404, { error: 'not_found' });
      if (b.op === 'resolveIncident') {
        inc.resolved = true; inc.resolvedAt = new Date().toISOString();
        const note = String(b.note || '').trim().slice(0, 1200);
        if (note) { inc.updates = inc.updates || []; inc.updates.push({ text: note, at: inc.resolvedAt }); }
        logActivity(`Incident resolved: ${inc.title}`);
      } else {
        inc.resolved = false; inc.resolvedAt = null;
        logActivity(`Incident reopened: ${inc.title}`);
      }
    } else if (b.op === 'deleteIncident') {
      const inc = (st.incidents || []).find(i => i.id === b.id);
      st.incidents = (st.incidents || []).filter(i => i.id !== b.id);
      if (inc) logActivity(`Incident removed: ${inc.title}`);
    }
    st.updated = new Date().toISOString();
    save();
    return json(res, 200, { ok: true, status: st });
  }

  if (m === 'GET' && p === '/api/admin/site') {
    return json(res, 200, { site: db.site, activity: db.activity.slice(0, 30) });
  }
  if (m === 'POST' && p === '/api/admin/site') {
    const b = await readBody(req);
    const s = db.site;
    if (typeof b.maintenance === 'boolean') { s.maintenance = b.maintenance; logActivity(`Maintenance mode ${b.maintenance ? 'enabled' : 'disabled'}`); }
    if (typeof b.blockLogins === 'boolean') { s.blockLogins = b.blockLogins; logActivity(`Logins ${b.blockLogins ? 'blocked' : 'unblocked'}`); }
    if (typeof b.blockRegistrations === 'boolean') { s.blockRegistrations = b.blockRegistrations; logActivity(`Registrations ${b.blockRegistrations ? 'blocked' : 'unblocked'}`); }
    if (b.announcement && typeof b.announcement === 'object') {
      s.announcement = { enabled: !!b.announcement.enabled, text: String(b.announcement.text || '').trim().slice(0, 160) };
      logActivity(`Announcement ${s.announcement.enabled ? 'published' : 'removed'}`);
    }
    save();
    return json(res, 200, { ok: true, site: s });
  }

  return json(res, 404, { error: 'not_found' });
}

/* ---------------- HTTP ---------------- */

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://internal');
    const p = url.pathname;

    if (p.startsWith('/api/')) return await handleApi(req, res, url);

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }

    if (p === '/admin1042024' || p === '/admin1042024/') {
      return serveFile(req, res, path.join(PUBLIC_DIR, "admin.html"));
    }

    // static files
    const clean = path.normalize(p).replace(/^([.][.][/\\])+/, '');
    if (clean !== '/' && !p.startsWith('/api/')) {
      const file = path.join(PUBLIC_DIR, clean);
      if (file.startsWith(PUBLIC_DIR) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return serveFile(req, res, file);
      }
    }
    // SPA fallback
    return serveFile(req, res, path.join(PUBLIC_DIR, "index.html"));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'server_error' });
    else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Turing server running on http://0.0.0.0:${PORT}`);
});
