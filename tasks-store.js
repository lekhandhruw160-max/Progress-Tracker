/* Shared by dashboard.html and add-task.html.
   Tasks live in localStorage under "pt-tasks", ticked tasks per day under "pt-done".
   Replace these functions with real server calls later. */
(function (w) {
  'use strict';

  var KT = 'pt-tasks', KD = 'pt-done';
  var COLORS = ['orange', 'teal', 'sky'];

  var SEED = [
    { id: 't1', title: 'Write validation for the signup form', repeat: 'daily', start: '09:00', min: 45, tag: 'Login and signup', color: 'orange' },
    { id: 't2', title: 'Read two chapters of the React docs',  repeat: 'daily', start: '10:00', min: 40, tag: 'React basics',     color: 'teal' },
    { id: 't3', title: 'Practice typing for 30 minutes',       repeat: 'daily', start: '11:00', min: 30, tag: 'Typing',           color: 'sky' },
    { id: 't4', title: 'Draft the OTP email template',         repeat: 'daily', start: '15:00', min: 25, tag: 'Login and signup', color: 'orange' },
    { id: 't5', title: 'Sketch the portfolio home page',       repeat: 'daily', start: '17:00', min: 50, tag: 'Portfolio',        color: 'orange' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function read(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function newId() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function key(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hours(hhmm) { var p = String(hhmm).split(':'); return (+p[0] || 0) + (+p[1] || 0) / 60; }

  function label(hhmm) {
    var h = Math.floor(hours(hhmm)), m = Math.round((hours(hhmm) - h) * 60);
    return (h % 12 || 12) + ':' + pad(m) + ' ' + (h % 24 < 12 ? 'AM' : 'PM');
  }
  function endLabel(hhmm, min) {
    var t = Math.round(hours(hhmm) * 60) + min;
    var next = t >= 1440;
    t = t % 1440;
    return label(pad(Math.floor(t / 60)) + ':' + pad(t % 60)) + (next ? ' (next day)' : '');
  }
  function dur(min) {
    var h = Math.floor(min / 60), m = min % 60;
    return h ? (m ? h + ' h ' + m + ' min' : h + ' h') : m + ' min';
  }

  /* Anything read back from storage is checked again, so a bad value can never break the page */
  function clean(t) {
    if (!t || typeof t !== 'object') return null;
    var title = String(t.title || '').trim().slice(0, 80);
    if (!title) return null;
    var start = /^([01]\d|2[0-3]):[0-5]\d$/.test(t.start) ? t.start : '09:00';
    var min = Math.round(+t.min);
    if (!(min >= 5 && min <= 960)) min = 25;
    var repeat = t.repeat === 'once' ? 'once' : 'daily';
    var date = /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : '';
    if (repeat === 'once' && !date) repeat = 'daily';
    return {
      id: String(t.id || newId()).slice(0, 40), title: title, repeat: repeat, date: repeat === 'once' ? date : '',
      start: start, min: min, tag: String(t.tag || 'Added by you').slice(0, 40),
      color: COLORS.indexOf(t.color) >= 0 ? t.color : 'sky'
    };
  }

  function all() {
    var raw = read(KT);
    if (!Array.isArray(raw)) {                       // first visit: sample tasks, three already ticked today
      raw = SEED.slice();
      write(KT, raw);
      var d = {}; d[key()] = { t1: 9.75, t2: 10.7, t3: 11.5 };
      write(KD, d);
    }
    return raw.map(clean).filter(Boolean);
  }

  function byStart(a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; }

  w.PTStore = {
    key: key, hours: hours, label: label, endLabel: endLabel, dur: dur, newId: newId,
    all: function () { return all().sort(byStart); },
    get: function (id) { return all().filter(function (t) { return t.id === id; })[0] || null; },
    forDay: function (d) {
      var k = key(d);
      return all().filter(function (t) { return t.repeat === 'daily' || t.date === k; }).sort(byStart);
    },
    upsert: function (task) {
      var list = all(), t = clean(task), i;
      if (!t) return null;
      for (i = 0; i < list.length; i++) if (list[i].id === t.id) { list[i] = t; write(KT, list); return t; }
      list.push(t); write(KT, list); return t;
    },
    remove: function (id) {
      write(KT, all().filter(function (t) { return t.id !== id; }));
      var m = read(KD);
      if (m && typeof m === 'object') { Object.keys(m).forEach(function (k) { if (m[k]) delete m[k][id]; }); write(KD, m); }
    },
    doneMap: function (k) { var m = read(KD); return (m && m[k] && typeof m[k] === 'object') ? m[k] : {}; },
    setDone: function (k, id, at) {
      var m = read(KD); if (!m || typeof m !== 'object') m = {};
      if (!m[k]) m[k] = {};
      if (at == null) delete m[k][id]; else m[k][id] = at;
      write(KD, m);
    },
    describe: function (t) {
      var when = t.repeat === 'daily' ? 'Every day' : (function () {
        var p = t.date.split('-');
        return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      })();
      return when + ' \u00b7 ' + label(t.start) + ' \u00b7 ' + dur(t.min);
    }
  };
})(window);
