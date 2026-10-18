/* Goal details: opens from the orange "Needs attention" badge of one goal.
   Shows how much attention that goal got last month and this month, a graph like
   "Tasks completed" and a "Consistency" heatmap, all for this one goal.
   The history is sample data made from the goal's own numbers (replace with real data later). */
(function () {
  'use strict';

  var dlg = document.getElementById('goal-dialog');
  var glist = document.getElementById('d-goal-list');
  if (!dlg || !glist || typeof PTStore === 'undefined') return;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
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
  function seeded(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function dim(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function mon(d) { return d.toLocaleDateString('en-US', { month: 'short' }); }

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var N = 200, TI = N - 1;                                   // 200 days of history, the last one is today
  function dateAt(i) { return addDays(today, i - TI); }
  function idxOf(d) { return TI + Math.round((d - today) / 864e5); }

  var M = null;                                              // the goal that is open
  var range = 'this';
  var ctype = store('pt-chart') === 'line' ? 'line' : 'bar';

  /* ---------- read one goal from the list ---------- */
  function parseGoal(li) {
    var t = li.querySelector('time'), p = t.getAttribute('datetime').split('-');
    return {
      title: li.querySelector('h3').textContent.trim(),
      kind: li.querySelector('.d-goal-main p').textContent.trim(),
      hours: +li.dataset.hours || 0,
      status: li.dataset.status,
      pct: +li.querySelector('.d-bar').getAttribute('aria-valuenow') || 0,
      due: new Date(+p[0], +p[1] - 1, +p[2]),
      dueText: t.textContent.replace(/^Due\s+/, ''),
      prog: li.querySelector('.d-goal-prog span').textContent.trim(),
      c: li.style.getPropertyValue('--c') || 'var(--orange)'
    };
  }

  /* minutes of real work done today on tasks that belong to this goal (matched by the task's tag) */
  function realToday(g) {
    var done = PTStore.doneMap(PTStore.key(today)), t = g.title.toLowerCase(), sum = 0;
    PTStore.forDay(today).forEach(function (task) {
      var tag = task.tag.toLowerCase();
      if (done[task.id] == null || tag === 'added by you') return;
      if (t.indexOf(tag) >= 0 || tag.indexOf(t) >= 0) sum += task.min;
    });
    return sum;
  }

  /* ---------- build the history of one goal ---------- */
  function model(g) {
    var rnd = seeded(hash(g.title)), startIdx = TI - 60, startDate = dateAt(startIdx);
    var dueDays = Math.max(1, Math.round((g.due - today) / 864e5));
    var planPerDay = g.hours * 60 / (60 + dueDays + 1);                  // goal hours spread from its start to its due date
    var inten = { risk: [0.8, 1, 0.3], on: [1, 1, 1.1], near: [1, 1.2, 1] }[g.status] || [1, 1, 1];   // earlier months, last month, this month
    var ym = today.getFullYear() * 12 + today.getMonth(), w = [], sum = 0, i;
    for (i = 0; i < N; i++) {
      var v = 0;
      if (i >= startIdx && i < TI) {
        var d = dateAt(i), md = ym - (d.getFullYear() * 12 + d.getMonth());
        var f = md === 0 ? inten[2] : md === 1 ? inten[1] : inten[0];
        var p = (g.status === 'risk' && md === 0) ? 0.4 : 0.78;
        var a = rnd(), b = rnd();
        if (a < p) v = (0.4 + b * 1.2) * f;
      }
      w.push(v); sum += v;
    }
    var D = g.pct / 100 * g.hours * 60, scale = sum ? D / sum : 0;       // all days together add up to the progress already made
    var mins = w.map(function (x) { return Math.round(x * scale / 5) * 5; });
    mins[TI] = realToday(g);
    return {
      g: g, mins: mins, planPerDay: planPerDay, startDate: startDate,
      planAt: function (d) { return d >= startDate && d <= g.due ? planPerDay : 0; }
    };
  }

  function sumMins(a, b) { var s = 0; for (var i = Math.max(0, a); i <= Math.min(TI, b); i++) s += M.mins[i]; return s; }
  function sumPlan(a, b) { var s = 0; for (var i = a; i <= b; i++) s += M.planAt(dateAt(i)); return s; }

  /* ---------- top part: numbers ---------- */
  function renderTop() {
    var g = M.g, day = today.getDate();
    var ts = TI - (day - 1);                                             // first day of this month
    var lastDays = dim(today.getFullYear(), today.getMonth() - 1);
    var lastEnd = ts - 1, lastStart = lastEnd - lastDays + 1;
    var lastTotal = sumMins(lastStart, lastEnd), lastPlan = sumPlan(lastStart, lastEnd);
    var thisTotal = sumMins(ts, TI), thisPlan = sumPlan(ts, TI);
    var same = sumMins(lastStart, lastStart + day - 1);
    var daysLeft = Math.max(1, Math.round((g.due - today) / 864e5));
    var need = g.hours * 60 * (1 - g.pct / 100) / daysLeft;
    M.ts = ts; M.lastStart = lastStart; M.lastDays = lastDays; M.thisPlan = thisPlan;

    $('#gd-title').textContent = g.title;
    $('#gd-sub').textContent = g.kind + ' goal, due ' + g.dueText;
    $('#gd-prog-text').textContent = g.prog;
    var bar = $('#gd-bar');
    bar.setAttribute('aria-label', g.title + ' progress');
    bar.setAttribute('aria-valuenow', g.pct);
    bar.style.setProperty('--w', g.pct + '%');
    $('.gd-top').style.setProperty('--c', g.c);

    function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '0%'; }
    $('#gd-s1').textContent = fmtMin(lastTotal);
    $('#gd-n1').textContent = lastPlan ? pct(lastTotal, lastPlan) + ' of the plan for ' + new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long' }) : 'Not planned yet';
    $('#gd-s2').textContent = fmtMin(thisTotal);
    $('#gd-n2').textContent = thisPlan ? pct(thisTotal, thisPlan) + ' of the plan so far (day ' + day + ')' : 'Not planned yet';

    var diff = same ? Math.round((thisTotal - same) / same * 100) : null;
    $('#gd-s3').textContent = diff == null ? 'No data' : (diff > 0 ? '+' : diff < 0 ? '\u2212' : '') + Math.abs(diff) + '%';
    $('#gd-n3').textContent = same ? 'Same days last month: ' + fmtMin(same) : 'Nothing was logged last month';
    $('#gd-s4').textContent = fmtMin(need);
    $('#gd-n4').textContent = 'a day to finish by ' + g.dueText + ' (' + plural(daysLeft, 'day', 'days') + ' left)';

    var lead;
    if (!lastTotal && !thisTotal) lead = 'No time has been logged on this goal in the last two months.';
    else {
      lead = 'Last month this goal got ' + fmtMin(lastTotal) + '. This month it has got ' + fmtMin(thisTotal) + ' so far';
      if (diff != null) lead += ', which is ' + Math.abs(diff) + '% ' + (diff < 0 ? 'less' : 'more') + ' than the same days last month';
      lead += thisPlan && thisTotal < thisPlan ? '. It is ' + fmtMin(thisPlan - thisTotal) + ' behind the plan.' : '. It is on plan this month.';
    }
    $('#gd-lead').textContent = lead;
  }

  /* ---------- graph (same look as "Tasks completed") ---------- */
  function chartData() {
    var y = today.getFullYear(), m = today.getMonth(), labels = [], p = [], d = [], i, cur = -1, k;
    if (range === 'this') {
      var days = dim(y, m);
      for (k = 0; k < days; k++) {
        var date = addDays(dateAt(M.ts), k);
        labels.push(String(k + 1)); p.push(M.planAt(date)); d.push(M.ts + k <= TI ? M.mins[M.ts + k] : null);
      }
      cur = today.getDate() - 1;
    } else if (range === 'last') {
      for (k = 0; k < M.lastDays; k++) {
        labels.push(String(k + 1)); p.push(M.planAt(dateAt(M.lastStart + k))); d.push(M.mins[M.lastStart + k]);
      }
    } else {
      for (var back = 5; back >= 0; back--) {
        var first = new Date(y, m - back, 1), n = dim(first.getFullYear(), first.getMonth()), sp = 0, sd = 0;
        for (k = 0; k < n; k++) {
          var dd = new Date(first.getFullYear(), first.getMonth(), k + 1);
          sp += M.planAt(dd);
          i = idxOf(dd); if (i >= 0 && i <= TI) sd += M.mins[i];
        }
        labels.push(mon(first)); p.push(sp); d.push(sd);
      }
      cur = 5;
    }
    return { labels: labels, p: p, d: d, cur: cur };
  }

  function niceAxis(maxMin) {
    var i, s;
    if (maxMin <= 180) {
      s = [5, 10, 15, 20, 25, 30, 40, 45, 60];
      for (i = 0; i < s.length; i++) if (s[i] * 4 >= maxMin) return { unit: 'm', step: s[i], top: s[i] * 4 };
    }
    s = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 10, 12, 15, 20, 25, 50, 100];
    for (i = 0; i < s.length; i++) if (s[i] * 4 * 60 >= maxMin) return { unit: 'h', step: s[i], top: s[i] * 4 * 60 };
    return { unit: 'h', step: 100, top: 24000 };
  }

  var NS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) { var n = document.createElementNS(NS, name); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }
  function hue(r) { return 'hsl(' + Math.round(clamp(r, 0, 1) * 130) + ',78%,44%)'; }
  function smooth(pts) {
    var s = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var mx = (pts[i - 1][0] + pts[i][0]) / 2;
      s += ' C' + mx.toFixed(1) + ' ' + pts[i - 1][1].toFixed(1) + ',' + mx.toFixed(1) + ' ' + pts[i][1].toFixed(1) + ',' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1);
    }
    return s;
  }

  function drawLine(plot, cols, d, topMin, animate) {
    var W = plot.clientWidth, H = plot.clientHeight;
    if (!W || !H) return;
    var svg = svgEl('svg', { 'class': 'd-line', viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, 'aria-hidden': 'true' });
    var defs = svgEl('defs', {});
    var g = svgEl('linearGradient', { id: 'gd-grad', gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: 0, y2: H });
    for (var k = 0; k <= 8; k++) g.appendChild(svgEl('stop', { offset: (k / 8 * 100) + '%', 'stop-color': hue(1 - k / 8) }));
    defs.appendChild(g); svg.appendChild(defs);

    function pt(i, v) { var c = cols.children[i]; return [c.offsetLeft + c.offsetWidth / 2, H - clamp(v / topMin, 0, 1) * H]; }
    var plan = [], done = [];
    d.labels.forEach(function (l, i) { plan.push(pt(i, d.p[i])); if (d.d[i] != null) done.push(pt(i, d.d[i])); });

    svg.appendChild(svgEl('polyline', { 'class': 'pl', points: plan.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') }));
    var line = null;
    if (done.length > 1) {
      var path = smooth(done);
      svg.appendChild(svgEl('path', { 'class': 'area', d: path + ' L' + done[done.length - 1][0].toFixed(1) + ' ' + H + ' L' + done[0][0].toFixed(1) + ' ' + H + ' Z' }));
      line = svgEl('path', { 'class': 'ln', d: path, pathLength: '1' });
      svg.appendChild(line);
    }
    var many = d.labels.length > 12;
    done.forEach(function (q) { svg.appendChild(svgEl('circle', { 'class': 'pt', cx: q[0].toFixed(1), cy: q[1].toFixed(1), r: many ? 3 : 5, fill: hue((H - q[1]) / H) })); });
    plot.appendChild(svg);
    if (line) {
      if (!animate) { line.style.transition = 'none'; line.classList.add('on'); }
      else requestAnimationFrame(function () { requestAnimationFrame(function () { line.classList.add('on'); }); });
    }
  }

  function renderChart(animate) {
    var d = chartData();
    var chart = $('#gd-activity'), plot = $('#gd-plot'), cols = $('#gd-cols'), xl = $('#gd-xlabels'), ya = $('#gd-yaxis');
    var maxMin = 0;
    d.p.forEach(function (v) { maxMin = Math.max(maxMin, v); });
    d.d.forEach(function (v) { if (v != null) maxMin = Math.max(maxMin, v); });
    var ax = niceAxis(maxMin || 5), topMin = ax.top;

    chart.setAttribute('data-type', ctype);
    $$('.d-line', plot).forEach(function (n) { n.remove(); });
    ya.innerHTML = '';
    for (var t = 4; t >= 0; t--) ya.appendChild(el('span', '', (+(ax.step * t).toFixed(2)) + (ax.unit === 'm' ? 'm' : 'h')));   // 0 at the bottom, growing upwards

    cols.innerHTML = ''; xl.innerHTML = '';
    var many = d.labels.length > 12;
    cols.classList.toggle('is-many', many); xl.classList.toggle('is-many', many);
    xl.classList.toggle('is-dense', d.labels.length > 8);

    var tracks = [], sumP = 0, sumD = 0, planSoFar = 0;
    d.labels.forEach(function (label, i) {
      var p = d.p[i], dn = d.d[i], has = dn != null, mx = Math.max(p, has ? dn : 0);
      sumP += p; if (has) { sumD += dn; planSoFar += p; }
      var full = range === 'six' ? label : mon(range === 'last' ? new Date(today.getFullYear(), today.getMonth() - 1, 1) : today) + ' ' + label;
      var text = has ? fmtShort(dn) + ' of ' + fmtShort(p) : fmtShort(p) + ' planned';
      var col = el('div', 'd-col');
      col.setAttribute('role', 'listitem'); col.tabIndex = 0;
      col.setAttribute('aria-label', full + ': ' + text + (has ? ' given to this goal' : ''));
      var track = el('div', 'd-track'), fill = el('div', 'd-fill');
      track.appendChild(fill); col.appendChild(track);
      col.appendChild(el('span', 'd-tip', many ? full + ': ' + text : text));
      var h = (mx / topMin * 100) + '%', f = (mx && has ? Math.min(100, dn / mx * 100) : 0) + '%';
      if (animate) tracks.push([track, fill, h, f]); else { track.style.setProperty('--th', h); fill.style.setProperty('--f', f); }
      col.style.setProperty('--h', h);
      cols.appendChild(col);
      var lab = el('span', '', label);
      if (i === d.cur) lab.setAttribute('aria-current', 'date');
      xl.appendChild(lab);
    });
    if (animate) {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        tracks.forEach(function (q) { q[0].style.setProperty('--th', q[2]); q[1].style.setProperty('--f', q[3]); });
      }); });
    }
    if (ctype === 'line') drawLine(plot, cols, d, topMin, animate);

    var pc = planSoFar ? Math.round(sumD / planSoFar * 100) : 0, txt;
    if (range === 'this') txt = fmtMin(sumD) + ' given so far this month, ' + pc + '% of the ' + fmtMin(planSoFar) + ' planned until today';
    else if (range === 'last') txt = fmtMin(sumD) + ' given last month, ' + pc + '% of the ' + fmtMin(sumP) + ' planned';
    else txt = fmtMin(sumD) + ' given in the last 6 months. The plan for these months is ' + fmtMin(sumP) + '.';
    $('#gd-chart-sum').textContent = txt;
  }

  /* ---------- consistency heatmap for this goal ---------- */
  var WEEKS = 16, heat = $('#gd-heat'), heatCells = [], heatMins = [], pinned = -1;
  var wrap = $('#gd-heat-wrap'), pop = $('#gd-heat-pop');

  function renderHeat() {
    var dow = (today.getDay() + 6) % 7, todayJ = (WEEKS - 1) * 7 + dow, j, mx = 1;
    heat.textContent = ''; $('#gd-heat-months').textContent = ''; heatCells = []; heatMins = []; pinned = -1; pop.hidden = true;
    for (j = 0; j <= todayJ; j++) { heatMins[j] = M.mins[TI - (todayJ - j)]; mx = Math.max(mx, heatMins[j]); }

    for (j = 0; j < WEEKS * 7; j++) {
      var c;
      if (j > todayJ) { c = el('span', 'd-cell is-future'); c.setAttribute('aria-hidden', 'true'); }
      else {
        var m = heatMins[j], r = m / mx, l = !m ? 0 : r < 0.25 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 3 : 4;
        c = el('button', 'd-cell'); c.type = 'button';
        c.dataset.l = l; c.dataset.i = j; c.tabIndex = j === todayJ ? 0 : -1;
        c.setAttribute('aria-label', label(j, todayJ));
        if (j === todayJ) c.classList.add('is-today');
      }
      heat.appendChild(c); heatCells.push(c);
    }
    heat._todayJ = todayJ;

    var months = $('#gd-heat-months'), labs = [], prev = -1, w;
    for (w = 0; w < WEEKS; w++) {
      var mm = addDays(dateAt(TI - todayJ), w * 7).getMonth();
      if (w === 0 || mm !== prev) labs.push({ w: w, m: mm });
      prev = mm;
    }
    if (labs.length > 1 && labs[1].w - labs[0].w < 2) labs.shift();
    labs.forEach(function (lb) {
      var s = el('span', '', new Date(2026, lb.m, 1).toLocaleDateString('en-US', { month: 'short' }));
      s.style.gridColumn = String(lb.w + 1);
      if (lb.w >= WEEKS - 1) s.style.justifySelf = 'end';
      months.appendChild(s);
    });

    // streak text
    var i = todayJ, cur = 0, best = 0, run = 0, active = 0;
    if (!heatMins[i]) i--;
    while (i >= 0 && heatMins[i] > 0) { cur++; i--; }
    for (j = 0; j <= todayJ; j++) { run = heatMins[j] > 0 ? run + 1 : 0; best = Math.max(best, run); }
    for (j = M.ts; j <= TI; j++) if (M.mins[j] > 0) active++;
    var tail = ' You worked on it ' + active + ' of ' + today.getDate() + ' days this month.';
    $('#gd-streak-sum').textContent = (cur ? plural(cur, 'day', 'days') + ' in a row on this goal. Best in 16 weeks: ' + plural(best, 'day', 'days') + '.'
      : 'No active streak on this goal. Best in 16 weeks: ' + plural(best, 'day', 'days') + '.') + tail;
  }

  function dayDate(j, todayJ) { return addDays(today, j - todayJ); }
  function text(j, todayJ) {
    var date = dayDate(j, todayJ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return [heatMins[j] ? fmtMin(heatMins[j]) + ' on this goal' : 'No time on this goal', ' on ' + date];
  }
  function label(j, todayJ) { var t = text(j, todayJ); return t[0] + t[1]; }

  function showPop(j) {
    var c = heatCells[j]; if (!c || c.tagName !== 'BUTTON') return;
    var t = text(j, heat._todayJ);
    pop.textContent = ''; pop.appendChild(el('b', '', t[0])); pop.appendChild(document.createTextNode(t[1]));
    pop.hidden = false;
    var cx = c.offsetLeft + c.offsetWidth / 2, pw = pop.offsetWidth;
    var left = clamp(cx - pw / 2, 0, Math.max(0, wrap.clientWidth - pw));
    pop.style.left = left + 'px'; pop.style.top = (c.offsetTop - 10) + 'px';
    pop.style.setProperty('--ax', clamp(cx - left, 10, pw - 10) + 'px');
  }
  function hidePop() { pop.hidden = true; }
  function unpin() { if (pinned >= 0 && heatCells[pinned]) heatCells[pinned].classList.remove('is-pinned'); pinned = -1; }
  function idx(e) { var c = e.target.closest('.d-cell'); return c && c.tagName === 'BUTTON' ? +c.dataset.i : -1; }

  heat.addEventListener('mouseover', function (e) { var j = idx(e); if (j >= 0) showPop(j); });
  heat.addEventListener('mouseleave', function () { if (pinned >= 0) showPop(pinned); else hidePop(); });
  heat.addEventListener('focusin', function (e) { var j = idx(e); if (j >= 0) showPop(j); });
  heat.addEventListener('focusout', function () { if (pinned >= 0) showPop(pinned); else hidePop(); });
  heat.addEventListener('click', function (e) { var j = idx(e); if (j < 0) return; unpin(); pinned = j; heatCells[j].classList.add('is-pinned'); showPop(j); });
  wrap.closest('.d-panel').addEventListener('click', function (e) { if (!e.target.closest('#gd-heat-wrap')) { unpin(); hidePop(); } });
  heat.addEventListener('keydown', function (e) {
    var j = idx(e); if (j < 0) return;
    var step = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    var n = heatCells[j + step];
    if (n && n.tagName === 'BUTTON') { e.preventDefault(); heatCells[j].tabIndex = -1; n.tabIndex = 0; n.focus(); }
  });

  /* ---------- open / controls ---------- */
  function syncButtons() {
    $$('#gd-range button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.range === range)); });
    $$('#gd-type button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.type === ctype)); });
  }

  function openGoal(li) {
    M = model(parseGoal(li));
    range = 'this';
    syncButtons();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    dlg.scrollTop = 0;
    renderTop();
    renderChart(true);
    renderHeat();
  }

  glist.addEventListener('click', function (e) {
    var b = e.target.closest('button.d-status');
    if (b) openGoal(b.closest('.d-goal'));
  });

  $$('#gd-range button').forEach(function (b) {
    b.addEventListener('click', function () { range = b.dataset.range; syncButtons(); renderChart(true); });
  });
  $$('#gd-type button').forEach(function (b) {
    b.addEventListener('click', function () { ctype = b.dataset.type; store('pt-chart', ctype); syncButtons(); renderChart(true); });
  });

  (function () {                       // the line is drawn in pixels, so redraw it when the width changes
    var plot = $('#gd-plot'); if (!plot || !('ResizeObserver' in window)) return;
    var lastW = 0, queued = false;
    new ResizeObserver(function () {
      var w = plot.clientWidth;
      if (!M || !w || w === lastW) { lastW = w; return; }
      lastW = w;
      if (ctype !== 'line' || queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; renderChart(false); });
    }).observe(plot);
  })();
})();
