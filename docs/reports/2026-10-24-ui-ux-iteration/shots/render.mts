// FD-103 (node S3), FIX-2 finding V-2: the contact sheet of the Sessions mode, from the built renderer, with synthetic
// sessions. The renderer is the one the app ships (`npx vite build` -> out/renderer); `window.fabric` is a stub that
// answers with the data below, so no Electron, no Switchboard and no real session is needed. A console is the drawer's
// own page (`?drawer=1`), as in the app, rendered at the bounds the session page leaves for it and laid over the
// window's capture. Every state of SCN-077 to SCN-086 that the shots cover is drawn in English and Russian, light and
// dark, at 1280x800 and 740x800; README.md beside this file is written by the run and lists every file.
//
//   npx vite build && node --import tsx docs/reports/2026-10-24-ui-ux-iteration/shots/render.mts [filter]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import sharp from 'sharp';
import { webkit, type Browser, type Page } from 'playwright';
import { DEFAULT_SETTINGS } from '../../../../src/core/types';
import { actionsFor, groupOf, type SessionRow, type SessionState } from '../../../../src/core/sessions';

const ROOT = path.resolve(import.meta.dirname, '../../../..');
const OUT = import.meta.dirname;
// WebKit refuses module scripts from file://, so the built renderer is served on a loopback port for the run.
const DIST = path.join(ROOT, 'out/renderer');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const file = path.join(DIST, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const INDEX = `http://127.0.0.1:${(server.address() as { port: number }).port}/index.html`;
const AT = Date.parse('2026-10-24T14:02:00');
const min = 60_000;
const HOME = '/Users/dev';

type Lang = 'en' | 'ru';
type Theme = 'light' | 'dark';
const LANGS: Lang[] = ['en', 'ru'];
const THEMES: Theme[] = ['light', 'dark'];
const WIDTHS = [1280, 740];
const HEIGHT = 800;

/** A row as `mergeSessions` builds it: group from the state, actions from `actionsFor` unless the merge sets its own. */
function row(o: Partial<SessionRow> & { id: string; folder: string; state: SessionState }): SessionRow {
  const group = groupOf(o.state);
  return {
    key: null, agent: 'claude-code', account: 'claude4', context: null, contextName: null, origin: 'handover', reason: null, openedInTerminal: false,
    startedAt: AT, endedAt: null, expectedAt: null, candidates: [], resumable: false, consoleEmpty: false, at: AT,
    actions: actionsFor(o.state), ...o, group, project: o.folder.split('/').pop()!,
  } as SessionRow;
}
const W = (name: string) => `${HOME}/work/${name}`;
const R = {
  resumeFailed: row({ id: 'c:handover.rs-000000000001:1', key: 'handover.rs-000000000001', folder: W('billing-api'), state: 'needs-you-resume-failed', origin: 'resume', account: 'claude2', startedAt: AT - 25 * min, at: AT - 25 * min }),
  notOpened: row({ id: 'ho:ho-000000000009', folder: W('mobile-shell'), state: 'needs-you-not-opened', reason: 'busy-disk', openedInTerminal: true, startedAt: null, endedAt: AT - 40 * min, at: AT - 40 * min }),
  running: row({ id: 'c:handover.ho-000000000002:2', key: 'handover.ho-000000000002', folder: W('passioncode-platform'), state: 'running-ours', context: 'personal', startedAt: AT - 8 * min, at: AT - 8 * min }),
  terminal: row({ id: `sb:claude:default:${AT - 50 * min}:${W('landing-site')}`, folder: W('landing-site'), state: 'running-terminal', origin: 'switchboard', account: 'claude5', context: 'org:acme', contextName: 'Acme', startedAt: AT - 50 * min, at: AT - 50 * min }),
  waiting: row({ id: 'st:cc-1', folder: W('fabric-switchboard'), state: 'waiting-reset', origin: 'limit', account: 'claude3', expectedAt: AT + 88 * min, candidates: [{ id: 'acc-2', label: 'claude5' }, { id: 'acc-6', label: 'claude6' }], actions: actionsFor('waiting-reset', { continueNow: true }), startedAt: AT - 12 * min, at: AT - 12 * min }),
  ended: row({ id: 'c:handover.ho-000000000005:5', key: 'handover.ho-000000000005', folder: W('analytics-etl'), state: 'ended', resumable: true, startedAt: AT - 95 * min, endedAt: AT - 70 * min, at: AT - 70 * min }),
  idle: row({ id: 'c:handover.ho-000000000003:3', key: 'handover.ho-000000000003', folder: W('docs-site'), state: 'idle-closed', resumable: true, startedAt: AT - 120 * min, endedAt: AT - 60 * min, at: AT - 60 * min }),
  byYou: row({ id: 'c:research.default:4', key: 'research.default', folder: W('research-notes'), state: 'ended-by-you', origin: 'here', agent: 'codex', account: null, resumable: true, startedAt: AT - 200 * min, endedAt: AT - 150 * min, at: AT - 150 * min }),
  restarted: row({ id: 'c:handover.ho-000000000007:7', key: 'handover.ho-000000000007', folder: W('payments-worker'), state: 'ended', resumable: true, consoleEmpty: true, startedAt: AT - 300 * min, endedAt: AT - 240 * min, at: AT - 240 * min }),
};
const ROWS = Object.values(R).sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));

