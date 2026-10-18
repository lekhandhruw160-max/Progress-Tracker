
(function () {
    var root = document.documentElement;
    var btn = document.getElementById('theme-btn');
    var menu = document.getElementById('theme-menu');
    var opts = menu.querySelectorAll('.theme-opt');

    function apply(n) {
    root.setAttribute('data-theme', n);
    opts.forEach(function (o) { o.setAttribute('aria-pressed', String(o.dataset.theme === String(n))); });
    try { localStorage.setItem('pt-theme', n); } catch (e) {}
    }

    function setOpen(open) {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    }

    var saved = '1';
    try { saved = localStorage.getItem('pt-theme') || '1'; } catch (e) {}
    apply(saved);

    btn.addEventListener('click', function () { setOpen(menu.hidden); });
    opts.forEach(function (o) { o.addEventListener('click', function () { apply(o.dataset.theme); }); });
    document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('.theme')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setOpen(false); btn.focus(); } });
})();

(function () {
    var overlay = document.getElementById('auth-overlay');
    var card = document.getElementById('auth-card');
    var views = {
    signup: card.querySelector('[data-view="signup"]'),
    login: card.querySelector('[data-view="login"]')
    };
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var opener = null, closing = false, downOnOverlay = false, shards = null;

    function show(view) {
    Object.keys(views).forEach(function (k) { views[k].hidden = (k !== view); });
    card.setAttribute('aria-labelledby', view + '-title');
    }

    function focusFirst() {
    var el = card.querySelector('.auth-view:not([hidden]) input');
    if (el) el.focus();
    }

    /* ---------- Open ---------- */
    function open(view, trigger) {
    if (closing) return;
    opener = trigger || null;
    show(view);
    overlay.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    card.classList.remove('enter');
    void card.offsetWidth;
    card.classList.add('enter');
    requestAnimationFrame(function () { overlay.classList.add('open'); });
    setTimeout(focusFirst, 60);
    }

    /* ---------- Close: the card breaks into square pieces that fall from the top ---------- */
    function finish() {
    if (shards) { shards.remove(); shards = null; }
    overlay.hidden = true;
    overlay.style.transition = '';
    card.style.visibility = '';
    card.classList.remove('enter');
    document.documentElement.style.overflow = '';
    card.querySelectorAll('form').forEach(function (f) {
        f.reset();
        f.querySelectorAll('.auth-field').forEach(function (fl) { fl.removeAttribute('data-invalid'); });
        f.querySelectorAll('.auth-error, .auth-status').forEach(function (p) { p.textContent = ''; });
    });
    closing = false;
    if (opener && opener.focus) opener.focus();
    }

    function close() {
    if (closing || overlay.hidden) return;
    closing = true;

    if (reduce) {
        overlay.classList.remove('open');
        card.style.visibility = 'hidden';
        setTimeout(finish, 200);
        return;
    }

    var r = card.getBoundingClientRect();
    var cols = Math.max(5, Math.round(r.width / 54));
    var rows = Math.max(6, Math.round(r.height / 54));
    var tw = r.width / cols, th = r.height / rows;
    var fall = window.innerHeight - r.top + 120;

    shards = document.createElement('div');
    shards.className = 'shards';
    shards.setAttribute('aria-hidden', 'true');
    shards.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';

    // one clean copy of the card (visible view only) that every piece will show a slice of
    var base = card.cloneNode(true);
    base.removeAttribute('id');
    base.removeAttribute('role');
    base.removeAttribute('aria-labelledby');
    base.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
    base.querySelectorAll('[hidden]').forEach(function (n) { n.remove(); });
    base.classList.remove('enter');
    var srcInputs = card.querySelectorAll('.auth-view:not([hidden]) input');
    base.querySelectorAll('input').forEach(function (inp, i) {
        if (srcInputs[i]) { inp.value = srcInputs[i].value; inp.checked = srcInputs[i].checked; }
    });

    var total = 0, rand = function (a, b) { return a + Math.random() * (b - a); };
    var frag = document.createDocumentFragment();

    for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
        var x = col * tw, y = row * th;
        var delay = row * 42 + rand(0, 140);        // top rows break first
        var dur = rand(820, 1100);
        total = Math.max(total, delay + dur);

        var s = document.createElement('div');
        s.className = 'shard';
        s.style.cssText =
            'left:' + x + 'px;top:' + y + 'px;width:' + (tw + 0.6) + 'px;height:' + (th + 0.6) + 'px;' +
            '--delay:' + delay.toFixed(0) + 'ms;--dur:' + dur.toFixed(0) + 'ms;' +
            '--dx:' + rand(-70, 70).toFixed(0) + 'px;--dy:' + (fall + rand(0, 160)).toFixed(0) + 'px;--dz:' + rand(0, 220).toFixed(0) + 'px;' +
            '--rx:' + rand(-540, 540).toFixed(0) + 'deg;--ry:' + rand(-540, 540).toFixed(0) + 'deg;--rz:' + rand(-300, 300).toFixed(0) + 'deg';

        var c = base.cloneNode(true);
        c.style.cssText = 'position:absolute;margin:0;animation:none;max-height:none;overflow:hidden;left:' + (-x) + 'px;top:' + (-y) + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
        s.appendChild(c);
        frag.appendChild(s);
        }
    }

    shards.appendChild(frag);
    overlay.appendChild(shards);
    card.style.visibility = 'hidden';

    // dark backdrop fades away while the pieces fall
    overlay.style.transition = 'background-color ' + Math.round(total * 0.9) + 'ms ease 150ms, -webkit-backdrop-filter ' + Math.round(total * 0.9) + 'ms ease 150ms, backdrop-filter ' + Math.round(total * 0.9) + 'ms ease 150ms';
    overlay.classList.remove('open');

    setTimeout(finish, total + 80);
    }

    /* ---------- Triggers ---------- */
    document.querySelectorAll('[data-open-auth]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); open(el.dataset.openAuth, el); });
    });

    card.querySelectorAll('[data-switch]').forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.switch); focusFirst(); });
    });

    card.querySelector('[data-auth-close]').addEventListener('click', close);

    // click outside the card closes it (ignore text-selection drags that end outside)
    overlay.addEventListener('mousedown', function (e) { downOnOverlay = (e.target === overlay); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay && downOnOverlay) close(); });

    document.addEventListener('keydown', function (e) {
    if (overlay.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab' && !closing) {            // keep keyboard focus inside the modal
        var f = Array.prototype.filter.call(
        card.querySelectorAll('a[href],button:not([disabled]),input:not([disabled])'),
        function (n) { return n.offsetParent !== null; });
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    });

    /* ---------- Show / hide password ---------- */
    card.querySelectorAll('.auth-eye').forEach(function (b) {
    b.addEventListener('click', function () {
        var input = b.parentNode.querySelector('input');
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.setAttribute('aria-pressed', String(show));
        b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    });

    /* ---------- Validation (front-end only; the server must validate again) ---------- */
    function check(input, form) {
    var v = input.value, kind = input.dataset.validate;
    if (kind === 'name') return v.trim().length >= 2 ? '' : 'Enter your full name';
    if (kind === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address';
    if (kind === 'password') return v.length >= 8 ? '' : 'Password must be at least 8 characters';
    if (kind === 'confirm') return v && v === form.querySelector('[data-validate="password"]').value ? '' : 'Passwords do not match';
    if (kind === 'loginpass') return v ? '' : 'Enter your password';
    if (kind === 'terms') return input.checked ? '' : 'Please accept the Terms & Conditions';
    return '';
    }

    function mark(input, msg) {
    var field = input.closest('.auth-field');
    field.toggleAttribute('data-invalid', !!msg);
    field.querySelector('.auth-error').textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }

    card.querySelectorAll('form').forEach(function (form) {
    var fields = form.querySelectorAll('[data-validate]');
    fields.forEach(function (input) {
        var evt = input.type === 'checkbox' ? 'change' : 'input';
        input.addEventListener(evt, function () {
        if (input.closest('.auth-field').hasAttribute('data-invalid')) mark(input, check(input, form));
        });
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var firstBad = null;
        fields.forEach(function (input) {
        var msg = check(input, form);
        mark(input, msg);
        if (msg && !firstBad) firstBad = input;
        });
        var status = form.querySelector('.auth-status');
        if (firstBad) { status.textContent = ''; firstBad.focus(); return; }
        status.textContent = 'Form is valid. The server request will be connected in the next step.';
    });
    });
})();