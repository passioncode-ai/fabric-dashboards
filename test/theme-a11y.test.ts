// UI/UX iteration 0.8.0, wave W1a (docs/reports/2026-10-24-ui-ux-iteration/README.md): the theme and accessibility
// rules that can be read from the stylesheet and the mark tables without a browser. Each test names its finding in
// docs/reports/2026-10-24-ui-ux-iteration/inventory.json.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { CONN_MARK, GLYPH, SEV_MARK } from '../src/renderer/lib';

const root = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const APP_CSS = read('src/renderer/styles/app.css');
const TOKENS_CSS = read('src/renderer/brand/fabric-tokens.css');

interface Rule { selector: string; media: string; decls: Array<[string, string]> }

/** A small CSS reader: comments out, @media blocks opened, every rule with its declarations. Enough for app.css. */
function rules(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const walk = (text: string, media: string) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).replace(/^[\s;]*(@import[^;]*;)?/, '').trim();
      let depth = 1, j = open + 1;
      while (j < text.length && depth > 0) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@media') || head.startsWith('@container')) walk(body, head);
      else if (!head.startsWith('@keyframes')) {
        const decls = body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
          const c = d.indexOf(':');
          return [d.slice(0, c).trim(), d.slice(c + 1).trim()] as [string, string];
        });
        out.push({ selector: head, media, decls });
      }
      i = j;
    }
  };
  walk(src, '');
  return out;
}

const ALL = rules(APP_CSS);
const ACCENT = /var\(--pc-accent\)/;
const FILL = new Set(['background', 'background-color']);

test('VIS-01: the brand gold is never a foreground (text, stroke, border, ring, mark) unless it edges its own fill', () => {
  const bad: string[] = [];
  for (const r of ALL) {
    const fillsGold = r.decls.some(([p, v]) => FILL.has(p) && ACCENT.test(v));
    for (const [p, v] of r.decls) {
      if (!ACCENT.test(v) || FILL.has(p)) continue;
      // A border the same gold as the fill it surrounds is part of that fill (the primary button).
      if (fillsGold && p.startsWith('border')) continue;
      bad.push(`${r.selector} { ${p}: ${v} }`);
    }
  }
  assert.deepEqual(bad, [], 'in the light theme --pc-accent is 1.3:1 on the surfaces; use --pc-link or --pc-focus');
});

test('VIS-01, VIS-04, VIS-22: every focus ring is drawn in --pc-focus and none is removed', () => {
  const bad: string[] = [];
  for (const r of ALL.filter((x) => /:focus(-visible|-within)?\b/.test(x.selector))) {
    for (const [p, v] of r.decls) {
      if (!p.startsWith('outline') || p === 'outline-offset') continue;
      // The Connections map node is an SVG group: its ring is the node's own stroke, checked below.
      if (/^(none|0)$/.test(v) && r.selector === '.node:focus-visible') continue;
      // A heading that takes focus after Stop is a place, not a control (T-21); it never shows a ring.
      if (/^(none|0)$/.test(v) && r.selector === 'h1[tabindex="-1"]:focus') continue;
      if (/^(none|0)$/.test(v)) bad.push(`${r.selector} removes its outline`);
      else if (!/var\(--pc-focus\)/.test(v)) bad.push(`${r.selector} { ${p}: ${v} }`);
    }
  }
  assert.deepEqual(bad, []);
  const node = ALL.find((r) => r.selector.split(',').map((s) => s.trim()).includes('.node:focus-visible .node-box'));
  assert.ok(node?.decls.some(([p, v]) => p === 'stroke' && v === 'var(--pc-focus)'), 'a focused map node is stroked in --pc-focus');
  for (const sel of ['.menu [role=\'menuitem\']:focus-visible', '.console-edge:focus-visible']) {
    const r = ALL.find((x) => x.selector.split(',').map((s) => s.trim()).includes(sel) && x.decls.some(([p]) => p === 'outline'));
    assert.ok(r, `${sel} draws a visible outline`);
  }
});

test('VIS-03: the sidebar row-menu button stays in the tab order and shows when its row has focus', () => {
  const pin = ALL.filter((r) => /\.(pin-btn|row-menu-btn)\b/.test(r.selector));
  const hidden = pin.filter((r) => r.decls.some(([p, v]) => (p === 'display' && v === 'none') || (p === 'visibility' && v === 'hidden')));
  assert.deepEqual(hidden.map((r) => r.selector), [], 'display: none or visibility: hidden takes a button out of the tab order');
  assert.ok(pin.some((r) => r.selector.includes('.nav-row:focus-within') && r.decls.some(([p, v]) => p === 'opacity' && v === '1')), 'focus inside the row reveals the button');
});

