/* =========================================================
   dark-mode.js - light / dark switch for every page
   ---------------------------------------------------------
   Put ONE line in <head> of each HTML file:
     <script src="dark-mode.js"></script>

   1. Reads the saved mode ("pt-mode") and sets html[data-mode]
      before the page paints.
   2. Makes sure dark.css is loaded (same folder, or CSS/ folder).
   3. index + dashboard: adds the Light / Dark button to the header.
   4. Switching: phones / tablets get a soft full-screen cross-fade
      (opacity only = smooth). Desktop gets a circular reveal.
   No cursor effects.
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'pt-mode';
  var root = document.documentElement;

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  /* ---- 1. Mode, set immediately so there is no flash ---- */
  root.setAttribute('data-mode', read() === 'dark' ? 'dark' : 'light');

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var desktop = window.matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
  function isDark() { return root.getAttribute('data-mode') === 'dark'; }

  /* ---- 2. dark.css: works for  JS/dark-mode.js -> CSS/dark.css  and for one flat folder ---- */
  var me = document.currentScript;
  var src = (me && me.src) || '';
  var href = src
    ? src.replace(/\/JS\/dark-mode\.js/i, '/CSS/dark.css').replace(/dark-mode\.js/i, 'dark.css')
    : 'dark.css';
  if (!document.querySelector('link[data-dm-css]')) {
    if (document.readyState === 'loading') {
      document.write('<link rel="stylesheet" href="' + href + '" data-dm-css>');
    } else {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-dm-css', '');
      document.head.appendChild(l);
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  ready(function () {
    /* ---- 3a. Space backdrop (CSS shows it in dark mode only) ---- */
    var space = document.createElement('div');
    space.className = 'dm-space';
    space.setAttribute('aria-hidden', 'true');
    space.innerHTML =
      '<div class="dm-layer dm-stars-1"></div>' +
      '<div class="dm-layer dm-stars-2"></div>' +
      '<div class="dm-layer dm-stars-3"></div>' +
      '<div class="dm-orb dm-orb-a"></div><div class="dm-orb dm-orb-b"></div><div class="dm-orb dm-orb-c"></div>' +
      '<div class="dm-planet"><div class="dm-globe"></div><div class="dm-ring"></div></div>';
    document.body.insertBefore(space, document.body.firstChild);

    var veil = document.createElement('div');
    veil.className = 'dm-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.appendChild(veil);

    /* Panels rise in 3D once when a page opens in dark mode (desktop only) */
    if (isDark() && desktop.matches && !reduce.matches) {
      root.classList.add('dm-enter');
      setTimeout(function () { root.classList.remove('dm-enter'); }, 1400);
    }

    /* ---- 3b. Toggle button (index + dashboard only) ---- */
    var onToggle = /(^|\/)(index|dashboard)(_\d+)?\.html?$/i.test(location.pathname) || /\/$/.test(location.pathname);
    var actions = document.querySelector('.header-actions');
    var btn = null, label = null, busy = false;

    if (onToggle && actions) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-btn dm-toggle';
      btn.id = 'dm-toggle';
      btn.innerHTML =
        '<span class="dm-coin" aria-hidden="true"><span class="dm-coin-in">' +
        '<svg class="dm-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' +
        '<svg class="dm-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
        '</span></span><span class="theme-text dm-label"></span>';
      label = btn.querySelector('.dm-label');
      actions.insertBefore(btn, actions.firstChild);
      btn.addEventListener('click', function () {
        if (busy) return;
        var r = btn.getBoundingClientRect();
        setMode(isDark() ? 'light' : 'dark', r.left + r.width / 2, r.top + r.height / 2);
      });
    }

    function sync() {
      if (!btn) return;
      var d = isDark();
      btn.setAttribute('aria-pressed', String(d));
      btn.setAttribute('aria-label', d ? 'Dark mode is on. Switch to light mode' : 'Light mode is on. Switch to dark mode');
      btn.title = d ? 'Switch to light mode' : 'Switch to dark mode';
      label.textContent = d ? 'Dark' : 'Light';
    }
    sync();

    function apply(next) {
      root.setAttribute('data-mode', next);
      write(next);
      sync();
    }

    /* ---- Switching ---- */
    function setMode(next, x, y) {
      if (next === (isDark() ? 'dark' : 'light')) return;

      if (reduce.matches) { apply(next); return; }

      busy = true;

      /* Desktop: circular reveal from the button */
      if (desktop.matches && document.startViewTransition && x != null) {
        var vt = document.startViewTransition(function () { apply(next); });
        vt.ready.then(function () {
          var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
          root.animate(
            { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
            { duration: 650, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
          );
        }, function () {});
        vt.finished.then(function () { busy = false; }, function () { busy = false; });
        return;
      }

      /* Phones / tablets: fade a solid layer in, flip underneath, fade out */
      var bg = '#050b1f';
      if (next === 'light') {
        bg = (getComputedStyle(root).getPropertyValue('--bg') || '').trim() || '#f3f6fb';
      }
      veil.style.background = bg;
      veil.style.transitionDuration = '180ms';
      veil.classList.add('on');

      setTimeout(function () {
        root.classList.add('dm-switching');           // no half-way transitions while flipping
        apply(next);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            root.classList.remove('dm-switching');
            veil.style.transitionDuration = '320ms';
            veil.classList.remove('on');
            setTimeout(function () { busy = false; }, 340);
          });
        });
      }, 200);
    }

    /* Keep other open tabs / pages in step */
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { root.setAttribute('data-mode', e.newValue === 'dark' ? 'dark' : 'light'); sync(); }
    });

    window.PTDark = { set: function (m) { setMode(m === 'dark' ? 'dark' : 'light'); }, get: function () { return isDark() ? 'dark' : 'light'; } };
  });
})();
