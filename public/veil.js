/* ============ Turing — navigation veil ============
   Shared by ia.html / account.html: the page loads BEHIND the veil
   (markup starts with class "active"), the app hides it when ready,
   and any <a data-veil> link animates the veil back before navigating. */
'use strict';
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOLD = 560;   // ms the veil covers before the browser navigates
  const MIN_SHOW = 420; // minimum ms the arrival veil stays up

  const Veil = {
    el() { return document.getElementById('veil'); },
    hide(delay = 0) {
      const e = this.el(); if (!e) return;
      const wait = Math.max(delay, reduced ? 0 : MIN_SHOW);
      setTimeout(() => {
        if (reduced) { e.classList.remove('active', 'leaving'); return; }
        e.classList.add('leaving');
        setTimeout(() => e.classList.remove('active', 'leaving'), 600);
      }, wait);
    },
    go(href) {
      if (reduced) { location.assign(href); return; }
      const e = this.el();
      if (!e) { location.assign(href); return; }
      e.classList.remove('leaving');
      e.classList.add('active');
      setTimeout(() => location.assign(href), HOLD);
    },
  };
  window.Veil = Veil;

  document.addEventListener('click', ev => {
    const a = ev.target.closest ? ev.target.closest('a[data-veil]') : null;
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || a.target === '_blank') return;
    ev.preventDefault();
    Veil.go(href);
  });
})();