/** Each console's own transcript: its folder in the cwd line, its own work; a running one ends on the cursor. */
const box = (title: string, folder: string) => {
  const cwd = ` cwd: ${folder.replace(HOME, '~')}`;
  const width = Math.max(52, cwd.length + 2);
  const top = `╭─ ${title} ${'─'.repeat(width - title.length - 3)}╮`;
  return [`\x1b[1m${top}\x1b[0m\r\n`, `\x1b[1m│\x1b[0m${cwd.padEnd(width)}\x1b[1m│\x1b[0m\r\n`, `\x1b[1m╰${'─'.repeat(width)}╯\x1b[0m\r\n\r\n`].join('');
};
const ask = (s: string) => `\x1b[2m> ${s}\x1b[0m\r\n\r\n`;
const step = (s: string) => `\x1b[32m●\x1b[0m ${s}\r\n`;
const CURSOR = '\x1b[7m \x1b[0m';
const TRANSCRIPTS: Record<string, { output: string; title: string; state: 'running' | 'exited'; exitCode?: number | null; signal?: number | null; idle?: boolean }> = {
  [R.running.key!]: { title: 'Claude Code', state: 'running', output: box('Claude Code', R.running.folder) + ask('Continue the release checklist from step 4.')
    + step('Reading docs/RUNBOOK.md') + step('Running npm run check') + '  692 tests, 686 pass, 0 fail\r\n\r\n'
    + 'Step 4 is done. The changelog has the new entry; next is tagging v0.8.0.\r\n\r\n' + CURSOR },
  [R.resumeFailed.key!]: { title: 'Claude Code', state: 'running', output: box('Claude Code', R.resumeFailed.folder)
    + '\x1b[33mNo conversation found to resume in this folder.\x1b[0m\r\nStarted a new conversation.\r\n\r\n' + CURSOR },
  [R.ended.key!]: { title: 'Claude Code', state: 'exited', exitCode: 0, output: box('Claude Code', R.ended.folder) + ask('Backfill the events table for October.')
    + step('Running scripts/backfill.py --month 2026-10') + '  31 days, 412 806 rows written\r\n' + step('Running pytest tests/etl') + '  58 passed\r\n\r\n'
    + 'The backfill is done and the tests pass.\r\n' },
  [R.idle.key!]: { title: 'Claude Code', state: 'exited', signal: 1, idle: true, output: box('Claude Code', R.idle.folder) + ask('Rebuild the site and check the links.')
    + step('Running npm run build') + '  Built 42 pages.\r\n' + step('Running npm run linkcheck') + '  0 broken links\r\n\r\nThe site is built; every link resolves.\r\n' },
  [R.byYou.key!]: { title: 'Codex', state: 'exited', signal: 15, output: box('Codex', R.byYou.folder) + ask('Summarise the three papers in notes/inbox.')
    + step('Reading notes/inbox/attention.pdf') + step('Reading notes/inbox/retrieval.pdf') + '\r\nTwo of three summaries are in notes/summaries.md.\r\n' },
};

