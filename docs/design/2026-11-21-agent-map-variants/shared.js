// FD-363 step 1: the sample estate and the page frame the three Agent map mockups share.
// A mockup, not app code: the names and numbers are invented (67 agents, 47 declaring connections,
// the size of the owner's screenshot), and nothing here is read from a real machine.
(function () {
  'use strict';

  // A fixed seed: every variant draws the same estate, so they can be compared.
  function prng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = prng(363);
  const pick = (list) => list[Math.floor(rnd() * list.length)];

  const ORGS = [
    { id: 'personal', name: 'Личные', yours: true, size: 24 },
    { id: 'acme', name: 'Acme', size: 19 },
    { id: 'northwind', name: 'Northwind', size: 12 },
    { id: 'platform', name: 'Платформа', size: 8 },
    { id: 'none', name: 'Без организации', size: 4 },
  ];
  const MACHINES = [
    { id: 'mac', name: 'Этот Mac' },
    { id: 'studio', name: 'Studio' },
    { id: 'online', name: 'В облаке' },
  ];
  const WORDS = ['Mail', 'Media', 'Copy', 'Research', 'Store', 'Ads', 'Support', 'Sales', 'Data', 'Brand', 'Video', 'Voice',
    'Signal', 'Billing', 'Search', 'Docs', 'Graph', 'Relay', 'Ledger', 'Scout', 'Inbox', 'Pulse', 'Atlas', 'Forge'];
  const TAILS = ['Agent', 'Desk', 'Hub', 'Bot'];
  const STATE = {
    ok: { mark: '●', label: 'Работает', color: 'var(--pc-positive)', rank: 0 },
    degraded: { mark: '◐', label: 'Работает частично', color: 'var(--pc-warning)', rank: 2 },
    down: { mark: '✕', label: 'Не работает', color: 'var(--pc-negative)', rank: 3 },
    off: { mark: '○', label: 'Выключен', color: 'var(--pc-text-muted)', rank: 1 },
  };

  const agents = [];
  const used = new Set();
  for (const org of ORGS) {
    for (let i = 0; i < org.size; i++) {
      let name;
      do { name = pick(WORDS) + ' ' + pick(TAILS); } while (used.has(name));
      used.add(name);
      const r = rnd();
      const state = r < 0.74 ? 'ok' : r < 0.88 ? 'degraded' : r < 0.95 ? 'down' : 'off';
      const m = rnd();
      agents.push({
        id: 'a' + agents.length, name, org: org.id, state,
        machine: org.id === 'platform' ? 'mac' : m < 0.5 ? 'mac' : m < 0.75 ? 'studio' : 'online',
        waits: false, declares: false, calls: [], calledBy: [],
      });
    }
  }
  // Six agents wait for the person (a question, an approval), as on the screenshot's counts line.
  for (let n = 0; n < 6;) { const a = pick(agents); if (!a.waits && a.state !== 'off') { a.waits = true; n++; } }

  // 47 of 67 declare connections. An agent calls agents of its own organization and the platform's (FD-163).
  const edges = [];
  const declaring = agents.filter((a) => a.org !== 'none').sort(() => rnd() - 0.5).slice(0, 47);
  const worse = (x, y) => (STATE[x].rank >= STATE[y].rank ? x : y);
  for (const a of declaring) {
    a.declares = true;
    const pool = agents.filter((b) => b !== a && (b.org === a.org || b.org === 'platform'));
    const count = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i++) {
      const b = pick(pool);
      if (a.calls.includes(b.id)) continue;
      const call = rnd() < 0.85 ? 'ok' : rnd() < 0.6 ? 'degraded' : 'down';
      const state = worse(call, b.state === 'off' ? 'down' : b.state);
      a.calls.push(b.id); b.calledBy.push(a.id);
      edges.push({ id: 'e' + edges.length, from: a.id, to: b.id, state });
    }
  }
  const byId = new Map(agents.map((a) => [a.id, a]));
  const attention = agents.filter((a) => a.waits || a.state === 'down')
    .sort((x, y) => (Number(y.waits) - Number(x.waits)) || STATE[y.state].rank - STATE[x.state].rank);

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const model = { ORGS, MACHINES, STATE, agents, edges, byId, attention };

  const el = (tag, attrs, ...kids) => {
    const svg = ['svg', 'path', 'circle', 'g', 'line', 'rect', 'text', 'title'].includes(tag);
    const node = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') node.setAttribute('class', v);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return node;
  };

  // The frame every variant sits in: the counts line and the coverage line of SCN-074 as they are today,
  // the organization filter (FD-162), what needs the person on top, and the focused agent's connections in words.
  function mount(variant) {
    const root = document.getElementById('app');
    const hidden = new Set();
    let focused = null, pinned = null, motion = !calm.matches;
    const listeners = [];

    const count = (fn) => agents.filter(fn).length;
    const summary = el('p', { class: 'summary', role: 'status' },
      el('span', { class: 'sev down' }, '✕ Не работает: ', el('b', {}, count((a) => a.state === 'down'))),
      el('span', { class: 'sev degraded' }, '◐ Работает частично: ', el('b', {}, count((a) => a.state === 'degraded'))),
      el('span', { class: 'sev setup' }, '◆ Ждёт вас: ', el('b', {}, count((a) => a.waits))),
      el('span', { class: 'sev off' }, '○ Полезно знать: ', el('b', {}, count((a) => a.state === 'off'))));
    const coverage = el('p', { class: 'meta' }, 'Агентов, которые объявляют свои связи: ' + count((a) => a.declares) + ' из ' + agents.length + '.');

    const filter = el('div', { class: 'filter', role: 'group', 'aria-label': 'Организации' },
      ORGS.map((o) => el('label', { class: 'chip' },
        el('input', { type: 'checkbox', checked: true, onchange: (e) => { e.target.checked ? hidden.delete(o.id) : hidden.add(o.id); emit(); } }),
        ' ' + o.name + (o.yours ? ' (ваши)' : '') + ' ', el('span', { class: 'num' }, o.size))));
    const motionBox = el('label', { class: 'chip' },
      el('input', { type: 'checkbox', checked: motion, onchange: (e) => { motion = e.target.checked; emit(); } }), ' Движение');

    const stage = el('div', { class: 'stage', id: 'stage' });
    const detail = el('div', { class: 'detail', 'aria-live': 'polite' });
    const needs = el('ul', { class: 'needs' }, attention.map((a) => el('li', {},
      el('button', { class: 'row', 'data-agent': a.id, onclick: () => pin(a.id), onmouseenter: () => focus(a.id), onmouseleave: () => focus(null), onfocus: () => focus(a.id, true), onblur: () => focus(null, true) },
        el('span', { class: 'mark', style: 'color:' + (a.waits ? 'var(--pc-accent)' : STATE[a.state].color) }, a.waits ? '◆' : STATE[a.state].mark),
        ' ' + a.name, el('span', { class: 'why' }, a.waits ? 'ждёт вашего ответа' : 'не отвечает')))));

    root.append(
      el('header', { class: 'top' },
        el('nav', { class: 'variants', 'aria-label': 'Варианты' },
          [['index.html', 'Все варианты'], ['a-lanes.html', 'А. Дорожки'], ['b-constellation.html', 'Б. Созвездие'], ['c-matrix.html', 'В. Матрица']]
            .map(([href, text]) => el('a', { href, 'aria-current': location.pathname.endsWith(href) ? 'page' : null }, text))),
        el('h1', {}, 'Карта агентов'), summary, coverage,
        el('p', { class: 'note' }, el('b', {}, variant.title + '. '), variant.note)),
      el('div', { class: 'bar' }, filter, motionBox),
      el('div', { class: 'cols' }, stage,
        el('aside', { class: 'side' }, el('h2', {}, 'Сначала это'), needs, el('h2', {}, 'Связи агента'), detail)),
      el('p', { class: 'meta foot' }, 'Макет FD-363, шаг 1. Данные выдуманы: ' + agents.length + ' агентов, ' + edges.length + ' связей. Блок «Проблемы» с кнопкой «Исправить с агентом» остаётся под картой как сейчас и здесь не показан.'));

    function describe() {
      const a = byId.get(pinned || focused);
      detail.replaceChildren();
      if (!a) { detail.append(el('p', { class: 'meta' }, 'Наведите на агента или дойдите до него клавишей Tab: здесь появятся его связи словами. Клик закрепляет выбор.')); return; }
      const names = (ids) => ids.length ? ids.map((id) => byId.get(id).name).join(', ') : 'никого';
      const org = ORGS.find((o) => o.id === a.org).name, machine = MACHINES.find((m) => m.id === a.machine).name;
      detail.append(
        el('p', { class: 'who' }, el('span', { style: 'color:' + STATE[a.state].color }, STATE[a.state].mark), ' ', el('b', {}, a.name)),
        el('p', { class: 'meta' }, STATE[a.state].label + (a.waits ? ', ждёт вас' : '') + ' · ' + org + ' · ' + machine),
        el('p', {}, el('span', { class: 'meta' }, 'Вызывает: '), a.declares ? names(a.calls) : 'связи не объявлены'),
        el('p', {}, el('span', { class: 'meta' }, 'Его вызывают: '), names(a.calledBy)),
        el('p', {}, el('button', { class: 'btn' }, 'Открыть агента'), pinned ? el('button', { class: 'btn ghost', onclick: () => pin(null) }, 'Снять выбор') : null));
    }
    function emit() { describe(); for (const fn of listeners) fn(api.state()); }
    // A keyboard focus changes the picture at once; only a pointer hover gets the 120 ms fade (motion doctrine).
    function focus(id, keyboard) { root.classList.toggle('instant', !!keyboard); focused = id; emit(); }
    function pin(id) { pinned = pinned === id ? null : id; emit(); }

    const api = {
      model, el, stage, focus, pin,
      state: () => {
        const id = pinned || focused, a = byId.get(id);
        const near = a ? new Set([a.id, ...a.calls, ...a.calledBy]) : null;
        return { focus: id, near, hidden, motion: motion && !document.hidden, visible: (x) => !hidden.has(x.org) };
      },
      onChange: (fn) => { listeners.push(fn); },
      agentProps: (a) => ({
        'data-agent': a.id,
        'aria-label': a.name + ', ' + STATE[a.state].label + (a.waits ? ', ждёт вас' : '') + ', вызывает ' + a.calls.length + ', вызывают ' + a.calledBy.length,
        onmouseenter: () => focus(a.id), onmouseleave: () => focus(null),
        onfocus: () => focus(a.id, true), onblur: () => focus(null, true), onclick: () => pin(a.id),
      }),
      // A signal: one call that just happened. The variants draw it as a pulse; with motion off nothing is scheduled.
      signals: (fn) => {
        const tick = () => { const s = api.state(); if (s.motion) { const live = edges.filter((e) => s.visible(byId.get(e.from)) && s.visible(byId.get(e.to))); if (live.length) fn(live[Math.floor(Math.random() * live.length)]); } };
        setInterval(tick, 900);
      },
      // Moves a dot along an SVG path once and removes it. Ease-out, 700 ms: an occasional event, not a loop.
      travel: (svg, d, color) => {
        const path = el('path', { d, fill: 'none', stroke: 'none' });
        const dot = el('circle', { r: 3.5, fill: color, class: 'pulse' });
        svg.append(path, dot);
        const len = path.getTotalLength(), t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / 700), k = 1 - Math.pow(1 - t, 3), p = path.getPointAtLength(len * k);
          dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); dot.setAttribute('opacity', t < 0.8 ? 1 : (1 - t) * 5);
          if (t < 1) requestAnimationFrame(step); else { dot.remove(); path.remove(); }
        };
        requestAnimationFrame(step);
      },
    };
    calm.addEventListener('change', () => { motion = !calm.matches; motionBox.querySelector('input').checked = motion; emit(); });
    variant.render(api);
    emit();
    return api;
  }

  window.AgentMap = { model, mount };
})();
