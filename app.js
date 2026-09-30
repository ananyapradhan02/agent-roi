(function () {
  'use strict';

  var STORE_KEY = 'agent-roi:v1';
  var FIELDS = ['volume', 'handle', 'rate', 'automation', 'escalation', 'tokens', 'ppm', 'overhead', 'perres', 'platform', 'impl'];
  var JUSTIFY_MONTHS = 6;
  var MARGINAL_MONTHS = 18;

  // illustrative round numbers, not vendor quotes
  var PRESETS = [
    {
      id: 'support-token',
      name: 'support desk, token-based',
      currency: 'USD', model: 'token',
      v: { volume: 20000, handle: 8, rate: 30, automation: 50, escalation: 10, tokens: 40000, ppm: 5, overhead: 0.02, perres: 1, platform: 2000, impl: 60000 }
    },
    {
      id: 'support-resolution',
      name: 'support desk, per resolution',
      currency: 'USD', model: 'resolution',
      v: { volume: 20000, handle: 8, rate: 30, automation: 40, escalation: 10, tokens: 40000, ppm: 5, overhead: 0.02, perres: 1.5, platform: 2000, impl: 80000 }
    },
    {
      id: 'it-helpdesk-inr',
      name: 'it helpdesk, rupees',
      currency: 'INR', model: 'token',
      v: { volume: 3000, handle: 6, rate: 500, automation: 30, escalation: 9, tokens: 80000, ppm: 400, overhead: 3, perres: 60, platform: 75000, impl: 1000000 }
    }
  ];

  // url hash: short keys and the largest value each field accepts
  var LIVE_URL = 'https://ananyapradhan02.github.io/agent-roi/';
  var KEYS = {
    volume: ['v', 1e9], handle: ['h', 1440], rate: ['r', 1e7], automation: ['a', 100], escalation: ['e', 1440],
    tokens: ['t', 1e9], ppm: ['p', 1e7], overhead: ['o', 1e7], perres: ['q', 1e7], platform: ['f', 1e10], impl: ['i', 1e12]
  };

  var state = { preset: PRESETS[0].id, edited: false, currency: 'USD', model: 'token', v: {} };

  var $ = function (id) { return document.getElementById(id); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return PRESETS[0];
  }

  function applyPreset(id) {
    var p = presetById(id);
    state.preset = p.id;
    state.edited = false;
    state.currency = p.currency;
    state.model = p.model;
    state.v = {};
    FIELDS.forEach(function (f) { state.v[f] = p.v[f]; });
    syncForm();
    update();
  }

  function syncForm() {
    FIELDS.forEach(function (f) { $(f).value = state.v[f]; });
    $('currency').value = state.currency;
    document.querySelectorAll('[data-model]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-model') === state.model ? 'true' : 'false');
    });
    document.querySelectorAll('.model-token').forEach(function (n) { n.hidden = state.model !== 'token'; });
    document.querySelectorAll('.model-resolution').forEach(function (n) { n.hidden = state.model !== 'resolution'; });
    document.querySelectorAll('[data-preset]').forEach(function (b) {
      b.setAttribute('aria-pressed', (!state.edited && b.getAttribute('data-preset') === state.preset) ? 'true' : 'false');
    });
    var sym = state.currency === 'INR' ? '(₹)' : '($)';
    document.querySelectorAll('.cur').forEach(function (n) { n.textContent = sym; });
  }

  function num(x) {
    var n = parseFloat(x);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  // core model; automation and cost multiplier can be overridden for the sensitivity table
  function compute(v, model, autoPct, costMult) {
    var tasks = num(v.volume);
    var a = Math.min(100, num(autoPct == null ? v.automation : autoPct)) / 100;
    var rate = num(v.rate);
    var before = tasks * num(v.handle) / 60 * rate;
    var after = tasks * (1 - a) * num(v.escalation) / 60 * rate;
    var usage = model === 'token'
      ? tasks * (num(v.tokens) / 1e6 * num(v.ppm) + num(v.overhead))
      : tasks * a * num(v.perres);
    var agent = (usage + num(v.platform)) * (costMult == null ? 1 : costMult);
    var net = before - after - agent;
    var impl = num(v.impl);
    var payback = net > 0 ? impl / net : Infinity;
    var verdict;
    if (net <= 0 || payback > MARGINAL_MONTHS) verdict = 'kill';
    else if (payback <= JUSTIFY_MONTHS) verdict = 'justify';
    else verdict = 'marginal';
    return { before: before, after: after, agent: agent, usage: usage, net: net, payback: payback, year: net * 12 - impl, verdict: verdict };
  }

  function fmt(n, compact) {
    var locale = state.currency === 'INR' ? 'en-IN' : 'en-US';
    var opts = { style: 'currency', currency: state.currency, maximumFractionDigits: 0 };
    if (compact) { opts.notation = 'compact'; opts.maximumFractionDigits = 1; }
    try { return new Intl.NumberFormat(locale, opts).format(n).replace('-', '−'); }
    catch (e) { return (state.currency === 'INR' ? '₹' : '$') + Math.round(n).toLocaleString(); }
  }

  function fmtExact(n) {
    var locale = state.currency === 'INR' ? 'en-IN' : 'en-US';
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency: state.currency, maximumFractionDigits: 4 }).format(n); }
    catch (e) { return String(n); }
  }

  function fmtPayback(r) {
    if (!isFinite(r.payback)) return 'never';
    if (r.payback === 0) return 'immediate';
    return (r.payback < 10 ? r.payback.toFixed(1) : Math.round(r.payback)) + ' months';
  }

  function verdictLine(r) {
    if (r.verdict === 'justify') return 'the agent saves money every month and earns back the build within six months.';
    if (r.verdict === 'marginal') return 'it saves money, but the build takes more than six months to earn back. push on price, scope or automation before signing.';
    if (r.net <= 0) return 'the agent costs more than the work it replaces. escalations and usage fees eat the savings.';
    return 'it saves a little each month, but the build takes more than eighteen months to earn back.';
  }

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2);
  }

  var MULTS = [0.5, 0.75, 1, 1.5, 2];

  function autoRows(a) {
    var rows = [];
    [-20, -10, 0, 10, 20].forEach(function (d) {
      var x = Math.max(0, Math.min(100, Math.round(a + d)));
      if (rows.indexOf(x) === -1) rows.push(x);
    });
    return rows;
  }

  function sensitivity() {
    return autoRows(num(state.v.automation)).map(function (row) {
      return { auto: row, cells: MULTS.map(function (m) { return compute(state.v, state.model, row, m).net; }) };
    });
  }

  function renderSens() {
    var cur = Math.round(Math.min(100, num(state.v.automation)));
    var thead = $('sens').querySelector('thead');
    var tbody = $('sens').querySelector('tbody');
    thead.textContent = '';
    tbody.textContent = '';
    var hr = el('tr');
    var h0 = el('th', null, 'auto'); h0.appendChild(el('span', 'wide-only', 'mation')); h0.scope = 'col'; hr.appendChild(h0);
    MULTS.forEach(function (m) {
      var th = el('th'); th.scope = 'col';
      th.appendChild(el('span', 'wide-only', 'cost '));
      th.appendChild(document.createTextNode('×' + m));
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    sensitivity().forEach(function (r) {
      var isRow = r.auto === cur;
      var tr = el('tr', isRow ? 'current-row' : null);
      tr.appendChild(el('td', 'row-head', r.auto + '%'));
      r.cells.forEach(function (n, i) {
        var cls = ['data'];
        if (n < 0) cls.push('neg');
        if (isRow && MULTS[i] === 1) cls.push('current');
        tr.appendChild(el('td', cls.join(' '), fmt(n, true)));
      });
      tbody.appendChild(tr);
    });
  }

  function update() {
    var r = compute(state.v, state.model);
    var stamp = $('stamp');
    stamp.textContent = r.verdict;
    stamp.className = 'stamp' + (r.verdict === 'justify' ? ' ok' : r.verdict === 'kill' ? ' stop' : '');
    $('verdictLine').textContent = verdictLine(r);
    $('oBefore').textContent = fmt(r.before) + ' /mo';
    $('oAfter').textContent = fmt(r.after) + ' /mo';
    $('oAgent').textContent = fmt(r.agent) + ' /mo';
    $('oNet').textContent = fmt(r.net) + ' /mo';
    $('oPayback').textContent = fmtPayback(r);
    $('oYear').textContent = fmt(r.year);
    $('asof').textContent = today();
    renderSens();
    save();
    scheduleHash();
  }

  // ---- scenario in the url hash ----
  function clampNum(x, max) {
    var n = parseFloat(x);
    if (!isFinite(n)) return null;
    return Math.min(max, Math.max(0, n));
  }

  function encodeState() {
    var q = new URLSearchParams();
    q.set('s', state.preset);
    if (state.edited) q.set('x', '1');
    q.set('c', state.currency === 'INR' ? 'inr' : 'usd');
    q.set('m', state.model === 'resolution' ? 'res' : 'tok');
    FIELDS.forEach(function (f) {
      var n = clampNum(state.v[f], KEYS[f][1]);
      q.set(KEYS[f][0], String(n == null ? 0 : n));
    });
    return q.toString();
  }

  // returns true only if the hash carries a usable scenario; bad values fall back to the preset's
  function readHash(hash) {
    var raw = String(hash || '').replace(/^#/, '');
    if (!raw) return false;
    var q;
    try { q = new URLSearchParams(raw); } catch (e) { return false; }
    var hits = 0;
    var preset = q.get('s');
    var known = PRESETS.some(function (p) { return p.id === preset; });
    if (known) hits++;
    var p = presetById(preset);
    var v = {};
    FIELDS.forEach(function (f) {
      var n = q.has(KEYS[f][0]) ? clampNum(q.get(KEYS[f][0]), KEYS[f][1]) : null;
      if (n == null) v[f] = p.v[f]; else { v[f] = n; hits++; }
    });
    if (!hits) return false;
    state.preset = p.id;
    state.edited = q.get('x') === '1' || !known;
    var c = q.get('c');
    state.currency = c === 'inr' ? 'INR' : c === 'usd' ? 'USD' : p.currency;
    var m = q.get('m');
    state.model = m === 'res' ? 'resolution' : m === 'tok' ? 'token' : p.model;
    state.v = v;
    return true;
  }

  var hashTimer = null;
  var lastHash = '';
  function writeHash() {
    hashTimer = null;
    var h = '#' + encodeState();
    if (h === lastHash && location.hash === h) return;
    lastHash = h;
    try { history.replaceState(null, '', h); }
    catch (e) { try { location.replace(h); } catch (e2) {} }
  }
  function scheduleHash() {
    if (hashTimer) clearTimeout(hashTimer);
    hashTimer = setTimeout(writeHash, 250);
  }

  function shareLink() {
    var base = location.protocol === 'file:' ? LIVE_URL : location.href.split('#')[0];
    return base + '#' + encodeState();
  }

  function scenarioName() {
    var p = presetById(state.preset);
    return state.edited ? 'custom scenario (started from "' + p.name + '")' : p.name + ' (preset with round numbers, not a vendor quote)';
  }

  function memo() {
    var v = state.v, r = compute(v, state.model);
    var money = function (n) { return fmt(n); };
    var L = [];
    L.push('# agent purchase memo');
    L.push('');
    L.push('scenario: ' + scenarioName() + '  ');
    L.push('date: ' + today() + '  ');
    L.push('open this scenario: ' + shareLink() + '  ');
    L.push('verdict: **' + r.verdict.toUpperCase() + '**. ' + verdictLine(r));
    L.push('');
    L.push('## result');
    L.push('');
    L.push('| line | per month |');
    L.push('| --- | ---: |');
    L.push('| human cost today | ' + money(r.before) + ' |');
    L.push('| human cost after (escalations) | ' + money(r.after) + ' |');
    L.push('| agent cost | ' + money(r.agent) + ' |');
    L.push('| **net savings** | **' + money(r.net) + '** |');
    L.push('');
    L.push('payback: ' + fmtPayback(r) + '. first-year net after implementation: ' + money(r.year) + '.');
    L.push('');
    L.push('## inputs');
    L.push('');
    L.push('- tasks per month: ' + num(v.volume));
    L.push('- handle time today: ' + num(v.handle) + ' min at ' + money(num(v.rate)) + ' per hour, loaded');
    L.push('- automation rate: ' + num(v.automation) + '%');
    L.push('- escalation handle time: ' + num(v.escalation) + ' min');
    if (state.model === 'token') {
      L.push('- pricing: token-based, ' + num(v.tokens) + ' tokens per run at ' + fmtExact(num(v.ppm)) + ' per million, plus ' + fmtExact(num(v.overhead)) + ' overhead per run');
    } else {
      L.push('- pricing: per resolution, ' + fmtExact(num(v.perres)) + ' per resolved task');
    }
    L.push('- platform fee: ' + money(num(v.platform)) + ' per month');
    L.push('- implementation: ' + money(num(v.impl)) + ' one-time');
    L.push('');
    L.push('## sensitivity: net monthly savings');
    L.push('');
    L.push('| automation | ' + MULTS.map(function (m) { return 'cost ×' + m; }).join(' | ') + ' |');
    L.push('| --- | ' + MULTS.map(function () { return '---:'; }).join(' | ') + ' |');
    sensitivity().forEach(function (row) {
      L.push('| ' + row.auto + '% | ' + row.cells.map(function (n) { return fmt(n, true); }).join(' | ') + ' |');
    });
    L.push('');
    L.push('## thresholds');
    L.push('');
    L.push('- justify: net savings above zero and payback of ' + JUSTIFY_MONTHS + ' months or less');
    L.push('- marginal: net savings above zero and payback between ' + JUSTIFY_MONTHS + ' and ' + MARGINAL_MONTHS + ' months');
    L.push('- kill: net savings at or below zero, or payback longer than ' + MARGINAL_MONTHS + ' months');
    L.push('');
    L.push('## how it is calculated');
    L.push('');
    L.push('- human today = tasks × handle min ÷ 60 × cost per hour');
    L.push('- human after = tasks × (1 − automation) × escalation min ÷ 60 × cost per hour');
    L.push(state.model === 'token'
      ? '- agent = tasks × (tokens ÷ 1,000,000 × price per million + overhead) + platform fee'
      : '- agent = tasks × automation × price per resolution + platform fee');
    L.push('- net = human today − human after − agent; payback = implementation ÷ net');
    L.push('');
    L.push('not included: ramp-up months, the cost of wrong answers, headcount that cannot actually be released, change management.');
    L.push('');
    L.push('made with agent roi: https://ananyapradhan02.github.io/agent-roi/');
    return L.join('\n');
  }

  function showFallback(text, label) {
    $('memoFallback').hidden = false;
    $('memoLabel').textContent = label || 'clipboard is blocked here. select all and copy.';
    var ta = $('memoText');
    ta.rows = label ? 3 : 10;
    ta.value = text;
    ta.focus();
    ta.select();
    $('copyStatus').textContent = '';
  }

  function copyMemo() { copyText(memo(), 'memo copied. paste it into the doc or thread.'); }
  function copyLink() {
    copyText(shareLink(), 'link copied. anyone who opens it sees this exact scenario.',
      'clipboard is blocked here. select the link and copy.');
  }

  function copyText(text, okMsg, fallbackLabel) {
    var done = function () {
      $('copyStatus').textContent = okMsg;
      $('memoFallback').hidden = true;
    };
    var legacy = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) done(); else showFallback(text, fallbackLabel);
    };
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, legacy);
    } else {
      legacy();
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (s && s.v && typeof s.v === 'object') {
        state.preset = presetById(s.preset).id;
        state.edited = !!s.edited;
        state.currency = s.currency === 'INR' ? 'INR' : 'USD';
        state.model = s.model === 'resolution' ? 'resolution' : 'token';
        var p = presetById(state.preset);
        state.v = {};
        FIELDS.forEach(function (f) { state.v[f] = (s.v[f] != null && s.v[f] !== '') ? s.v[f] : p.v[f]; });
        return true;
      }
    } catch (e) {}
    return false;
  }

  // wire up
  var presetBox = $('presets');
  PRESETS.forEach(function (p) {
    var b = el('button', 'pill', p.name);
    b.type = 'button';
    b.setAttribute('data-preset', p.id);
    b.addEventListener('click', function () { applyPreset(p.id); $('copyStatus').textContent = ''; });
    presetBox.appendChild(b);
  });

  FIELDS.forEach(function (f) {
    $(f).addEventListener('input', function (e) {
      state.v[f] = e.target.value;
      if (!state.edited) { state.edited = true; syncForm(); }
      update();
    });
  });
  $('currency').addEventListener('change', function (e) {
    state.currency = e.target.value === 'INR' ? 'INR' : 'USD';
    state.edited = true;
    syncForm();
    update();
  });
  document.querySelectorAll('[data-model]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.model = b.getAttribute('data-model');
      state.edited = true;
      syncForm();
      update();
    });
  });
  $('inputs').addEventListener('submit', function (e) { e.preventDefault(); });
  $('copyMemo').addEventListener('click', copyMemo);
  $('copyLink').addEventListener('click', copyLink);
  $('reset').addEventListener('click', function () { applyPreset(state.preset); $('copyStatus').textContent = ''; });

  $('theme').addEventListener('click', function () {
    var root = document.documentElement;
    var dark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // precedence: hash, then this browser's last scenario, then the first preset
  var hadHash = !!location.hash.replace(/^#/, '');
  if (readHash(location.hash)) { syncForm(); update(); }
  else {
    var had = load();
    if (had) { syncForm(); update(); } else { applyPreset(PRESETS[0].id); }
    if (hadHash) $('copyStatus').textContent = 'that link could not be read, so this is ' + (had ? 'your last scenario.' : 'the first preset.');
  }
  writeHash();

  window.addEventListener('hashchange', function () {
    if (location.hash === lastHash) return;
    if (readHash(location.hash)) { syncForm(); update(); }
  });

  // exposed for tests
  window.agentRoi = { compute: compute, memo: memo, state: state, shareLink: shareLink, encode: encodeState };
})();
