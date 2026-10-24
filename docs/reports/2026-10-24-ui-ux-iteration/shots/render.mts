// FD-103 (node S3): screenshots of the Sessions mode from the built renderer, with synthetic sessions. The renderer is
// the one the app ships (`npx vite build` -> out/renderer); `window.fabric` is a stub that answers with the data below,
// so no Electron, no Switchboard and no real session is needed. The console is the drawer's own page (`?drawer=1`), as
// in the app, rendered at the bounds the session page leaves for it and laid over the window's capture.
//
//   npx vite build && node --import tsx docs/reports/2026-10-24-ui-ux-iteration/shots/render.mts [webkit|chromium]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import sharp from 'sharp';
import { chromium, webkit, type Browser, type Page } from 'playwright';

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
const SIZE = { width: 1280, height: 800 };
const AT = Date.parse('2026-10-24T14:02:00');
const min = 60_000;

const row = (o: Record<string, unknown>) => ({
  key: null, agent: 'claude-code', account: 'claude4', context: null, contextName: null, origin: 'handover', reason: null, openedInTerminal: false,
  startedAt: AT, endedAt: null, expectedAt: null, candidates: [], resumable: false, at: AT, actions: [], ...o,
  project: String(o.folder).split('/').pop(),
});
const ROWS = [
  row({ id: 'c:handover.rs-000000000001:1', key: 'handover.rs-000000000001', folder: '/work/billing-api', state: 'needs-you-resume-failed', group: 'needs-you', origin: 'resume', account: 'claude2', actions: ['openConsole', 'end'], startedAt: AT - 25 * min, at: AT - 25 * min }),
  row({ id: 'ho:ho-000000000009', folder: '/work/mobile-shell', state: 'needs-you-not-opened', group: 'needs-you', reason: 'busy', openedInTerminal: true, actions: ['dismiss'], startedAt: null, endedAt: AT - 40 * min, at: AT - 40 * min }),
  row({ id: 'c:handover.ho-000000000002:2', key: 'handover.ho-000000000002', folder: '/work/passioncode-platform', state: 'running-ours', group: 'running', actions: ['end', 'reveal'], context: 'personal' }),
  row({ id: 'sb:home:3', folder: '/work/passioncode-platform', state: 'running-terminal', group: 'running', origin: 'switchboard', account: 'claude5', startedAt: AT - 50 * min, at: AT - 50 * min }),
  row({ id: 'st:cc-1', folder: '/work/fabric-switchboard', state: 'waiting-reset', group: 'waiting', origin: 'resume', account: null, expectedAt: AT + 88 * min, candidates: [{ id: 'acc-2', label: 'claude5' }], actions: ['continueNow', 'dontContinue'], startedAt: AT - 12 * min, at: AT - 12 * min }),
  row({ id: 'c:handover.ho-000000000003:3', key: 'handover.ho-000000000003', folder: '/work/docs-site', state: 'idle-closed', group: 'ended', resumable: true, actions: ['continue', 'dismiss'], startedAt: AT - 120 * min, endedAt: AT - 60 * min, at: AT - 60 * min }),
  row({ id: 'c:research.default:4', key: 'research.default', folder: '/work/research-notes', state: 'ended-by-you', group: 'ended', origin: 'here', agent: 'codex', account: null, resumable: true, actions: ['continue', 'dismiss'], startedAt: AT - 200 * min, endedAt: AT - 150 * min, at: AT - 150 * min }),
];
const OUTPUT = [
  '\x1b[1m╭─ Claude Code ─────────────────────────────────────╮\x1b[0m\r\n',
  '\x1b[1m│\x1b[0m cwd: ~/work/passioncode-platform                    \x1b[1m│\x1b[0m\r\n',
  '\x1b[1m╰───────────────────────────────────────────────────╯\x1b[0m\r\n\r\n',
  '\x1b[2m> Continue the release checklist from step 4.\x1b[0m\r\n\r\n',
  '\x1b[32m●\x1b[0m Reading docs/RUNBOOK.md\r\n',
  '\x1b[32m●\x1b[0m Running npm run check\r\n',
  '  692 tests, 686 pass, 0 fail\r\n\r\n',
  'Step 4 is done. The changelog has the new entry; next is tagging v0.8.0.\r\n\r\n',
  '\x1b[7m \x1b[0m',
].join('');

