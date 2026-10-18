(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmtMin(min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    return h ? (m ? h + ' h ' + m + ' min' : h + ' h') : m + ' min';
  }
  function fmtShort(min) {
    min = Math.round(min);
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, val);
    } catch (e) {}
    return null;
  }
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- Theme ---------------- */
  function applyTheme(n) {
    root.setAttribute('data-theme', n);
    $$('.theme-opt, .st-theme').forEach(function (o) { o.setAttribute('aria-pressed', String(o.dataset.theme === String(n))); });
    store('pt-theme', String(n));
  }
  (function () {
    var btn = $('#theme-btn'), menu = $('#theme-menu');
    if (!btn || !menu) return;
    var opts = $$('.theme-opt', menu);
    function setOpen(open) { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); }

    var saved = store('pt-theme');
    if (!saved || !$('.theme-opt[data-theme="' + saved + '"]', menu)) saved = '1';
    applyTheme(saved);

    btn.addEventListener('click', function () { setOpen(menu.hidden); });
    opts.forEach(function (o) { o.addEventListener('click', function () { applyTheme(o.dataset.theme); }); });
    document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('.theme')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } });
  })();

  /* Sidebar: tell the CSS when it is collapsed to icons (so the profile card can shrink too) */
  (function () {
    var sb = $('#sidebar'); if (!sb) return;
    function check() { sb.classList.toggle('is-collapsed', sb.offsetWidth < 150); }
    check();
    if ('ResizeObserver' in window) new ResizeObserver(check).observe(sb);
    window.addEventListener('resize', check);
  })();

  /* ---------------- Dates ---------------- */
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  function nowHours() { var n = new Date(); return n.getHours() + n.getMinutes() / 60; }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Profile (sidebar, header avatar, greeting) ---------------- */
  var profile = { name: ($('#d-greeting').dataset.name || 'Alex'), email: 'alex@example.com', photo: '' };
  try {
    var sp = JSON.parse(store('pt-profile') || 'null');
    if (sp && typeof sp === 'object') {
      if (sp.name) profile.name = String(sp.name).slice(0, 40);
      if (sp.email) profile.email = String(sp.email).slice(0, 80);
      if (typeof sp.photo === 'string' && sp.photo.indexOf('data:image/') === 0) profile.photo = sp.photo;
    }
  } catch (e) {}

  function initial(n) { return (n.trim().charAt(0) || 'A').toUpperCase(); }
  function paintAvatar(node, p) {
    node.textContent = p.photo ? '' : initial(p.name);
    node.style.backgroundImage = p.photo ? 'url("' + p.photo + '")' : '';
    node.classList.toggle('has-photo', !!p.photo);
  }
  function setGreeting() {
    var h = new Date().getHours();
    var part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    $('#d-greeting').textContent = part + ', ' + (profile.name.split(' ')[0] || 'there');
    $('#d-date').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  function renderProfile() {
    paintAvatar($('#sb-avatar'), profile);
    paintAvatar($('.d-avatar'), profile);
    $('.d-avatar').setAttribute('aria-label', 'Edit profile, signed in as ' + profile.name);
    $('#sb-name').textContent = profile.name;
    $('#sb-email').textContent = profile.email;
    setGreeting();
  }
  renderProfile();

  var openProfile = function () {};

  /* ---------------- Dialogs: edit profile + settings ---------------- */
  function openDialog(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function closeDialog(d) { if (d.close) d.close(); else d.removeAttribute('open'); }
  $$('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) closeDialog(d); });   // click on the dark backdrop
  });
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', function () { closeDialog(b.closest('dialog')); }); });

  (function () {
    var dlg = $('#profile-dialog'), form = $('#profile-form');
    var nameIn = $('#pd-name'), mailIn = $('#pd-email'), err = $('#pd-err'), file = $('#pd-file');
    var draft = { photo: '' };

    function paintDraft() { paintAvatar($('#pd-avatar'), { name: nameIn.value || profile.name, photo: draft.photo }); }
    function open() {
      draft.photo = profile.photo;
      nameIn.value = profile.name; mailIn.value = profile.email;
      err.hidden = true; nameIn.removeAttribute('aria-invalid'); mailIn.removeAttribute('aria-invalid');
      paintDraft(); openDialog(dlg);
      nameIn.focus();
    }
    openProfile = open;
    $('#open-profile').addEventListener('click', open);
    $('.d-avatar').addEventListener('click', open);
    nameIn.addEventListener('input', function () { err.hidden = true; nameIn.removeAttribute('aria-invalid'); paintDraft(); });

    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f || !/^image\//.test(f.type)) return;
      var r = new FileReader();
      r.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = 128, c = document.createElement('canvas'), m = Math.min(img.width, img.height);
          c.width = c.height = s;
          c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
          draft.photo = c.toDataURL('image/jpeg', 0.85);
          paintDraft();
        };
        img.src = r.result;
      };
      r.readAsDataURL(f);
      file.value = '';
    });
    $('#pd-remove').addEventListener('click', function () { draft.photo = ''; paintDraft(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = nameIn.value.trim(), mail = mailIn.value.trim();
      if (!name) {
        err.textContent = 'Please enter your name.'; err.hidden = false;
        nameIn.setAttribute('aria-invalid', 'true'); nameIn.focus(); return;
      }
      if (mail && !/^\S+@\S+\.\S+$/.test(mail)) {
        err.textContent = 'That email address does not look right.'; err.hidden = false;
        mailIn.setAttribute('aria-invalid', 'true'); mailIn.focus(); return;
      }
      profile.name = name; profile.email = mail || profile.email; profile.photo = draft.photo;
      store('pt-profile', JSON.stringify(profile));
      renderProfile();
      closeDialog(dlg);
    });
  })();

  /* Settings: theme, profile, add / edit / remove tasks, star animation */
  var starOn = store('pt-star') !== 'off';
  (function () {
    var dlg = $('#settings-dialog'), sw = $('#set-star');
    var themeBox = $('#st-themes'), taskBox = $('#st-tasks');

    $$('#theme-menu .theme-opt').forEach(function (o) {            // same five themes as the header picker
      var b = el('button', 'st-theme');
      b.type = 'button';
      b.dataset.theme = o.dataset.theme;
      b.appendChild(el('span', '', o.querySelector('span').textContent));
      var dots = o.querySelector('.dots');
      if (dots) b.appendChild(dots.cloneNode(true));
      b.setAttribute('aria-pressed', String(o.dataset.theme === root.getAttribute('data-theme')));
      b.addEventListener('click', function () { applyTheme(b.dataset.theme); });
      themeBox.appendChild(b);
    });

    function renderManage() {
      taskBox.textContent = '';
      var tasks = PTStore.all();
      if (!tasks.length) { taskBox.appendChild(el('li', 'st-empty', 'No tasks yet. Use Add task to create one.')); return; }
      tasks.forEach(function (t) {
        var li = el('li', 'st-task');
        var info = el('div', 'st-task-info');
        info.appendChild(el('b', '', t.title));
        info.appendChild(el('span', '', PTStore.describe(t)));
        var act = el('div', 'st-task-actions');
        var ed = el('a', 'd-btn-ghost', 'Edit');
        ed.href = 'add-task.html?id=' + encodeURIComponent(t.id);
        ed.setAttribute('aria-label', 'Edit ' + t.title);
        var rm = el('button', 'd-btn-ghost d-btn-danger', 'Remove');
        rm.type = 'button';
        rm.setAttribute('aria-label', 'Remove ' + t.title);
        var armed = false, timer = 0;
        function reset() { armed = false; rm.textContent = 'Remove'; rm.classList.remove('is-armed'); }
        rm.addEventListener('click', function () {
          if (!armed) { armed = true; rm.textContent = 'Sure? Remove'; rm.classList.add('is-armed'); timer = setTimeout(reset, 4000); return; }
          clearTimeout(timer);
          PTStore.remove(t.id);
          renderManage(); renderTaskList(); refresh(false);
        });
        act.appendChild(ed); act.appendChild(rm);
        li.appendChild(info); li.appendChild(act);
        taskBox.appendChild(li);
      });
    }

    sw.checked = starOn;
    sw.addEventListener('change', function () { starOn = sw.checked; store('pt-star', starOn ? 'on' : 'off'); });
    $('#st-profile').addEventListener('click', function () { closeDialog(dlg); openProfile(); });
    $('#open-settings').addEventListener('click', function (e) {
      e.preventDefault();
      sw.checked = starOn;
      renderManage();
      openDialog(dlg);
    });
  })();

  /* ---------------- Sample history (replace with real data from the server later) ---------------- */
  var PREV = {                       // the 6 days before today
    planned:    [8, 6, 7, 5, 8, 4],                 // tasks
    done:       [7, 6, 6, 5, 6, 3],
    plannedMin: [180, 150, 200, 140, 210, 120],     // minutes of planned work
    focus:      [150, 110, 170, 95, 180, 75]        // minutes actually worked
  };

  /* ---------------- Goals (hours come from data-hours / data-daily in the HTML) ---------------- */
  var goalItems = $$('.d-goal');
  var goalDailyMin = Math.round(goalItems.reduce(function (a, g) { return a + (parseFloat(g.dataset.daily) || 0); }, 0) * 60);
  var goalTotalH = goalItems.reduce(function (a, g) { return a + (parseFloat(g.dataset.hours) || 0); }, 0);

  /* ---------------- Today's tasks ---------------- */
  var list = $('#d-tasks');

  function taskStats() {
    var boxes = $$('input[type="checkbox"]', list);
    var s = { total: boxes.length, done: 0, leftMin: 0, doneMin: 0 };
    boxes.forEach(function (b) {
      var m = +b.dataset.min || 0;
      if (b.checked) { s.done++; s.doneMin += m; } else { s.leftMin += m; }
    });
    return s;
  }

  /* Today's plan is built from the saved tasks (daily ones, plus one-day tasks dated today) */
  var todayKey = PTStore.key(today);
  function renderTaskList() {
    list.textContent = '';
    var done = PTStore.doneMap(todayKey), n = nowHours();
    PTStore.forDay(today).forEach(function (t) {
      var li = el('li');
      var label = el('label', 'd-task');
      var cb = el('input');
      cb.type = 'checkbox';
      cb.dataset.id = t.id; cb.dataset.min = String(t.min); cb.dataset.start = String(PTStore.hours(t.start));
      if (done[t.id] != null) { cb.checked = true; cb.dataset.at = String(Math.min(+done[t.id] || n, n)); }
      var box = el('span', 'd-box'); box.setAttribute('aria-hidden', 'true');
      var title = el('span', 'd-task-title', t.title);
      var side = el('span', 'd-task-side');
      var a = el('span'); var dot = el('i');
      dot.style.setProperty('--c', 'var(--' + t.color + ')');
      a.appendChild(dot); a.appendChild(document.createTextNode(t.tag));
      side.appendChild(a); side.appendChild(el('span', '', PTStore.label(t.start) + ' \u00b7 ' + fmtMin(t.min)));
      label.appendChild(cb); label.appendChild(box); label.appendChild(title); label.appendChild(side);
      li.appendChild(label);
      list.appendChild(li);
    });
  }

  function renderToday(s) {
    var pct = s.total ? Math.round(s.done / s.total * 100) : 0;
    var ring = $('#d-ring');
    ring.style.setProperty('--p', pct);
    ring.setAttribute('aria-label', s.done + ' of ' + s.total + ' tasks done today');
    $('#d-done').textContent = s.done;
    $('#d-total').textContent = s.total;

    var left = s.total - s.done, msg;
    if (!s.total) msg = 'No tasks planned for today. Use Add a task to plan one.';
    else if (!left) msg = 'Everything is done for today. Nice work.';
    else msg = plural(left, 'task', 'tasks') + ' left, about ' + fmtMin(s.leftMin) + ' of work.';
    $('#d-today-msg').textContent = msg;
  }

  /* ---------------- Star animation: a star sweeps through the text, turning it green ---------------- */
  function cleanupStar(title) {
    if (!title) return;
    if (title._raf) { cancelAnimationFrame(title._raf); title._raf = 0; }
    $$('.d-star, .d-twinkle', title).forEach(function (n) { n.remove(); });
    title.classList.remove('is-sweeping');
    title.style.removeProperty('--r');
  }

  function celebrate(cb) {
    var title = cb.parentNode.querySelector('.d-task-title');
    cleanupStar(title);
    if (!title || !starOn || reduceMotion.matches) return;      // CSS then does a plain green fade

    var w = title.offsetWidth, h = title.offsetHeight;
    var dur = clamp(600 + w * 3, 900, 1700);
    var radius = Math.max(9, h * 0.55);
    var star = el('span', 'd-star');
    star.setAttribute('aria-hidden', 'true');
    title.appendChild(star);
    title.classList.add('is-sweeping');
    title.style.setProperty('--r', '0');

    var t0 = performance.now(), lastSpark = 0;
    function frame(t) {
      if (!cb.checked) { cleanupStar(title); return; }          // unticked half way
      var p = Math.min(1, (t - t0) / dur);
      var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;       // ease in and out
      var x = -6 + e * (w + 12);
      var theta = p * Math.PI * 2 * 2;                                       // two full turns around the text
      var y = Math.sin(theta) * radius;
      var depth = 0.85 + 0.3 * Math.cos(theta);                              // near / far, like a star orbiting
      var fade = p > 0.9 ? (1 - p) / 0.1 : 1;
      star.style.transform = 'translate(' + (x + Math.cos(theta) * 5).toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (p * 720).toFixed(0) + 'deg) scale(' + (depth * fade).toFixed(2) + ')';
      title.style.setProperty('--r', (clamp(x / w, 0, 1) * 100).toFixed(1));

      if (t - lastSpark > 38) {                                              // glittering trail
        lastSpark = t;
        var sp = el('span', 'd-twinkle');
        sp.style.setProperty('--sx', x.toFixed(1) + 'px');
        sp.style.setProperty('--sy', y.toFixed(1) + 'px');
        sp.style.setProperty('--dx', ((Math.random() - 0.5) * 18).toFixed(1) + 'px');
        sp.style.setProperty('--dy', ((Math.random() - 0.5) * 22).toFixed(1) + 'px');
        sp.addEventListener('animationend', function () { sp.remove(); });
        title.appendChild(sp);
      }
      if (p < 1) { title._raf = requestAnimationFrame(frame); }
      else {
        title._raf = 0;
        star.remove();
        title.classList.remove('is-sweeping');
        title.style.removeProperty('--r');
      }
    }
    title._raf = requestAnimationFrame(frame);
  }

  /* ---------------- Heatmap (16 weeks, Monday first) ---------------- */
  var WEEKS = 16;
  var heat = $('#d-heat');
  var dow = (today.getDay() + 6) % 7;
  var todayIdx = (WEEKS - 1) * 7 + dow;
  var heatStart = addDays(today, -todayIdx);
  var levels = [], mins = [], heatCells = [];

  function heatDate(j) { return addDays(heatStart, j); }
  function heatText(j) {
    var date = heatDate(j).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return [mins[j] ? fmtMin(mins[j]) + ' worked' : 'No work logged', ' on ' + date];
  }
  function cellLabel(j) { var t = heatText(j); return t[0] + t[1]; }

  (function buildHeat() {
    var rnd = seeded(2026), rm = seeded(55);
    for (var i = 0; i <= todayIdx; i++) {
      var r = rnd();
      levels[i] = r < 0.2 ? 0 : r < 0.42 ? 1 : r < 0.68 ? 2 : r < 0.88 ? 3 : 4;
    }
    for (var k = 1; k <= 11; k++) levels[todayIdx - k] = Math.max(levels[todayIdx - k], 1);  // a real streak
    levels[todayIdx - 12] = 0;

    var base = [0, 30, 75, 150, 220], span = [0, 45, 75, 70, 100];
    for (var q = 0; q <= todayIdx; q++) {
      var l = levels[q];
      mins[q] = l ? Math.round((base[l] + rm() * span[l]) / 5) * 5 : 0;
    }

    for (var j = 0; j < WEEKS * 7; j++) {
      var c;
      if (j > todayIdx) { c = el('span', 'd-cell is-future'); c.setAttribute('aria-hidden', 'true'); }
      else {
        c = el('button', 'd-cell');
        c.type = 'button';
        c.dataset.l = levels[j];
        c.dataset.i = j;
        c.tabIndex = j === todayIdx ? 0 : -1;
        c.setAttribute('aria-label', cellLabel(j));
        if (j === todayIdx) c.classList.add('is-today');
      }
      heat.appendChild(c);
      heatCells.push(c);
    }

    // month names under the grid
    var months = $('#d-heat-months'), labels = [], prev = -1;
    for (var w = 0; w < WEEKS; w++) {
      var m = heatDate(w * 7).getMonth();
      if (w === 0 || m !== prev) labels.push({ w: w, m: m });
      prev = m;
    }
    if (labels.length > 1 && labels[1].w - labels[0].w < 2) labels.shift();
    labels.forEach(function (lb) {
      var s = el('span', '', new Date(2026, lb.m, 1).toLocaleDateString('en-US', { month: 'short' }));
      s.style.gridColumn = String(lb.w + 1);
      if (lb.w >= WEEKS - 1) s.style.justifySelf = 'end';
      months.appendChild(s);
    });
  })();

  /* Popup: date, year and total working time of the day (hover, tap, click or keyboard) */
  (function heatPopup() {
    var wrap = $('#d-heat-wrap'), pop = $('#d-heat-pop'), pinned = -1;

    function show(j) {
      var c = heatCells[j];
      if (!c || c.tagName !== 'BUTTON') return;
      var t = heatText(j);
      pop.textContent = '';
      pop.appendChild(el('b', '', t[0]));
      pop.appendChild(document.createTextNode(t[1]));
      pop.hidden = false;
      var cx = c.offsetLeft + c.offsetWidth / 2, pw = pop.offsetWidth;
      var left = clamp(cx - pw / 2, 0, Math.max(0, wrap.clientWidth - pw));
      pop.style.left = left + 'px';
      pop.style.top = (c.offsetTop - 10) + 'px';
      pop.style.setProperty('--ax', clamp(cx - left, 10, pw - 10) + 'px');
    }
    function hide() { pop.hidden = true; }
    function unpin() { if (pinned >= 0) heatCells[pinned].classList.remove('is-pinned'); pinned = -1; }
    function idx(e) { var c = e.target.closest('.d-cell'); return c && c.tagName === 'BUTTON' ? +c.dataset.i : -1; }

    heat.addEventListener('mouseover', function (e) { var j = idx(e); if (j >= 0) show(j); });
    heat.addEventListener('mouseleave', function () { if (pinned >= 0) show(pinned); else hide(); });
    heat.addEventListener('focusin', function (e) { var j = idx(e); if (j >= 0) show(j); });
    heat.addEventListener('focusout', function () { if (pinned >= 0) show(pinned); else hide(); });
    heat.addEventListener('click', function (e) {
      var j = idx(e); if (j < 0) return;
      unpin(); pinned = j; heatCells[j].classList.add('is-pinned'); show(j);
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('#d-heat-wrap')) { unpin(); hide(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { unpin(); hide(); } });

    heat.addEventListener('keydown', function (e) {                    // arrow keys move between days
      var j = idx(e); if (j < 0) return;
      var step = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (!step) return;
      var n = heatCells[j + step];
      if (n && n.tagName === 'BUTTON') {
        e.preventDefault();
        heatCells[j].tabIndex = -1; n.tabIndex = 0; n.focus();
      }
    });

    heat._refreshPop = function () { if (!pop.hidden) { var f = pinned >= 0 ? pinned : -1; if (f === todayIdx) show(f); } };
  })();

  function streakInfo() {
    var i = todayIdx, s = 0, run = 0, best = 0;
    if (levels[i] === 0) i--;           // today does not break the streak until it is over
    while (i >= 0 && levels[i] > 0) { s++; i--; }
    for (var k = 0; k <= todayIdx; k++) { run = levels[k] > 0 ? run + 1 : 0; best = Math.max(best, run); }
    return { current: s, best: best };
  }

  function renderHeat(ts) {
    var lvl = ts.done && ts.total ? Math.min(4, Math.ceil(ts.done / ts.total * 4)) : 0;
    levels[todayIdx] = lvl;
    mins[todayIdx] = ts.doneMin;
    heatCells[todayIdx].dataset.l = lvl;
    heatCells[todayIdx].setAttribute('aria-label', cellLabel(todayIdx));
    if (heat._refreshPop) heat._refreshPop();
    var st = streakInfo();
    $('#d-streak-sum').textContent = st.current
      ? plural(st.current, 'day', 'days') + ' in a row. Your best in 16 weeks is ' + plural(st.best, 'day', 'days') + '.'
      : 'No active streak. Finish a task today to start one.';
    return st;
  }

  /* ---------------- Activity chart (hours, bars or line) ---------------- */
  var range = '7';
  var ctype = store('pt-chart') === 'line' ? 'line' : 'bar';
  var chartData = {};
  var SLOT_ENDS = [9, 12, 15, 18, 21, 24];      // today is shown in 3 hour steps, 6 AM to midnight

  function fmtHour(h) { var hh = h % 24; return (hh % 12 || 12) + ' ' + (hh < 12 ? 'AM' : 'PM'); }

  function buildChartData() {
    var d7 = {
      labels: [],
      planned: PREV.planned.concat([0]), done: PREV.done.concat([0]),     // task counts (used by the stats)
      pMin: PREV.plannedMin.concat([0]), dMin: PREV.focus.concat([0]),    // minutes (used by the graph)
      cur: 6
    };
    for (var i = 6; i >= 0; i--) d7.labels.push(addDays(today, -i).toLocaleDateString('en-GB', { weekday: 'short' }));
    chartData['7'] = d7;

    function mondays(n) {
      var out = [], mon = addDays(today, -dow);
      for (var i = n - 1; i >= 0; i--) out.push(addDays(mon, -7 * i).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
      return out;
    }
    chartData['4'] = { labels: mondays(4), pMin: [1320, 1560, 1500, 1620], dMin: [960, 1260, 1320, 1380], cur: 3 };

    var rnd = seeded(7), p = [], dn = [];
    for (var w = 0; w < 12; w++) {
      var pl = (18 + Math.round(rnd() * 8)) * 60;
      p.push(pl); dn.push(Math.round(pl * (0.68 + rnd() * 0.27)));
    }
    chartData['12'] = { labels: mondays(12), pMin: p, dMin: dn, cur: 11 };
  }
  buildChartData();

  /* Today: running total of work, compared with the plan (each task is planned from its start time for its length) */
  function buildToday(ts) {
    var n = nowHours(), total = ts.doneMin + ts.leftMin;
    var cur = clamp(Math.floor((n - 6) / 3), 0, SLOT_ENDS.length - 1);
    var boxes = $$('input[type="checkbox"]', list);
    var plan = boxes.map(function (b) { return { start: +b.dataset.start || 0, min: +b.dataset.min || 0 }; });
    function planned(h) {
      return plan.reduce(function (a, t) { return a + (t.min ? t.min * clamp((h - t.start) / (t.min / 60), 0, 1) : 0); }, 0);
    }
    var ticks = boxes.filter(function (b) { return b.checked; }).map(function (b) { return { at: b.dataset.at ? +b.dataset.at : n, min: +b.dataset.min || 0 }; });
    var d = { labels: [], pMin: [], dMin: [], cur: cur, today: true };
    SLOT_ENDS.forEach(function (end, i) {
      d.labels.push(fmtHour(end));
      d.pMin.push(Math.round(planned(end)));
      d.dMin.push(i <= cur ? ticks.reduce(function (a, t) { return t.at <= end ? a + t.min : a; }, 0) : null);
    });
    var diff = ts.doneMin - planned(n), msg;
    if (!total) msg = 'No tasks planned for today yet.';
    else {
      msg = fmtMin(ts.doneMin) + ' worked of ' + fmtMin(total) + ' planned. ';
      if (ts.doneMin >= total) msg += 'Everything planned for today is done.';
      else if (Math.abs(diff) < 10) msg += 'You are right on schedule.';
      else if (diff > 0) msg += 'You are ' + fmtMin(diff) + ' ahead of schedule.';
      else msg += 'You are ' + fmtMin(-diff) + ' behind schedule.';
    }
    d.msg = msg;
    return d;
  }

  function niceStep(hMax) {
    var steps = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10, 12, 15, 20, 25, 50, 100];
    for (var i = 0; i < steps.length; i++) if (steps[i] * 4 >= hMax) return steps[i];
    return 100;
  }

  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function hue(ratio) { return 'hsl(' + Math.round(clamp(ratio, 0, 1) * 130) + ',78%,44%)'; }   // 0 = red, 1 = green
  function smooth(pts) {
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var mx = (pts[i - 1][0] + pts[i][0]) / 2;
      d += ' C' + mx.toFixed(1) + ' ' + pts[i - 1][1].toFixed(1) + ',' + mx.toFixed(1) + ' ' + pts[i][1].toFixed(1) + ',' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
    }
    return d;
  }

  function drawLine(plot, cols, d, topH, animate) {
    var W = plot.clientWidth, H = plot.clientHeight;
    if (!W || !H) return;
    var svg = svgEl('svg', { 'class': 'd-line', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' });
    var defs = svgEl('defs', {});
    var g = svgEl('linearGradient', { id: 'd-grad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: H });
    for (var k = 0; k <= 8; k++) g.appendChild(svgEl('stop', { offset: (k / 8 * 100) + '%', 'stop-color': hue(1 - k / 8) }));   // top green, bottom red
    defs.appendChild(g); svg.appendChild(defs);

    function pt(i, min) {
      var c = cols.children[i];
      return [c.offsetLeft + c.offsetWidth / 2, H - clamp(min / 60 / topH, 0, 1) * H];
    }
    var plan = [], done = [];
    d.labels.forEach(function (l, i) {
      plan.push(pt(i, d.pMin[i]));
      if (d.dMin[i] != null) done.push(pt(i, d.dMin[i]));
    });

    svg.appendChild(svgEl('polyline', { 'class': 'pl', points: plan.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') }));
    var line = null;
    if (done.length > 1) {
      var path = smooth(done);
      svg.appendChild(svgEl('path', { 'class': 'area', d: path + ' L' + done[done.length - 1][0].toFixed(1) + ' ' + H + ' L' + done[0][0].toFixed(1) + ' ' + H + ' Z' }));
      line = svgEl('path', { 'class': 'ln', d: path, pathLength: '1' });
      svg.appendChild(line);
    }
    done.forEach(function (p) {
      svg.appendChild(svgEl('circle', { 'class': 'pt', cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 5, fill: hue((H - p[1]) / H) }));
    });
    plot.appendChild(svg);

    if (line) {
      if (!animate) { line.style.transition = 'none'; line.classList.add('on'); }
      else requestAnimationFrame(function () { requestAnimationFrame(function () { line.classList.add('on'); }); });
    }
  }

  function renderChart(animate) {
    var d = chartData[range];
    var plot = $('.d-plot'), cols = $('#d-cols'), xl = $('#d-xlabels'), ya = $('#d-yaxis');
    var goalMin = (range === '4' || range === '12') ? goalDailyMin * 7 : goalDailyMin;
    var maxMin = goalMin;
    d.pMin.forEach(function (v) { maxMin = Math.max(maxMin, v); });
    d.dMin.forEach(function (v) { if (v != null) maxMin = Math.max(maxMin, v); });
    var step = niceStep(maxMin / 60), topH = step * 4, topMin = topH * 60;

    $('#activity').setAttribute('data-type', ctype);
    $$('.d-line', plot).forEach(function (n) { n.remove(); });

    ya.innerHTML = '';                                             // hours, 0 at the bottom and growing upwards
    for (var t = 4; t >= 0; t--) ya.appendChild(el('span', '', (+(step * t).toFixed(2)) + 'h'));

    cols.innerHTML = '';
    xl.innerHTML = '';
    xl.classList.toggle('is-dense', d.labels.length > 8);

    var sumP = 0, sumD = 0, tracks = [];
    d.labels.forEach(function (label, i) {
      var p = d.pMin[i], dn = d.dMin[i], has = dn != null;
      var mx = Math.max(p, has ? dn : 0);
      sumP += p; if (has) sumD += dn;

      var text = has ? fmtShort(dn) + ' of ' + fmtShort(p) : fmtShort(p) + ' planned';
      var pre = d.today ? 'by ' + label + ': ' : label + ': ';
      var col = el('div', 'd-col');
      col.setAttribute('role', 'listitem');
      col.tabIndex = 0;
      col.setAttribute('aria-label', pre + text + (has ? ' worked' : ''));

      var track = el('div', 'd-track');
      var fill = el('div', 'd-fill');
      track.appendChild(fill);
      col.appendChild(track);
      col.appendChild(el('span', 'd-tip', d.today ? 'by ' + label + ': ' + text : text));

      var h = (mx / topMin * 100) + '%', f = (mx && has ? Math.min(100, dn / mx * 100) : 0) + '%';
      if (animate) { tracks.push([track, fill, h, f]); }
      else { track.style.setProperty('--th', h); fill.style.setProperty('--f', f); }
      col.style.setProperty('--h', h);
      cols.appendChild(col);

      var lab = el('span', '', label);
      if (i === d.cur) lab.setAttribute('aria-current', 'date');
      xl.appendChild(lab);
    });

    if (animate) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          tracks.forEach(function (t) { t[0].style.setProperty('--th', t[2]); t[1].style.setProperty('--f', t[3]); });
        });
      });
    }

    // dashed line for the hours you set in your goals
    var gl = $('#d-goal-line'), kind = (range === '4' || range === '12') ? 'Weekly' : 'Daily';
    gl.style.bottom = (goalMin / topMin * 100) + '%';
    gl.style.display = goalMin ? '' : 'none';
    $('#d-goal-line-text').textContent = kind + ' goal ' + fmtShort(goalMin);
    $('#d-goal-legend').textContent = kind + ' goal from your goals: ' + fmtMin(goalMin) + ' (all goals together: ' + (+goalTotalH.toFixed(1)) + ' h)';

    if (ctype === 'line') drawLine(plot, cols, d, topH, animate);

    var span = range === '7' ? 'in the last 7 days' : range === '4' ? 'in the last 4 weeks' : 'in the last 12 weeks';
    var pct = sumP ? Math.round(sumD / sumP * 100) : 0;
    $('#d-chart-sum').textContent = d.today ? d.msg : fmtMin(sumD) + ' worked of ' + fmtMin(sumP) + ' planned ' + span + ' (' + pct + '%)';
  }

  /* ---------------- Sparklines ---------------- */
  function spark(id, arr) {
    var svg = $('#' + id);
    var w = 100, h = 34, pad = 4;
    var max = Math.max.apply(null, arr), min = Math.min.apply(null, arr), span = (max - min) || 1;
    var pts = arr.map(function (v, i) {
      return [pad + i * (w - 2 * pad) / (arr.length - 1), h - pad - (v - min) / span * (h - 2 * pad)];
    });
    var str = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var last = pts[pts.length - 1], lastStr = last[0].toFixed(1) + ',' + last[1].toFixed(1);
    svg.innerHTML = '<polyline points="' + str + '"/><polyline class="d-end" points="' + lastStr + ' ' + lastStr + '"/>';
  }

  /* ---------------- Stats and sidebar widget ---------------- */
  function renderStats(ts, st) {
    var d7 = chartData['7'];
    var doneSum = d7.done.reduce(function (a, b) { return a + b; }, 0);
    var plannedSum = d7.planned.reduce(function (a, b) { return a + b; }, 0);
    var focusWeek = PREV.focus.reduce(function (a, b) { return a + b; }, 0) + ts.doneMin;

    $('#s-goals').textContent = goalItems.length;
    var risk = goalItems.filter(function (g) { return g.dataset.status === 'risk'; }).length;
    $('#s-goals-note').textContent = risk ? plural(risk, 'goal needs', 'goals need') + ' attention' : 'All goals are on track';

    $('#s-tasks').textContent = doneSum;
    $('#s-tasks-note').textContent = 'of ' + plannedSum + ' planned';

    $('#s-streak').textContent = plural(st.current, 'day', 'days');
    $('#s-streak-note').textContent = 'Best: ' + plural(st.best, 'day', 'days');

    $('#s-focus').textContent = fmtShort(focusWeek);
    $('#s-focus-note').textContent = ts.doneMin ? 'Today so far: ' + fmtMin(ts.doneMin) : 'Nothing logged today yet';

    var pct = plannedSum ? Math.round(doneSum / plannedSum * 100) : 0;
    $('#sb-pct').textContent = pct + '%';
    $('#sb-meter').style.width = pct + '%';

    spark('sp-goals', [3, 3, 4, 4, 5, 5, goalItems.length]);
    spark('sp-tasks', d7.done);
    spark('sp-streak', levels.slice(todayIdx - 6, todayIdx + 1));
    spark('sp-focus', PREV.focus.concat([ts.doneMin]));
  }

  /* ---------------- One refresh for everything that depends on today's tasks ---------------- */
  function refresh(animateChart) {
    var ts = taskStats();
    var d7 = chartData['7'];
    d7.planned[6] = ts.total;
    d7.done[6] = ts.done;
    d7.pMin[6] = ts.doneMin + ts.leftMin;
    d7.dMin[6] = ts.doneMin;
    chartData['0'] = buildToday(ts);
    renderToday(ts);
    var st = renderHeat(ts);
    renderStats(ts, st);
    renderChart(!!animateChart);
  }

  list.addEventListener('change', function (e) {
    var cb = e.target;
    if (cb && cb.type === 'checkbox') {
      if (cb.checked) {
        var at = nowHours();
        cb.dataset.at = String(at);
        PTStore.setDone(todayKey, cb.dataset.id, at);
        celebrate(cb);
      } else {
        delete cb.dataset.at;
        PTStore.setDone(todayKey, cb.dataset.id, null);
        cleanupStar(cb.parentNode.querySelector('.d-task-title'));
      }
    }
    refresh(false);
  });

  /* ---------------- Range switch and graph type ---------------- */
  $$('#d-range button').forEach(function (b) {
    b.addEventListener('click', function () {
      range = b.dataset.range;
      $$('#d-range button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderChart(true);
    });
  });
  $$('#d-type button').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.type === ctype));
    b.addEventListener('click', function () {
      ctype = b.dataset.type;
      store('pt-chart', ctype);
      $$('#d-type button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      renderChart(true);
    });
  });
  (function () {                                    // the line is drawn in pixels, so redraw it when the width changes
    var plot = $('.d-plot'); if (!plot || !('ResizeObserver' in window)) return;
    var lastW = plot.clientWidth, queued = false;
    new ResizeObserver(function () {
      var w = plot.clientWidth;
      if (w === lastW || ctype !== 'line' || queued) return;
      lastW = w; queued = true;
      requestAnimationFrame(function () { queued = false; renderChart(false); });
    }).observe(plot);
  })();

  /* ---------------- Goals: filter + header search ---------------- */
  var filter = 'all', query = '';
  function applyGoals() {
    var shown = 0;
    goalItems.forEach(function (g) {
      var ok = (filter === 'all' || g.dataset.status === filter) && (!query || g.dataset.text.indexOf(query) !== -1);
      g.hidden = !ok;
      if (ok) shown++;
    });
    $('#d-empty').hidden = shown !== 0;
    $('#d-goal-count').textContent = shown === goalItems.length
      ? plural(goalItems.length, 'goal', 'goals') + ', sorted by due date'
      : 'Showing ' + shown + ' of ' + goalItems.length + ' goals';
  }

  $$('#d-filter button').forEach(function (b) {
    b.addEventListener('click', function () {
      filter = b.dataset.filter;
      $$('#d-filter button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      applyGoals();
    });
  });

  $('#d-q').addEventListener('input', function (e) { query = e.target.value.trim().toLowerCase(); applyGoals(); });
  $('#d-search').addEventListener('submit', function (e) { e.preventDefault(); $('#goals').scrollIntoView({ behavior: 'smooth' }); });

  /* ---------------- Coming up ---------------- */
  (function () {
    var items = [
      [1, 'Review the login and signup design', 'Finish login and signup', '10:00'],
      [2, 'Study group on React hooks', 'Learn React basics', '17:30'],
      [4, 'Typing test, goal is 60 words a minute', 'Practice typing every day', '09:00'],
      [7, 'Send the auth API draft', 'Finish login and signup', '18:00']
    ];
    var ul = $('#d-up-list');
    items.forEach(function (it) {
      var d = addDays(today, it[0]);
      var li = el('li', 'd-up');
      var date = el('div', 'd-date');
      date.appendChild(el('b', '', String(d.getDate())));
      date.appendChild(el('span', '', d.toLocaleDateString('en-GB', { month: 'short' })));
      var body = el('div');
      body.appendChild(el('h3', '', it[1]));
      body.appendChild(el('p', '', it[2] + ' at ' + it[3]));
      li.appendChild(date); li.appendChild(body);
      ul.appendChild(li);
    });
  })();

  /* ---------------- Start ---------------- */
  applyGoals();
  renderTaskList();
  refresh(false);                                   // first paint is still: no bars growing, no line drawing, no smooth scroll
  root.classList.add('is-ready');
  function endLoad() { setTimeout(function () { root.classList.remove('no-anim'); }, 600); }
  if (document.readyState === 'complete') endLoad(); else window.addEventListener('load', endLoad);
})();
