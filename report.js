/* report.js - builds the printable report from the same data the dashboard uses.
   Tasks + ticks come from tasks-store.js (localStorage "pt-tasks" / "pt-done"),
   the name from "pt-profile". Goals are read from dashboard.html (they are written
   in that page's HTML) and are left out if that page cannot be loaded.

   Choices on the page:
     1. Report for : all tasks, or one task
     2. Period     : Today | 7 days | This month | 6 months   (the report covers exactly that)
     3. Include    : line graph, task details, daily log, goals, notes lines */
(function () {
  'use strict';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;          // textContent only: task names are user input
    return n;
  }
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function parseKey(k) { var p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function dateText(d, long) {
    return d.toLocaleDateString('en-GB', long
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function shortDate(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function clock(h) {                                  // 9.75 -> "9:45 AM"
    var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    if (mm === 60) { hh += 1; mm = 0; }
    return PTStore.label(pad(hh % 24) + ':' + pad(mm));
  }
  function nowHours() { var n = new Date(); return n.getHours() + n.getMinutes() / 60; }
  function axisMin(m) {                                // short text for graph axes
    if (m < 60) return m + ' m';
    var h = Math.floor(m / 60), r = m % 60;
    return r ? h + ' h ' + r + 'm' : h + ' h';
  }

  /* ---------------- State ---------------- */
  var today = new Date(); today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var todayKey = PTStore.key(today);
  var params = new URLSearchParams(location.search);
  var scope = params.get('scope') === 'task' ? 'task' : 'all';
  var taskId = params.get('task') || '';
  var period = ['1', '7', 'month', '6m'].indexOf(params.get('period')) >= 0 ? params.get('period') : '7';
  var goals = null;                                    // filled after dashboard.html is read

  var profile = { name: 'Alex', email: 'alex@example.com' };
  var sp = readJSON('pt-profile');
  if (sp && typeof sp === 'object') {
    if (sp.name) profile.name = String(sp.name).slice(0, 40);
    if (sp.email) profile.email = String(sp.email).slice(0, 80);
  }

  /* ---------------- Period ---------------- */
  function periodDays() {                              // oldest first, always ends today
    var start;
    if (period === '1') start = today;
    else if (period === '7') start = addDays(today, -6);
    else if (period === 'month') start = new Date(today.getFullYear(), today.getMonth(), 1);
    else start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    var out = [];
    for (var d = start; d <= today; d = addDays(d, 1)) out.push(d);
    return out;
  }

  function periodLabel(days) {
    var a = days[0], b = days[days.length - 1];
    if (period === '1') return 'Today (' + dateText(today) + ')';
    if (period === '7') return 'Last 7 days (' + dateText(a) + ' to ' + dateText(b) + ')';
    if (period === 'month') return 'This month (' + today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) + ', ' + shortDate(a) + ' to ' + shortDate(b) + ')';
    return 'Last 6 months (' + dateText(a) + ' to ' + dateText(b) + ')';
  }

  /* ---------------- Data ---------------- */
  function build() {
    var tasks = PTStore.all(), byId = {};
    tasks.forEach(function (t) { byId[t.id] = t; });

    if (scope === 'task' && !byId[taskId]) taskId = tasks[0] ? tasks[0].id : '';
    if (!tasks.length) scope = 'all';

    var scoped = scope === 'task' ? tasks.filter(function (t) { return t.id === taskId; }) : tasks;
    var inScope = {}; scoped.forEach(function (t) { inScope[t.id] = true; });

    var days = periodDays();
    var info = days.map(function (d) {
      var k = PTStore.key(d), done = PTStore.doneMap(k), items = [];
      Object.keys(done).forEach(function (id) { if (inScope[id]) items.push({ task: byId[id], at: +done[id] }); });
      var sched = PTStore.forDay(d).filter(function (t) { return inScope[t.id]; });
      var pm = 0, dm = 0;
      sched.forEach(function (t) { pm += t.min; });
      items.forEach(function (i) { dm += i.task.min; });
      return { date: d, key: k, sched: sched, done: items, planMin: pm, doneMin: dm };
    });

    var doneMin = 0, doneCount = 0, active = 0, schedOnActive = 0;
    info.forEach(function (x) {
      if (!x.done.length) return;
      active++; doneCount += x.done.length; schedOnActive += x.sched.length; doneMin += x.doneMin;
    });

    /* "Last done" looks at every saved day, so it is never cut off by the period */
    var all = readJSON('pt-done') || {}, last = {}, inPeriod = {};
    Object.keys(all).sort().forEach(function (k) {
      var m = all[k]; if (!m || typeof m !== 'object') return;
      Object.keys(m).forEach(function (id) { if (byId[id]) last[id] = k; });
    });
    info.forEach(function (x) { x.done.forEach(function (i) { inPeriod[i.task.id] = (inPeriod[i.task.id] || 0) + 1; }); });

    var tInfo = info[info.length - 1];                 // today
    var todayDone = PTStore.doneMap(todayKey);
    var tPlanMin = tInfo.planMin, tDoneMin = tInfo.doneMin, tDone = tInfo.done.length;

    return {
      scoped: scoped, info: info, days: days, doneMin: doneMin, doneCount: doneCount, active: active,
      rate: schedOnActive ? Math.round(doneCount / schedOnActive * 100) : null,
      last: last, inPeriod: inPeriod,
      todayTasks: tInfo.sched, todayDone: todayDone, tPlanMin: tPlanMin, tDoneMin: tDoneMin, tDone: tDone
    };
  }

  /* ---------------- Table helpers ---------------- */
  function section(title, note, cls) {
    var s = el('section', 'rp-section' + (cls ? ' ' + cls : ''));
    var h = el('h2', '', title);
    if (note) h.appendChild(el('small', '', note));
    s.appendChild(h);
    return s;
  }

  function table(headers, rows, emptyText) {
    var wrap = el('div', 'rp-scroll');
    var t = el('table', 'rp-table' + (headers[0] && headers[0].text === '#' ? ' rp-idx' : ''));
    var thead = el('thead'), hr = el('tr');
    headers.forEach(function (h) {
      var th = el('th', h.num ? 'num' : '', h.text); th.scope = 'col'; hr.appendChild(th);
    });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    if (!rows.length) {
      var tr = el('tr'), td = el('td', 'rp-empty', emptyText); td.colSpan = headers.length; tr.appendChild(td); tb.appendChild(tr);
    }
    rows.forEach(function (cells) {
      var tr = el('tr');
      cells.forEach(function (c, i) {
        var td = el('td', headers[i] && headers[i].num ? 'num' : '');
        if (c && c.nodeType) td.appendChild(c); else td.textContent = c == null ? '' : String(c);
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb); wrap.appendChild(t);
    return wrap;
  }

  function chip(kind, text) { return el('span', 'rp-chip ' + kind, text); }
  function strong(text) { return el('span', 'rp-title', text); }
  function repeatText(t) { return t.repeat === 'daily' ? 'Every day' : dateText(parseKey(t.date)); }
  function timeText(t) { return PTStore.label(t.start) + ' - ' + PTStore.endLabel(t.start, t.min); }

  function kpi(label, value, small, pct) {
    var k = el('div', 'rp-kpi');
    k.appendChild(el('span', '', label));
    k.appendChild(el('strong', '', value));
    if (small) k.appendChild(el('small', '', small));
    if (pct != null) { var b = el('div', 'rp-bar-mini'), i = el('i'); i.style.width = pct + '%'; b.appendChild(i); k.appendChild(b); }
    return k;
  }

  /* ---------------- Line graph ---------------- */
  var NS = 'http://www.w3.org/2000/svg';
  function sv(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function niceStep(max) {
    var steps = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 600], i = 0;
    while (i < steps.length - 1 && max / steps[i] > 4) i++;
    return steps[i];
  }

  /* c = { labels:[text], done:[min|null], planned:[min], every:n, alt:text } */
  function lineChart(c) {
    var W = 640, H = 250, L = 56, R = 18, T = 24, B = 40, pw = W - L - R, ph = H - T - B;
    var n = c.labels.length, maxV = 0;
    c.done.concat(c.planned).forEach(function (v) { if (v != null && v > maxV) maxV = v; });
    var step = maxV ? niceStep(maxV) : 15, ymax = maxV ? step * Math.ceil(maxV / step) : 60;
    function X(i) { return n === 1 ? L + pw / 2 : L + pw * i / (n - 1); }
    function Y(v) { return T + ph - ph * v / ymax; }

    var svg = sv('svg', { 'class': 'rp-graph', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': c.alt });
    for (var v = 0; v <= ymax; v += step) {
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: v ? '#dbe2ef' : '#14213d', 'stroke-width': v ? 1 : 1.5 }));
      svg.appendChild(sv('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 700, fill: '#5a6784' }, axisMin(v)));
    }
    c.labels.forEach(function (lb, i) {
      if (i % c.every !== 0) return;
      svg.appendChild(sv('line', { x1: X(i), x2: X(i), y1: T + ph, y2: T + ph + 4, stroke: '#14213d' }));
      svg.appendChild(sv('text', { x: X(i), y: H - 16, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#5a6784' }, lb));
    });

    function pts(arr) {
      var o = [];
      arr.forEach(function (v, i) { if (v != null) o.push([X(i), Y(v), i, v]); });
      return o;
    }
    var pp = pts(c.planned), dp = pts(c.done);

    if (pp.length > 1) svg.appendChild(sv('polyline', { points: pp.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '), fill: 'none', stroke: '#5a6784', 'stroke-width': 2, 'stroke-dasharray': '6 4', 'stroke-linejoin': 'round' }));
    if (dp.length > 1) {
      var base = (T + ph).toFixed(1);
      svg.appendChild(sv('polygon', { points: dp[0][0].toFixed(1) + ',' + base + ' ' + dp.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + ' ' + dp[dp.length - 1][0].toFixed(1) + ',' + base, fill: 'rgba(12,35,64,0.10)' }));
      svg.appendChild(sv('polyline', { points: dp.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '), fill: 'none', stroke: '#0c2340', 'stroke-width': 2.75, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    }
    var showDots = dp.length <= 40, showVals = dp.length <= 8;
    dp.forEach(function (p) {
      if (showDots) svg.appendChild(sv('circle', { cx: p[0], cy: p[1], r: 3.6, fill: '#fff', stroke: '#0c2340', 'stroke-width': 2 }));
      if (showVals && p[3] > 0) svg.appendChild(sv('text', { x: p[0], y: p[1] - 9, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 800, fill: '#14213d' }, axisMin(p[3])));
    });
    return svg;
  }

  function chartData(d) {
    var labels = [], done = [], planned = [], every = 1, title, alt;

    if (period === '1') {                              // running total through the day
      var sched = d.todayTasks, doneMap = d.todayDone, n = nowHours();
      var lo = 6, hi = 22;
      sched.forEach(function (t) { lo = Math.min(lo, Math.floor(PTStore.hours(t.start))); hi = Math.max(hi, Math.ceil(PTStore.hours(t.start) + t.min / 60)); });
      hi = Math.min(hi, 24);
      var ticks = [];
      sched.forEach(function (t) { if (doneMap[t.id] != null) ticks.push({ at: Math.min(+doneMap[t.id] || n, n), min: t.min }); });
      for (var h = lo; h <= hi; h++) {
        labels.push((h % 12 || 12) + (h % 24 < 12 ? ' AM' : ' PM'));
        planned.push(Math.round(sched.reduce(function (a, t) { var s = PTStore.hours(t.start); return a + t.min * clamp((h - s) / (t.min / 60), 0, 1); }, 0)));
        done.push(h <= Math.ceil(n) ? ticks.reduce(function (a, t) { return t.at <= h ? a + t.min : a; }, 0) : null);
      }
      every = Math.ceil(labels.length / 9);
      title = 'Focus time through the day'; alt = 'Line graph of focus time worked and planned through today';
    } else if (period === '6m') {                      // one point per week
      var buckets = [], map = {};
      d.info.forEach(function (x) {
        var wk = addDays(x.date, -((x.date.getDay() + 6) % 7)), k = PTStore.key(wk);
        if (!map[k]) { map[k] = { start: wk, done: 0, plan: 0 }; buckets.push(map[k]); }
        map[k].done += x.doneMin; map[k].plan += x.planMin;
      });
      buckets.forEach(function (b) { labels.push(shortDate(b.start)); done.push(b.done); planned.push(b.plan); });
      every = Math.ceil(labels.length / 9);
      title = 'Focus time per week'; alt = 'Line graph of focus time worked and planned for each week of the last 6 months';
    } else {                                           // one point per day
      d.info.forEach(function (x) { labels.push(period === '7' ? x.date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }) : String(x.date.getDate())); done.push(x.doneMin); planned.push(x.planMin); });
      every = period === '7' ? 1 : Math.ceil(labels.length / 10);
      title = 'Focus time per day'; alt = 'Line graph of focus time worked and planned for each day';
    }
    return { labels: labels, done: done, planned: planned, every: every, title: title, alt: alt };
  }

  /* ---------------- Render ---------------- */
  function render() {
    var d = build(), sheet = $('#rp-sheet');
    var opt = { graph: $('#rp-o-graph').checked, tasks: $('#rp-o-tasks').checked, log: $('#rp-o-log').checked, goals: $('#rp-o-goals').checked, notes: $('#rp-o-notes').checked };
    var one = scope === 'task', isToday = period === '1', me = d.scoped[0];
    sheet.textContent = '';

    /* Heading */
    var head = el('header', 'rp-head');
    var brand = el('div', 'rp-brand'); brand.appendChild(el('span', 'rp-mark')); brand.appendChild(el('span', '', 'Progress tracker'));
    head.appendChild(brand);
    head.appendChild(el('h1', '', 'Progress report'));
    var meta = el('dl', 'rp-meta');
    [['Name', profile.name], ['Email', profile.email],
     ['Report for', one && me ? 'One task: ' + me.title : 'All tasks'],
     ['Period', periodLabel(d.days)],
     ['Generated', dateText(new Date(), true) + ', ' + clock(nowHours())]]
      .forEach(function (m) { var w = el('div'); w.appendChild(el('dt', '', m[0])); w.appendChild(el('dd', '', m[1])); meta.appendChild(w); });
    head.appendChild(meta);
    sheet.appendChild(head);

    /* Summary: only the chosen period */
    var sum = section('Summary', isToday ? dateText(today) : null);
    var k = el('div', 'rp-kpis');
    if (isToday) {
      var tp = d.todayTasks.length, tPct = tp ? Math.round(d.tDone / tp * 100) : 0;
      k.appendChild(kpi(one ? 'Planned today' : 'Tasks planned', String(tp), tp ? 'for today' : 'nothing planned today'));
      k.appendChild(kpi('Completed', d.tDone + ' of ' + tp, 'done today'));
      k.appendChild(kpi('Completion', tPct + '%', null, tPct));
      k.appendChild(kpi('Focus time', PTStore.dur(d.tDoneMin), 'of ' + PTStore.dur(d.tPlanMin) + ' planned'));
      k.appendChild(kpi('Still to do', String(tp - d.tDone), PTStore.dur(d.tPlanMin - d.tDoneMin) + ' left'));
    } else {
      k.appendChild(kpi(one ? 'Times completed' : 'Tasks completed', String(d.doneCount), 'in this period'));
      k.appendChild(kpi('Active days', d.active + ' of ' + d.days.length, 'days with a task done'));
      k.appendChild(kpi('Focus time', PTStore.dur(d.doneMin), 'in this period'));
      k.appendChild(kpi('Completion rate', d.rate == null ? '-' : d.rate + '%', 'on active days', d.rate));
    }
    sum.appendChild(k);
    sheet.appendChild(sum);

    /* Line graph */
    if (opt.graph) {
      var cd = chartData(d);
      var g = section('Progress graph', cd.title, 'rp-graph-box');
      g.appendChild(lineChart(cd));
      var lg = el('div', 'rp-legend');
      var a = el('span'); a.appendChild(el('i')); a.appendChild(document.createTextNode(isToday ? 'Worked so far' : 'Worked'));
      var b = el('span'); b.appendChild(el('i', 'dash')); b.appendChild(document.createTextNode('Planned'));
      lg.appendChild(a); lg.appendChild(b);
      g.appendChild(lg);
      g.appendChild(el('p', 'rp-cap', 'Planned comes from your current task list, so days before a task was added also show it as planned.'));
      sheet.appendChild(g);
    }

    /* Task details */
    if (opt.tasks) {
      if (isToday) {
        var tdy = section(one ? 'Task' : "Today's tasks", dateText(today));
        var n = nowHours();
        var trows = d.todayTasks.map(function (t, i) {
          var st, at = d.todayDone[t.id];
          if (at != null) st = chip('done', '\u2713 Done at ' + clock(Math.min(+at || n, 24)));
          else {
            var s = PTStore.hours(t.start), e = s + t.min / 60;
            st = n >= e ? chip('missed', '\u2715 Not done') : n >= s ? chip('pending', '\u25D0 In progress') : chip('pending', '\u25CB Upcoming');
          }
          return [i + 1, strong(t.title), t.tag, timeText(t), PTStore.dur(t.min), st];
        });
        tdy.appendChild(table(
          [{ text: '#' }, { text: 'Task' }, { text: 'Goal' }, { text: 'Time' }, { text: 'Duration' }, { text: 'Status' }],
          trows, one ? 'This task is not planned for today.' : 'No tasks are planned for today.'));
        sheet.appendChild(tdy);
      } else {
        var det = section(one ? 'Task details' : 'All planned tasks', d.scoped.length + (d.scoped.length === 1 ? ' task' : ' tasks'));
        var arows = d.scoped.map(function (t, i) {
          var c = d.inPeriod[t.id] || 0;
          return [i + 1, strong(t.title), t.tag, repeatText(t), timeText(t), PTStore.dur(t.min),
            c + (c === 1 ? ' time' : ' times'), PTStore.dur(c * t.min),
            d.last[t.id] ? dateText(parseKey(d.last[t.id])) : 'Not yet'];
        });
        det.appendChild(table(
          [{ text: '#' }, { text: 'Task' }, { text: 'Goal' }, { text: 'Repeats' }, { text: 'Time' }, { text: 'Duration' }, { text: 'Done in period' }, { text: 'Focus time' }, { text: 'Last done' }],
          arows, 'No tasks have been added yet.'));
        sheet.appendChild(det);
      }
    }

    /* Daily log (not needed for a single day: the task table above is that day) */
    if (opt.log && !isToday) {
      var log = section('Daily log', 'Days with at least one task done');
      var lrows = d.info.filter(function (x) { return x.done.length; }).reverse().map(function (x) {
        if (one) return [dateText(x.date), clock(Math.min(x.done[0].at || 0, 24)), PTStore.dur(x.doneMin)];
        var names = x.done.map(function (i) { return i.task.title; });
        return [dateText(x.date), x.sched.length, x.done.length, PTStore.dur(x.doneMin), names.join(', ')];
      });
      log.appendChild(table(one
        ? [{ text: 'Date' }, { text: 'Done at' }, { text: 'Focus time' }]
        : [{ text: 'Date' }, { text: 'Planned', num: true }, { text: 'Done', num: true }, { text: 'Focus time', num: true }, { text: 'Tasks completed' }],
        lrows, 'No completed tasks are recorded in this period.'));
      sheet.appendChild(log);
    }

    /* Goals (all-tasks reports only) */
    if (opt.goals && !one && goals && goals.length) {
      var gs = section('Goals', goals.length + (goals.length === 1 ? ' goal' : ' goals'));
      var grows = goals.map(function (g, i) {
        return [i + 1, strong(g.title), g.kind, g.progress + '%', g.tasks, g.hours, g.due, g.status];
      });
      gs.appendChild(table(
        [{ text: '#' }, { text: 'Goal' }, { text: 'Type' }, { text: 'Progress', num: true }, { text: 'Tasks', num: true }, { text: 'Hours goal', num: true }, { text: 'Due' }, { text: 'Status' }],
        grows, ''));
      sheet.appendChild(gs);
    }

    /* Notes + signature (for the paper copy) */
    if (opt.notes) {
      var nt = section('Notes');
      var lines = el('div', 'rp-lines rp-notes');
      for (var i = 0; i < 5; i++) lines.appendChild(el('i'));
      nt.appendChild(lines);
      var sign = el('div', 'rp-sign');
      sign.appendChild(el('span', '', 'Name and signature'));
      sign.appendChild(el('span', '', 'Date'));
      nt.appendChild(sign);
      sheet.appendChild(nt);
    }

    sheet.appendChild(el('p', 'rp-foot', 'Generated by Progress tracker on ' + dateText(new Date(), true) + ' at ' + clock(nowHours()) + '.'));
  }

  /* ---------------- Goals from dashboard.html ---------------- */
  function loadGoals() {
    var note = $('#rp-note');
    if (!window.fetch) return;
    fetch('dashboard.html', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('status'); return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        goals = $$('.d-goal', doc).map(function (li) {
          var bar = $('.d-bar', li), txt = ($('.d-goal-prog span', li) || {}).textContent || '';
          var tk = /(\d+)\s+of\s+(\d+)\s+tasks/.exec(txt), hr = /([\d.]+)\s*h\s+goal/.exec(txt);
          var tm = $('time', li), st = $('.d-status', li);
          return {
            title: ($('h3', li) || {}).textContent || 'Goal',
            kind: ($('.d-goal-main p', li) || {}).textContent || '',
            progress: bar ? (+bar.getAttribute('aria-valuenow') || 0) : 0,
            tasks: tk ? tk[1] + ' of ' + tk[2] : '',
            hours: hr ? hr[1] + ' h' : '',
            due: tm ? tm.textContent.replace(/^Due\s*/i, '') : '',
            status: st ? st.textContent.trim() : ''
          };
        });
        render();
      })
      .catch(function () {
        goals = null;
        note.textContent = 'Goals could not be loaded, so they are left out. Open the app through a web server (not directly from a file) to include them.';
        note.hidden = false;
      });
  }

  /* ---------------- Controls ---------------- */
  function saveUrl() {
    var q = '?scope=' + scope + '&period=' + period + (scope === 'task' && taskId ? '&task=' + encodeURIComponent(taskId) : '');
    try { history.replaceState(null, '', q); } catch (e) {}
  }

  var select = $('#rp-task'), pick = $('#rp-pick');
  function fillTasks() {
    var list = PTStore.all();
    select.textContent = '';
    list.forEach(function (t) {
      var o = el('option', '', t.title); o.value = t.id; select.appendChild(o);
    });
    if (!list.length) scope = 'all';
    if (!list.some(function (t) { return t.id === taskId; })) taskId = list[0] ? list[0].id : '';
    select.value = taskId;
    $('#rp-scope [data-scope="task"]').disabled = !list.length;
  }
  function syncScope() {
    $$('#rp-scope button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.scope === scope)); });
    pick.hidden = scope !== 'task';
    $('#rp-o-goals').disabled = scope === 'task';
  }
  fillTasks(); syncScope();

  $$('#rp-scope button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.disabled) return;
      scope = b.dataset.scope; syncScope(); saveUrl(); render();
      if (scope === 'task') select.focus();
    });
  });
  select.addEventListener('change', function () { taskId = select.value; saveUrl(); render(); });

  $$('#rp-period button').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.dataset.period === period));
    b.addEventListener('click', function () {
      period = b.dataset.period;
      $$('#rp-period button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      saveUrl(); render();
    });
  });
  ['graph', 'tasks', 'log', 'goals', 'notes'].forEach(function (o) { $('#rp-o-' + o).addEventListener('change', render); });

  /* The saved PDF / print job gets a sensible name */
  var oldTitle = document.title;
  window.addEventListener('beforeprint', function () { document.title = 'Progress report - ' + todayKey; });
  window.addEventListener('afterprint', function () { document.title = oldTitle; });
  $('#rp-print').addEventListener('click', function () { render(); window.print(); });

  render();
  loadGoals();
})();
