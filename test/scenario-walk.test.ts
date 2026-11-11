// Scenario walk 2026-11-11: defects found by tracing the scenario base to the code, each held here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost } from '../src/electron/console';
import { tmp } from './helpers';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('SCN-103: an agent placed elsewhere with no checkout here gets the folder it has there, not "choose a folder"', async () => {
  const base = tmp('walk-folder-');
  const home = path.join(base, 'home');
  fs.mkdirSync(home);
  const settings = { consoles: {} } as Record<string, unknown>;
  const host = new ConsoleHost({
    settings: { get: () => settings, update: () => {} } as never,
    snapshot: () => ({ descriptor: { origin: 'http://127.0.0.1:47861', source: { repository: 'https://github.com/example/agent-repo.git' } } }) as never,
    window: () => null, visible: () => false, log: () => {}, testDirs: [], scriptsDir: path.join(base, 'scripts'), home,
    run: async () => ({ code: 1, stdout: '', stderr: '' }), killGroup: () => {},
    placedElsewhere: () => ({ placedOn: 'm-other' }), launchJobs: () => [],
  });
  assert.deepEqual((await host.info('example-agent.default')).folder, { path: path.join(home, 'DATA', 'agent-repo'), source: 'found', exists: false });
  const here = new ConsoleHost({
    settings: { get: () => settings, update: () => {} } as never,
    snapshot: () => ({ descriptor: { origin: 'http://127.0.0.1:47861', source: { repository: 'https://github.com/example/agent-repo.git' } } }) as never,
    window: () => null, visible: () => false, log: () => {}, testDirs: [], scriptsDir: path.join(base, 'scripts'), home,
    run: async () => ({ code: 1, stdout: '', stderr: '' }), killGroup: () => {},
  });
  assert.equal((await here.info('example-agent.default')).folder, null, 'an agent placed here still needs its checkout here');
});

test('SCN-066: the idle continue is said only when it ran, happens once per idle close, and never in a folded drawer', () => {
  const panel = read('src/renderer/components/ConsolePanel.tsx');
  assert.match(panel, /if \(r\?\.ok\) setNotice\(\{ text: t\('console\.idle\.resumed'/, 'a refused continue keeps its own sentence');
  assert.match(panel, /resumed\.current = `\$\{serviceKey\}@\$\{info\.idle\.at\}`/, 'keyed on the idle close, not the agent');
  assert.match(panel, /if \(page \|\| !active \|\|/, 'not while the drawer is folded');
  assert.match(read('src/renderer/DrawerApp.tsx'), /active=\{push\.shown !== false\}/);
  assert.match(read('src/electron/drawer.ts'), /if \(was\) this\.push\(false\)/, 'folding tells the page');
});

test('SCN-054: a Fix or Update task whose start was refused waits for the next New session', () => {
  assert.match(read('src/renderer/components/ConsolePanel.tsx'), /void start\(task\.mode \?\? 'new', task\.task\)\.then\(\(r\) => \{ if \(!r\?\.ok && task\.task\) setWaiting\(task\.task\); \}\)/);
});

test('SCN-103: "View only" shows only for a key that reaches the port, not for a refused key or a silent machine', () => {
  assert.match(read('src/renderer/components/ConsolePanel.tsx'), /\{remote\?\.access === 'view' && <span/);
});

test('SCN-098: a setting changed through the console channel reaches the window, its language included', () => {
  const main = read('src/electron/main.ts');
  const branch = main.slice(main.indexOf("if (r.op === 'settings.update')"), main.indexOf("if (r.op === 'sessions.act'"));
  assert.match(branch, /window\.webContents\.send\(CHANNELS\.settingsPush, settings\.get\(\)\)/);
  assert.match(read('src/renderer/App.tsx'), /onSettings\(\(s\) => \{[^}]*reloadLang\(\)/);
});

test('SCN-026, SCN-052: a link that starts the app is queued once', () => {
  assert.match(read('src/electron/main.ts'), /if \(argvLink && !pendingLinks\.includes\(argvLink\)\) pendingLinks\.push\(argvLink\)/);
});

test('SCN-096: MCP consoles lists a continue that did not take up its conversation; it still runs here', async () => {
  const { openConsolesOf } = await import('../src/core/console-channel');
  const row = (state: string, group: string) => ({ id: `c:${state}`, key: 'handover.rs-0123456789ab', state, group, agent: 'Claude Code', folder: '/work/a', startedAt: 1, at: 1, launch: null }) as never;
  assert.equal(openConsolesOf([row('needs-you-resume-failed', 'needs-you')], () => null).length, 1);
  assert.equal(openConsolesOf([row('ended-here', 'ended')], () => null).length, 0);
});

test('SCN-078, SCN-086: Switchboard is "not installed" only once looked for; the hand-over switch says "update" only when it is old', () => {
  const host = read('src/electron/console.ts');
  assert.match(host, /private switchboardPresent: boolean \| null = null;/);
  assert.match(host, /return \{ available: true, enabled: null, old: r\.unavailable === 'old' \}/);
  assert.match(read('src/renderer/components/Sessions.tsx'), /sessions\.switchboard === false && <p/);
  assert.match(read('src/renderer/components/Settings.tsx'), /handovers\.enabled === null && handovers\.old && <p/);
});

test('SCN-083: a refused Continue now leaves the stop waiting; only an automatic continue is recorded as failed', () => {
  const host = read('src/electron/console.ts');
  assert.equal((host.match(/if \(automatic\) this\.actedStops\.set\(stop\.event, view\('failed'\)\)/g) ?? []).length, 2);
});

test('SCN-072: moving an agent keeps the manual places of agents the filter hides', async () => {
  const { moveInSection } = await import('../src/core/products');
  const p = (id: string) => ({ id }) as never;
  const arranged = { pinned: [], local: [p('a'), p('b'), p('c')], online: [], service: [], hidden: [] } as never;
  // Stored order: x (another organization, filtered out) sits between a and b.
  const patch = moveInSection(arranged, 'local' as never, 'c', 0, [], ['a', 'x', 'b', 'c']);
  assert.deepEqual(patch, { sort: 'manual', order: ['c', 'x', 'a', 'b'] });
  assert.deepEqual(moveInSection(arranged, 'local' as never, 'c', 0), { sort: 'manual', order: ['c', 'a', 'b'] }, 'no stored order: the shown one');
});
