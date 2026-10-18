(function () {
  'use strict';

  function $(s) { return document.querySelector(s); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  var params = new URLSearchParams(location.search);
  var editId = params.get('id');
  var task = editId ? PTStore.get(editId) : null;

  var nameIn = $('#tf-name'), dateIn = $('#tf-date'), dateWrap = $('#tf-date-wrap');
  var startIn = $('#tf-start'), hIn = $('#tf-h'), mIn = $('#tf-m'), sum = $('#tf-sum');
  var radios = Array.prototype.slice.call(document.querySelectorAll('input[name="repeat"]'));
  var today = PTStore.key();

  dateIn.min = today;

  function repeatValue() { return radios.filter(function (r) { return r.checked; })[0].value; }
  function setRepeat(v) { radios.forEach(function (r) { r.checked = r.value === v; }); showDate(); }
  function showDate() { dateWrap.hidden = repeatValue() !== 'once'; }
  function minutes() { return (parseInt(hIn.value, 10) || 0) * 60 + (parseInt(mIn.value, 10) || 0); }
  function setMinutes(t) { hIn.value = Math.floor(t / 60); mIn.value = t % 60; }

  /* Fill the form: edit mode, or a new task (the small box on the dashboard can pass a name) */
  if (editId && !task) {
    $('#tf-lead').textContent = 'That task no longer exists, so this will create a new one.';
  }
  if (task) {
    document.title = 'Edit task - Progress tracker';
    $('#tf-title').textContent = 'Edit task';
    $('#tf-lead').textContent = 'Change anything and save, or remove the task.';
    nameIn.value = task.title;
    setRepeat(task.repeat);
    dateIn.value = task.date || today;
    startIn.value = task.start;
    setMinutes(task.min);
    $('#tf-remove').hidden = false;
    $('#tf-save').textContent = 'Save changes';
  } else {
    nameIn.value = (params.get('name') || '').slice(0, 80);
    dateIn.value = today;
    var next = Math.min(23, new Date().getHours() + 1);
    startIn.value = pad(next) + ':00';
    setMinutes(30);
  }
  showDate();

  radios.forEach(function (r) { r.addEventListener('change', function () { showDate(); update(); }); });
  Array.prototype.slice.call(document.querySelectorAll('#tf-chips button')).forEach(function (b) {
    b.addEventListener('click', function () { setMinutes(+b.dataset.min); clearErr('dur'); update(); });
  });

  /* Errors */
  var fields = { name: nameIn, date: dateIn, start: startIn, dur: hIn };
  function showErr(k, msg) {
    var e = $('#tf-' + k + '-err');
    e.textContent = msg; e.hidden = false;
    fields[k].setAttribute('aria-invalid', 'true');
    fields[k].setAttribute('aria-describedby', e.id);
  }
  function clearErr(k) {
    var e = $('#tf-' + k + '-err');
    e.hidden = true;
    fields[k].removeAttribute('aria-invalid');
  }
  nameIn.addEventListener('input', function () { clearErr('name'); });
  dateIn.addEventListener('input', function () { clearErr('date'); update(); });
  startIn.addEventListener('input', function () { clearErr('start'); update(); });
  [hIn, mIn].forEach(function (n) { n.addEventListener('input', function () { clearErr('dur'); update(); }); });

  /* Live summary */
  function update() {
    var t = minutes();
    if (!startIn.value || t < 5) { sum.textContent = ''; return; }
    var when = repeatValue() === 'daily' ? 'Repeats every day.' : (function () {
      if (!dateIn.value) return '';
      var p = dateIn.value.split('-');
      return 'Only on ' + new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + '.';
    })();
    sum.textContent = 'Starts at ' + PTStore.label(startIn.value) + ', runs for ' + PTStore.dur(t) + ' and ends at ' + PTStore.endLabel(startIn.value, t) + '. ' + when;
  }
  update();

  /* Save */
  $('#tf').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = nameIn.value.trim(), repeat = repeatValue(), t = minutes(), bad = null;

    ['name', 'date', 'start', 'dur'].forEach(clearErr);
    if (!title) { showErr('name', 'Please give the task a name.'); bad = bad || nameIn; }
    if (repeat === 'once' && !dateIn.value) { showErr('date', 'Please choose the day.'); bad = bad || dateIn; }
    if (!startIn.value) { showErr('start', 'Please choose a start time.'); bad = bad || startIn; }
    if (t < 5) { showErr('dur', 'Give the task at least 5 minutes.'); bad = bad || hIn; }
    else if (t > 960) { showErr('dur', 'That is more than 16 hours. Please split it into smaller tasks.'); bad = bad || hIn; }
    if (bad) { bad.focus(); return; }

    PTStore.upsert({
      id: task ? task.id : PTStore.newId(),
      title: title, repeat: repeat, date: repeat === 'once' ? dateIn.value : '',
      start: startIn.value, min: t,
      tag: task ? task.tag : 'Added by you', color: task ? task.color : 'sky'
    });
    location.href = 'dashboard.html';
  });

  /* Remove (asks once more before deleting) */
  var rm = $('#tf-remove'), armed = false, timer = 0;
  rm.addEventListener('click', function () {
    if (!armed) {
      armed = true; rm.textContent = 'Sure? Remove it';
      rm.classList.add('is-armed');
      timer = setTimeout(function () { armed = false; rm.textContent = 'Remove task'; rm.classList.remove('is-armed'); }, 4000);
      return;
    }
    clearTimeout(timer);
    PTStore.remove(task.id);
    location.href = 'dashboard.html';
  });
})();