// R1-V4: an idle close ends the session with a hang-up and saves when (`idle`), as the app does (closeIdle, LC-18).
type Shot = { name: string; theme: 'dark' | 'light'; nav: { page: string; key?: string }; console?: { key: string; state: 'running' | 'exited' | 'idle'; exitCode?: number | null; signal?: number | null; idle?: boolean } };
const SHOTS: Shot[] = [
  { name: 'sessions-sidebar-all-dark', theme: 'dark', nav: { page: 'sessions', key: 'all' } },
  { name: 'sessions-sidebar-all-light', theme: 'light', nav: { page: 'sessions', key: 'all' } },
  { name: 'session-running-dark', theme: 'dark', nav: { page: 'sessions', key: 'c:handover.ho-000000000002:2' }, console: { key: 'handover.ho-000000000002', state: 'running' } },
  { name: 'session-running-light', theme: 'light', nav: { page: 'sessions', key: 'c:handover.ho-000000000002:2' }, console: { key: 'handover.ho-000000000002', state: 'running' } },
  { name: 'session-idle-closed-dark', theme: 'dark', nav: { page: 'sessions', key: 'c:handover.ho-000000000003:3' }, console: { key: 'handover.ho-000000000003', state: 'exited', exitCode: null, signal: 1, idle: true } },
  { name: 'session-idle-closed-light', theme: 'light', nav: { page: 'sessions', key: 'c:handover.ho-000000000003:3' }, console: { key: 'handover.ho-000000000003', state: 'exited', exitCode: null, signal: 1, idle: true } },
  { name: 'session-failed-resume-dark', theme: 'dark', nav: { page: 'sessions', key: 'c:handover.rs-000000000001:1' }, console: { key: 'handover.rs-000000000001', state: 'running' } },
  { name: 'session-failed-resume-light', theme: 'light', nav: { page: 'sessions', key: 'c:handover.rs-000000000001:1' }, console: { key: 'handover.rs-000000000001', state: 'running' } },
];

/** `window.fabric`, answered from `data`; anything not named answers nothing. */
function stub(data: { status: unknown; settings: unknown; nav: unknown; drawer: unknown; info: unknown }) {
  const listeners: Record<string, (v: unknown) => void> = {};
  const named: Record<string, unknown> = {
    status: async () => data.status, settings: async () => data.settings, locale: async () => 'en', takeNavigation: async () => data.nav,
    updateSettings: async () => ({ settings: data.settings }), setupState: async () => ({ mcp: true, skills: true, firstAgent: true }),
    sessionsHandovers: async () => ({ available: true, enabled: true }), consoleInfo: async () => data.info,
    consoleSessions: async () => ({ unavailable: 'absent', detail: '' }), listeners: async () => ({ listeners: [] }),
    onDrawer: (l: (v: unknown) => void) => { listeners.drawer = l; setTimeout(() => l(data.drawer), 0); return () => undefined; },
  };
  (window as unknown as { fabric: unknown }).fabric = new Proxy(named, {
    get: (target, prop: string) => target[prop] ?? (prop.startsWith('on') ? () => () => undefined : async () => undefined),
  });
}

