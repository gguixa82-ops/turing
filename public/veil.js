/* ============ Turing — veil de carga entre páginas (v2) ============
   Rápido a propósito: ~190ms de fade de entrada y nada de esperas
   artificiales extra; la navegación ocurre en cuanto el veil cubre. */
'use strict';
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = () => document.getElementById('veil');

  function hide() {
    const e = el(); if (!e) return;
    e.classList.remove('on');
  }
  function show() {
    const e = el();
    if (!e || e.classList.contains('on')) return Promise.resolve();
    if (reduced) { e.classList.add('on'); return Promise.resolve(); }
    e.classList.add('on');
    return new Promise(res => setTimeout(res, 190));
  }

  window.TuringVeil = { show, hide };

  // red de seguridad: si la app falla y nadie quita el veil tras cargar, revelarlo
  window.addEventListener('load', () => setTimeout(() => {
    const e = el();
    if (e && e.classList.contains('on')) hide();
  }, 4000));

  // En el landing el enrutado lo gestiona app.js (__TURING_ROUTER);
  // en páginas sueltas (ia / account / admin) interceptamos los enlaces internos.
  if (window.__TURING_ROUTER) return;
  document.addEventListener('click', ev => {
    if (reduced || ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    ev.preventDefault();
    show().then(() => location.assign(href));
  });
})();