type Opts = { lang: Lang; theme: Theme; width: number };
type Shot = {
  state: string;
  /** What README says the shot shows. */
  what: string;
  nav: { page: string; key?: string } | null;
  rows?: SessionRow[];
  noSessions?: boolean;
  switchboard?: boolean;
  degraded?: unknown[];
  noteSeen?: boolean;
  sidebar?: 'expanded' | 'collapsed';
  mode?: 'sessions' | 'agents';
  /** The console key to lay over the page, when the session page shows one. */
  console?: string;
  /** Grow the window to the page's height, so a long list is seen whole. */
  tall?: boolean;
  act?: (p: Page, o: Opts) => Promise<void>;
  /** What must be on the page before the capture. */
  wait: string;
};
const page = (r: SessionRow) => ({ page: 'sessions', key: r.id });
const SHOTS: Shot[] = [
  { state: 'all-full', what: 'All sessions: every group (needs you, running, waiting, ended), the first-visit note on top; the window grown to the list', nav: { page: 'sessions', key: 'all' }, tall: true, wait: '.session-card' },
  { state: 'all-empty', what: 'All sessions: no session in the last 24 hours', nav: { page: 'sessions', key: 'all' }, rows: [], noteSeen: true, wait: '.sessions .empty' },
  { state: 'all-loading', what: 'All sessions: the first read has not answered yet (`status.sessions` null)', nav: { page: 'sessions', key: 'all' }, noSessions: true, noteSeen: true, wait: '.sessions [role=status]' },
  { state: 'all-no-switchboard', what: 'All sessions without Switchboard: only this app\'s own consoles, with the notice how to get it', nav: { page: 'sessions', key: 'all' }, switchboard: false, rows: ROWS.filter((r) => r.id.startsWith('c:')), tall: true, wait: '.session-card' },
  { state: 'all-degraded', what: 'All sessions while Switchboard does not answer: the list may be out of date since a time', nav: { page: 'sessions', key: 'all' }, noteSeen: true, degraded: [{ source: 'sessions', reason: 'error', detail: 'timeout', since: AT - 3 * min }], wait: '.notice.warning' },
  { state: 'session-running', what: 'A session running in a console of this app, its console under the header (End, Show in Finder)', nav: page(R.running), noteSeen: true, console: R.running.key!, wait: '.session-head' },
  { state: 'session-terminal', what: 'A session Switchboard runs in Terminal: no console here, Show in Finder only', nav: page(R.terminal), noteSeen: true, wait: '.session-body' },
  { state: 'session-resume-failed', what: 'Needs you: continued after a limit, did not take up its conversation (console, End)', nav: page(R.resumeFailed), noteSeen: true, console: R.resumeFailed.key!, wait: '.session-head' },
  { state: 'session-not-opened', what: 'Needs you: a hand-over that could not open here (no disk room), opened in Terminal instead; Remove', nav: page(R.notOpened), noteSeen: true, wait: '.session-why' },
  { state: 'session-waiting', what: 'Waiting for a limit reset: stopped by a limit on an account, Continue now opened on its two candidate accounts, Don\'t continue', nav: page(R.waiting), noteSeen: true, wait: '.session-why',
    act: async (p) => { await p.locator('.session-head [aria-haspopup="menu"]').click(); await p.waitForSelector('.session-head [role="menu"]'); await p.waitForTimeout(150); } },
  { state: 'session-ended', what: 'Ended cleanly, with what its console printed (Continue, Remove)', nav: page(R.ended), noteSeen: true, console: R.ended.key!, wait: '.session-head' },
  { state: 'session-idle-closed', what: 'Closed after 30 idle minutes, with its console output', nav: page(R.idle), noteSeen: true, console: R.idle.key!, wait: '.session-head' },
  { state: 'session-ended-by-you', what: 'Ended by the person (End), with its console output (a Codex session)', nav: page(R.byYou), noteSeen: true, console: R.byYou.key!, wait: '.session-head' },
  { state: 'session-ended-restart', what: 'Ended before the app restarted: what it printed is not kept, the page says so (no console)', nav: page(R.restarted), noteSeen: true, wait: '.session-body' },
  { state: 'agents-sidebar', what: 'The Agents mode: its sidebar and the Overview with no agent installed (its empty state)', nav: { page: 'agents' }, mode: 'agents', wait: '.sidebar' },
  { state: 'rail-sessions', what: 'The folded rail in the Sessions mode, on All sessions', nav: { page: 'sessions', key: 'all' }, sidebar: 'collapsed', noteSeen: true, wait: '.session-card' },
  { state: 'rail-agents', what: 'The folded rail in the Agents mode, on Overview', nav: { page: 'agents' }, sidebar: 'collapsed', mode: 'agents', wait: '.sidebar' },
  { state: 'settings-sessions', what: 'Settings opened on its Sessions section by the note\'s "Choose where sessions continue"', nav: { page: 'sessions', key: 'all' }, wait: '.sessions-note',
    act: async (p) => { await p.locator('.sessions-note .btn-primary').click(); await p.waitForSelector('#g-sessions'); await p.waitForTimeout(400); } },
  { state: 'end-question', what: 'The End question, asked over a running session\'s page (its console steps aside while it is open)', nav: page(R.running), noteSeen: true, wait: '.session-head',
    act: async (p) => { await p.locator('.session-head .btn-danger').first().click(); await p.waitForSelector('[aria-labelledby="end-title"]'); await p.waitForTimeout(200); } },
];

