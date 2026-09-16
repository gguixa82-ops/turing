/* ============ Turing — veil de carga entre páginas (v3) ============
   La pantalla de carga dura SIEMPRE al menos 2 segundos (MIN_SHOW).
   - Carga de página: el veil nace cubriendo y se quita cuando la app está
     lista, respetando el mínimo de 2s.
   - Navegación entre páginas sueltas (ia / account / admin): cubrir, esperar
     los 2s y navegar; la página destino no repite la espera (recuerdo en
     sessionStorage) para que cada cambio de página sean 2s en total. */
'use strict';
(function () {
  const MIN_SHOW = 2000; // la pantalla de carga se muestra sí o sí 2 segundos
  const el = () => document.getElementById('veil');

  let shownAt = null;
  let hideTimer = 0;
  let paid = false; // la página anterior ya mostró el veil 2s al navegar aquí

  try {
    const t = Number(sessionStorage.getItem('turingVeilT') || 0);
    sessionStorage.removeItem('turingVeilT');
    if (t && Date.now() - t < 5000) paid = true;
  } catch {}

  function markShown() { if (shownAt === null) shownAt = Date.now(); }
  function msLeft() { return Math.max(0, MIN_SHOW - (Date.now() - (shownAt == null ? Date.now() : shownAt))); }

  // si la página carga con el veil puesto (clase .on en el HTML), el conteo empieza ya
  const initial = el();
  if (initial && initial.classList.contains('on')) markShown();

  function hide() {
    const e = el(); if (!e) return;
    clearTimeout(hideTimer);
    if (paid) { paid = false; e.classList.remove('on'); shownAt = null; return; }
    markShown();
    hideTimer = setTimeout(() => { e.classList.remove('on'); shownAt = null; }, msLeft());
  }

  function show() {
    const e = el(); if (!e) return Promise.resolve();
    clearTimeout(hideTimer);
    markShown();
    e.classList.add('on');
    return new Promise(res => setTimeout(res, msLeft()));
  }

  function markNavigated() {
    try { sessionStorage.setItem('turingVeilT', String(Date.now())); } catch {}
  }

  window.TuringVeil = { show, hide, markNavigated };

  // volver/adelante desde la caché del navegador (bfcache): la página puede
  // restaurarse CON el veil puesto si se navegó cubierto -> quitarlo siempre
  window.addEventListener('pageshow', ev => {
    if (!ev.persisted) return;
    clearTimeout(hideTimer);
    shownAt = null;
    const e = el();
    if (e) e.classList.remove('on');
  });

  // red de seguridad: si la app falla y nadie quita el veil tras cargar, revelarlo
  window.addEventListener('load', () => setTimeout(() => {
    const e = el();
    if (e && e.classList.contains('on')) hide();
  }, 4000));

  // en páginas sueltas (ia / account / admin): cubrir, los 2s y navegar.
  // En el landing lo hace app.js (__TURING_ROUTER) con su enrutador SPA.
  if (window.__TURING_ROUTER) return;
  document.addEventListener('click', ev => {
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    ev.preventDefault();
    show().then(() => { markNavigated(); location.assign(href); });
  });
})();