async function render(browser: Browser, shot: Shot): Promise<void> {
  const settings = { theme: shot.theme, pageTheme: 'graphite', language: 'en', notifications: { enabled: true, perService: {}, quietHours: { enabled: false, from: '22:00', to: '08:00' }, pausedUntil: null, channel: 'auto' },
    layout: { sidebar: 'expanded', header: 'compact', console: { open: false, height: 380 }, list: { sort: 'name', pinned: [], hidden: [], kinds: {}, hiddenOpen: false }, mode: 'sessions', sessionId: null, endedOpen: true },
    setupDone: true, lastVisitAt: null, knownServices: [], lastService: null, consoles: {}, resumeAfterLimit: true, sessions: { records: [], dismissed: [] }, sessionsNoteSeen: shot.console !== undefined, autoUpdate: true };
  const status = { services: [], servicesDir: '/svc', dirError: null, scanning: false, unread: 0, update: { state: 'idle' }, estate: {}, version: '0.8.0',
    sessions: { rows: ROWS, degraded: [], switchboard: true, handovers: { enabled: true }, autoContinue: true } };
  const page: Page = await browser.newPage({ viewport: SIZE, colorScheme: shot.theme, reducedMotion: 'reduce' });
  if (process.env.SHOTS_DEBUG) { page.on('console', (m) => console.log('console', m.type(), m.text())); page.on('pageerror', (e) => console.log('pageerror', e.message)); }
  await page.addInitScript({ content: 'window.__name = (f) => f;' }); // tsx keeps function names with a helper the page lacks
  await page.addInitScript(stub, { status, settings, nav: shot.nav, drawer: null, info: null });
  await page.goto(INDEX);
  await page.waitForSelector(shot.console ? '.session-head' : '.sessions');
  await page.mouse.move(0, 0);
  const base = await page.screenshot();
  let out = sharp(base);
  if (shot.console) {
    const area = await page.evaluate(() => { const r = document.querySelector('.session-console-area')!.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; });
    const drawer = await browser.newPage({ viewport: { width: Math.round(area.width), height: Math.round(area.height) }, colorScheme: shot.theme, reducedMotion: 'reduce' });
    const info = { key: shot.console.key, runtimes: [], runtime: null, folder: null, binding: { kind: 'none' }, idle: shot.console.idle ? { at: new Date(AT - 60 * min).toISOString(), account: 'claude4' } : null,
      session: { state: shot.console.state, label: 'Claude Code', cwd: '/work', output: OUTPUT, end: OUTPUT.length, exitCode: shot.console.exitCode ?? null, signal: shot.console.signal ?? null } };
    await drawer.addInitScript({ content: 'window.__name = (f) => f;' });
    await drawer.addInitScript(stub, { status, settings, nav: null, drawer: { key: shot.console.key, full: true, height: area.height, areaHeight: area.height, task: null, scheme: shot.theme }, info });
    await drawer.goto(`${INDEX}?drawer=1`);
    await drawer.waitForSelector('.console-page .xterm-rows');
    await drawer.waitForTimeout(300);
    out = out.composite([{ input: await drawer.screenshot(), left: Math.round(area.x), top: Math.round(area.y) }]);
    await drawer.close();
  }
  await out.png().toFile(path.join(OUT, `${shot.name}.png`));
  await page.close();
}

const engine = process.argv[2] === 'chromium' ? chromium : webkit;
const browser = await engine.launch();
try {
  for (const shot of SHOTS) { await render(browser, shot); console.log(`wrote ${shot.name}.png`); }
} finally {
  await browser.close();
  server.close();
}
fs.writeFileSync(path.join(OUT, 'README.md'), [
  '# Sessions mode screenshots (FD-103, node S3)',
  '',
  `Rendered ${new Date().toISOString().slice(0, 10)} by \`render.ts\` beside this file from the built renderer (\`npx vite build\`) in`,
  `Playwright ${process.argv[2] === 'chromium' ? 'Chromium' : 'WebKit'} at ${SIZE.width}x${SIZE.height}, with synthetic sessions and a stubbed \`window.fabric\`. The console`,
  'is the drawer page (`?drawer=1`) rendered at the bounds the session page leaves for it and laid over the window; in',
  'the app it is a native view placed there by `src/electron/drawer.ts`. Not a capture of the running Electron app.',
  '',
].join('\n'));