/** `window.fabric`, answered from `data`; anything not named answers nothing. */
function stub(data: { status: unknown; settings: unknown; nav: unknown; drawer: unknown; info: unknown; lang: string }) {
  const named: Record<string, unknown> = {
    status: async () => data.status, settings: async () => data.settings, locale: async () => data.lang, takeNavigation: async () => data.nav,
    estate: async () => ({ enabled: false }), updateSettings: async () => ({ settings: data.settings }), setupState: async () => ({ mcp: true, skills: true, firstAgent: true }),
    sessionsHandovers: async () => ({ available: true, enabled: true }), consoleInfo: async () => data.info,
    consoleSessions: async () => ({ unavailable: 'absent', detail: '' }), listeners: async () => ({ listeners: [] }),
    onDrawer: (l: (v: unknown) => void) => { setTimeout(() => l(data.drawer), 0); return () => undefined; },
  };
  (window as unknown as { fabric: unknown }).fabric = new Proxy(named, {
    get: (target, prop: string) => target[prop] ?? (prop.startsWith('on') ? () => () => undefined : async () => undefined),
  });
}

const fileOf = (s: Shot, o: Opts) => `${s.state}-${o.lang}-${o.theme}-${o.width}.png`;

async function render(browser: Browser, s: Shot, o: Opts): Promise<{ file: string; size: string }> {
  const settings = {
    ...DEFAULT_SETTINGS, theme: o.theme, language: o.lang, setupDone: true, sessionsNoteSeen: s.noteSeen ?? false,
    layout: { ...DEFAULT_SETTINGS.layout, sidebar: s.sidebar ?? 'expanded', mode: s.mode ?? 'sessions', sessionId: null, endedOpen: true },
    estate: { ...DEFAULT_SETTINGS.estate, enabled: false },
  };
  const status = {
    services: [], servicesDir: `${HOME}/Library/Application Support/ai.passioncode.fabric/services`, dirError: null, scanning: false, unread: 0, update: { state: 'idle' }, version: '0.8.0',
    estate: { enabled: false, contract: { state: 'unconfigured', remoteTip: null, localTip: null, fetched: null }, pins: [], skills: { state: 'absent', installed: null, latest: null }, consumers: [], checkedAt: null },
    sessions: s.noSessions ? null : { rows: s.rows ?? ROWS, degraded: s.degraded ?? [], switchboard: s.switchboard ?? true, handovers: { enabled: true }, autoContinue: true },
  };
  let viewport = { width: o.width, height: HEIGHT };
  const p = await browser.newPage({ viewport, colorScheme: o.theme, reducedMotion: 'reduce' });
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  if (process.env.SHOTS_DEBUG) p.on('console', (m) => console.log('console', m.type(), m.text()));
  await p.addInitScript({ content: 'window.__name = (f) => f;' }); // tsx keeps function names with a helper the page lacks
  await p.addInitScript(stub, { status, settings, nav: s.nav, drawer: null, info: null, lang: o.lang });
  await p.goto(INDEX);
  await p.waitForSelector(s.wait, { timeout: 10_000 });
  await p.waitForTimeout(300);
  if (s.act) await s.act(p, o);
  if (s.tall) {
    // The page scrolls inside its own column, so a full-page capture would not grow: the window grows to the list.
    const need = await p.evaluate(() => {
      let extra = 0;
      document.querySelectorAll<HTMLElement>('main, main *').forEach((e) => { const st = getComputedStyle(e); if (/(auto|scroll)/.test(st.overflowY)) extra = Math.max(extra, e.scrollHeight - e.clientHeight); });
      return extra;
    });
    if (need > 0) { viewport = { width: o.width, height: HEIGHT + need + 8 }; await p.setViewportSize(viewport); await p.waitForTimeout(300); }
  }
  await p.mouse.move(0, 0);
  let out = sharp(await p.screenshot());
  const t = s.console ? TRANSCRIPTS[s.console] : undefined;
  if (s.console) {
    if (!t) throw new Error(`no transcript for ${s.console}`);
    const area = await p.evaluate(() => { const r = document.querySelector('.session-console-area')?.getBoundingClientRect(); return r ? { x: r.left, y: r.top, width: r.width, height: r.height } : null; });
    if (!area) throw new Error(`${s.state}: the page left no console area`);
    const row = ROWS.find((r) => r.key === s.console)!;
    const d = await browser.newPage({ viewport: { width: Math.round(area.width), height: Math.round(area.height) }, colorScheme: o.theme, reducedMotion: 'reduce' });
    d.on('pageerror', (e) => errors.push(`drawer: ${e.message}`));
    const info = {
      key: s.console, runtimes: [], runtime: null, folder: null, binding: { kind: 'none' },
      idle: t.idle ? { at: new Date(row.endedAt ?? AT).toISOString(), account: row.account } : null,
      session: { state: t.state, label: t.title, cwd: row.folder, output: t.output, end: t.output.length, exitCode: t.exitCode ?? null, signal: t.signal ?? null },
    };
    await d.addInitScript({ content: 'window.__name = (f) => f;' });
    await d.addInitScript(stub, { status, settings, nav: null, drawer: { key: s.console, full: true, height: area.height, areaHeight: area.height, task: null, scheme: o.theme }, info, lang: o.lang });
    await d.goto(`${INDEX}?drawer=1`);
    await d.waitForSelector('.console-page .xterm-rows', { timeout: 10_000 });
    await d.waitForTimeout(400);
    out = out.composite([{ input: await d.screenshot(), left: Math.round(area.x), top: Math.round(area.y) }]);
    await d.close();
  }
  const file = fileOf(s, o);
  await out.png().toFile(path.join(OUT, file));
  await p.close();
  if (errors.length) console.log(`${file}: page errors: ${errors.join(' | ')}`);
  return { file, size: `${viewport.width}x${viewport.height}` };
}