test('VIS-20: .btn-sm is declared once, and small controls are one height', () => {
  const sm = ALL.filter((r) => r.selector.split(',').map((s) => s.trim()).includes('.btn-sm'));
  assert.equal(sm.length, 1);
  const heights = new Set(ALL.filter((r) => /\.(btn-sm|select-sm)\b|\.setup-done \.setup-check \.btn\b/.test(r.selector))
    .flatMap((r) => r.decls.filter(([p]) => p === 'min-height').map(([, v]) => v)));
  assert.deepEqual([...heights], ['var(--fd-control-sm)']);
  assert.match(APP_CSS, /--fd-control-sm:\s*28px;/, 'the one small height is 28 px');
});

test('VIS-19: every custom property app.css reads is defined, with no silent fallback', () => {
  const defined = new Set([...`${TOKENS_CSS}\n${APP_CSS}`.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const used = [...APP_CSS.matchAll(/var\((--[\w-]+)\s*(,)?/g)];
  const undefinedNames = [...new Set(used.map((m) => m[1]).filter((n) => !defined.has(n)))];
  assert.deepEqual(undefinedNames, [], 'an undefined token falls back silently and drifts from the theme');
  assert.deepEqual([...new Set(used.filter((m) => m[2]).map((m) => m[1]))], [], 'no var() fallback: a defined role needs none');
  // Colours are roles: no raw hex or rgb() outside the alias block at the top.
  const literal = ALL.filter((r) => !r.selector.startsWith(':root')).flatMap((r) => r.decls.filter(([, v]) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v)).map(([p, v]) => `${r.selector} { ${p}: ${v} }`));
  assert.deepEqual(literal, []);
  // Motion goes through the duration roles, so reduced motion (which zeroes them) reaches it.
  const timed = ALL.flatMap((r) => r.decls.filter(([p, v]) => p === 'transition' && /\d(ms|s)\b/.test(v)).map(([, v]) => `${r.selector} { transition: ${v} }`));
  assert.deepEqual(timed, []);
});

test('VIS-23: under reduced motion nothing blinks or turns, and a busy mark is not the stopped ring', () => {
  const reduced = ALL.filter((r) => r.media.includes('prefers-reduced-motion: reduce'));
  const cursor = reduced.find((r) => r.selector.includes('xterm-cursor-blink'));
  assert.ok(cursor?.decls.some(([p, v]) => p === 'animation' && /^none/.test(v)), 'the console cursor stops blinking');
  const spinner = reduced.find((r) => r.selector === '.spinner');
  assert.ok(spinner?.decls.some(([p, v]) => p === 'animation' && v === 'none'));
  const top = spinner?.decls.find(([p]) => p === 'border-top-color')?.[1];
  assert.ok(top && top !== 'var(--pc-border-strong)', 'a static busy mark keeps a coloured quarter, unlike ○ stopped');
});

test('VIS-08: one mark per state on every surface', () => {
  assert.equal(CONN_MARK.ok, GLYPH.ready);
  assert.equal(CONN_MARK.degraded, GLYPH.degraded);
  assert.equal(CONN_MARK.down, GLYPH.down);
  assert.equal(SEV_MARK.error, GLYPH.down);
  assert.equal(SEV_MARK.warn, GLYPH.degraded);
  for (const f of ['src/renderer/components/Connections.tsx', 'src/renderer/components/ConnectionsMap.tsx']) {
    const src = read(f);
    assert.doesNotMatch(src, /const (MARK|SEV_MARK|STOP_MARK)\s*=/, `${f} draws states with the shared tables`);
    assert.doesNotMatch(src, /■/, `${f}: down is ${GLYPH.down}, not ■`);
  }
  // The tray menu (main process) cannot import the renderer; its copy must stay the same table.
  const tray = /const MARK: Record<ServiceState, string> = \{([^}]*)\}/.exec(read('src/electron/tray.ts'))?.[1] ?? '';
  const trayTable = Object.fromEntries([...tray.matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(trayTable, GLYPH);
});

test('VIS-13: a map edge says its state by line pattern as well as colour', () => {
  const dash = (cls: string) => ALL.find((r) => r.selector.split(',').map((s) => s.trim()).includes(cls))?.decls.find(([p]) => p === 'stroke-dasharray')?.[1];
  const ok = dash('.edge-ok'), degraded = dash('.edge-degraded'), unknown = dash('.edge-unknown');
  assert.ok(degraded, 'a degraded edge has its own dash');
  assert.notEqual(degraded, unknown);
  assert.notEqual(degraded, ok);
  assert.match(read('src/renderer/components/ConnectionsMap.tsx'), /<title>[^<]*conn\.state\./, 'the edge title names its state');
});
