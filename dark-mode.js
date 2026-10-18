/* =========================================================
   dark-mode.js - light / dark switch for every page
   ---------------------------------------------------------
   Add ONE line at the end of <head> in each HTML file:
     <script src="../JS/dark-mode.js"></script>

   What it does
   1. Reads the saved mode ("pt-mode" in localStorage) and sets
      html[data-mode="light|dark"] before the page paints.
   2. Loads ../CSS/dark.css (same folder level as style.css).
   3. index.html + dashboard.html: adds the Light/Dark button to
      the header (.header-actions). Other pages follow the saved mode.
   4. Dark mode only: 3D space backdrop, cursor parallax and card tilt.
   Light mode stays exactly as your existing files.
   ========================================================= */
(function () {
  'use strict';

  var KEY = 'pt-mode';
  var root = document.documentElement;

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  /* ---- 1. Mode, set immediately so there is no flash ---- */
  var mode = read() === 'dark' ? 'dark' : 'light';
  root.setAttribute('data-mode', mode);

  /* ---- 2. Load dark.css next to style.css ---- */
  var me = document.currentScript;
  var href = (me && me.src) ? me.src.replace(/JS\/dark-mode\.js(\?.*)?$/i, 'CSS/dark.css') : '../CSS/dark.css';
  if (!document.querySelector('link[data-dm-css]')) {
    if (document.readyState === 'loading') {
      document.write('<link rel="stylesheet" href="' + href + '" data-dm-css>');
    } else {
      var l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-dm-css', '');
      document.head.appendChild(l);
    }
  }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  function isDark() { return root.getAttribute('data-mode') === 'dark'; }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  ready(function () {
    /* ---- 3a. 3D space backdrop (hidden by CSS in light mode) ---- */
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

    /* ---- 3b. Toggle button (index + dashboard only) ---- */
    var onToggle = /(^|\/)(index|dashboard)\.html?$/i.test(location.pathname) || /\/$/.test(location.pathname);
    var actions = document.querySelector('.header-actions');
    var btn = null, label = null;

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
      btn.addEventListener('click', function (e) {
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

    /* ---- Switching (circular reveal when the browser supports it) ---- */
    function setMode(next, x, y) {
      function run() { root.setAttribute('data-mode', next); write(next); sync(); clearTilt(); }
      if (document.startViewTransition && !reduce.matches && x != null) {
        var vt = document.startViewTransition(run);
        vt.ready.then(function () {
          var r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
          root.animate(
            { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
            { duration: 700, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', pseudoElement: '::view-transition-new(root)' }
          );
        }, function () {});
      } else {
        root.classList.add('dm-fade');
        run();
        setTimeout(function () { root.classList.remove('dm-fade'); }, 520);
      }
    }

    /* Keep other open tabs / pages in step */
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { root.setAttribute('data-mode', e.newValue === 'dark' ? 'dark' : 'light'); sync(); clearTilt(); }
    });

    /* ---- 4a. Cursor parallax for the backdrop (cheap: only .dm-space changes) ---- */
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    function frame() {
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      space.style.setProperty('--px', cx.toFixed(3));
      space.style.setProperty('--py', cy.toFixed(3));
      raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(frame) : 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    window.addEventListener('pointermove', function (e) {
      if (!isDark() || reduce.matches || !finePointer.matches) return;
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
      kick();
      tilt(e);
    }, { passive: true });

    var scrollTick = 0;
    window.addEventListener('scroll', function () {
      if (!isDark() || reduce.matches || scrollTick) return;
      scrollTick = requestAnimationFrame(function () {
        space.style.setProperty('--sc', String(window.scrollY));
        scrollTick = 0;
      });
    }, { passive: true });

    /* ---- 4b. Card tilt: only the card under the pointer, small angles ---- */
    var TILT = '.d-panel:not(.d-today):not(.d-stats), .stat, .tf-card, .gd-stat';
    var cur = null, pending = null, tiltRaf = 0;

    function clearTilt() {
      if (cur) { reset(cur); cur = null; }
    }
    function reset(el) {
      el.classList.remove('dm-tilt');
      el.style.removeProperty('--rx'); el.style.removeProperty('--ry');
      el.style.removeProperty('--gx'); el.style.removeProperty('--gy');
    }
    function tilt(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var el = e.target.closest ? e.target.closest(TILT) : null;
      if (el !== cur) { clearTilt(); cur = el; if (el) el.classList.add('dm-tilt'); }
      if (!el) return;
      pending = e;
      if (!tiltRaf) tiltRaf = requestAnimationFrame(function () {
        tiltRaf = 0;
        if (!cur || !pending) return;
        var r = cur.getBoundingClientRect();
        var px = (pending.clientX - r.left) / r.width, py = (pending.clientY - r.top) / r.height;
        var max = r.width > 700 ? 1.8 : (r.width > 420 ? 3.2 : 5);   // big panels move less
        cur.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
        cur.style.setProperty('--rx', ((0.5 - py) * 2 * max).toFixed(2) + 'deg');
        cur.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        cur.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
    }
    document.addEventListener('pointerleave', clearTilt);
    window.addEventListener('blur', clearTilt);

    /* Small public hook if you ever want to switch from your own code */
    window.PTDark = { set: function (m) { setMode(m === 'dark' ? 'dark' : 'light'); }, get: function () { return isDark() ? 'dark' : 'light'; } };
  });
})();