const filter = process.argv[2];
// The shots this script made before (FD-103 S3) are superseded by this sheet.
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png') && !filter) fs.rmSync(path.join(OUT, f));
const written: { shot: Shot; o: Opts; file: string; size: string }[] = [];
const browser = await webkit.launch();
try {
  for (const shot of SHOTS) {
    for (const lang of LANGS) for (const theme of THEMES) for (const width of WIDTHS) {
      const o = { lang, theme, width };
      if (filter && !fileOf(shot, o).includes(filter)) continue;
      const r = await render(browser, shot, o);
      written.push({ shot, o, ...r });
      console.log(`wrote ${r.file} (${r.size})`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (filter) process.exit(0);

const LANG_NAME: Record<Lang, string> = { en: 'English', ru: 'Russian' };
fs.writeFileSync(path.join(OUT, 'README.md'), [
  '# Sessions mode contact sheet (FD-103, FIX-2 finding V-2)',
  '',
  `Rendered ${new Date().toISOString().slice(0, 10)} by \`render.mts\` beside this file, from the built renderer, in Playwright WebKit:`,
  '',
  '```sh',
  'npx vite build',
  'node --import tsx docs/reports/2026-10-24-ui-ux-iteration/shots/render.mts',
  '```',
  '',
  `${SHOTS.length} states (every state of SCR-12 to SCR-14), each in English and Russian (\`settings.language\` and the stub's \`locale\`), light and dark, at ${WIDTHS.map((w) => `${w}x${HEIGHT}`).join(' and ')}:`,
  `${written.length} files. The two "all-full" and "all-no-switchboard" states grow the window's height to the whole list (the page`,
  'scrolls inside its own column, so a full-page capture would not), so their height is given in the table.',
  '',
  'How they are made:',
  '',
  '- The data is synthetic: nine sessions in every state of SCN-078 to SCN-084, built with `actionsFor` and `groupOf` of',
  '  `src/core/sessions.ts`, so each row carries the actions the app gives its state; the settings are `DEFAULT_SETTINGS`',
  '  of `src/core/types.ts` with the theme, language, sidebar and mode of the shot. `window.fabric` is a stub that answers',
  '  with that data; no Electron, no Switchboard and no real session is involved.',
  '- A session page with a console lays the drawer page (`?drawer=1`) over the area the page leaves for it: in the app',
  '  it is a native view placed there by `src/electron/drawer.ts`. Each console has its own synthetic transcript whose',
  '  cwd line names its own folder; an ended console ends on its last line, a running one on the cursor.',
  '- The End question is captured without the console: the app suspends the drawer while a dialog is open.',
  '- Times are of 24 October 2026, 14:02 local time.',
  '',
  'This is not a capture of the running Electron app: the window chrome, the native drawer view and the real fonts of',
  'the installed app are not in it.',
  '',
  '| File | State | Language | Theme | Size |',
  '|---|---|---|---|---|',
  ...written.map((w) => `| [${w.file}](${w.file}) | ${w.shot.what} | ${LANG_NAME[w.o.lang]} | ${w.o.theme} | ${w.size} |`),
  '',
].join('\n'));
console.log(`README.md: ${written.length} files`);
