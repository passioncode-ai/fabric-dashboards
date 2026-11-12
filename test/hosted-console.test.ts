// FD-211 (SB-342 H-1, H-1d): a console's own session runs in Switchboard's session host when that Switchboard can also
// end it there (`launch --hosted` and `sessions end`, 0.7.66): Stop and the idle close end it with `sessions end`, and
// the app quitting only closes its view, so the session runs on and is not recorded as ended here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConsoleHost } from '../src/electron/console';
import { launchFeatures } from '../src/core/switchboard';
import { planStart } from '../src/core/consoles';
import { SettingsStore } from '../src/core/settings';
import { tmp } from './helpers';

const POSIX = { skip: process.platform === 'win32' && 'POSIX execute bits: the fake runtimes are shell scripts' };
const GB = 1024 ** 3;
const LID = '00000000-0000-4000-8000-000000000211';
const ok = (data: unknown) => ({ code: 0, stdout: JSON.stringify({ ok: true, data }), stderr: '' });

function rig(o: { hosted?: boolean; listed?: boolean; endFails?: boolean } = {}) {
  const base = tmp('fd-211-');
  const bin = path.join(base, 'bin');
  const folder = path.join(base, 'work');
  fs.mkdirSync(bin);
  fs.mkdirSync(folder);
  for (const f of ['claude', 'switchboard']) fs.writeFileSync(path.join(bin, f), '#!/bin/sh\n', { mode: 0o755 });
  const settings = new SettingsStore(path.join(base, 'data'));
  const spawned: { file: string; args: string[]; cwd: string }[] = [];
  const asked: string[] = [];
  const exits = new Map<number, (e: { exitCode: number; signal?: number }) => void>();
  let pid = 2_110_000_000;
  let startedAt = Date.now();
  const host = new ConsoleHost({
    settings, snapshot: () => null, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'), packRoot: path.join(base, 'packs'), mcpServer: () => ({ command: '/app/mcp', args: [] }),
    run: async (_file, args) => {
      const line = args.join(' ');
      asked.push(line);
      if (line === 'launch --help') return { code: 0, stdout: `--provider --in-place --surface --target${o.hosted === false ? '' : ' --hosted'}`, stderr: '' };
      if (line === 'sessions --help') return { code: 0, stdout: 'Commands:\n  show  One launch\n  end   End a session a session host holds\n', stderr: '' };
      if (line === '--json sessions --all') return ok({ sessions: o.listed === false ? [] : [{ working_directory: folder, state: 'running', provider: 'claude', agent: 'claude-code', in_place: true, launch_id: LID, launched_at: Math.floor(startedAt / 1000) }] });
      if (line === `--json sessions end ${LID}`) {
        if (o.endFails) return { code: 1, stdout: '', stderr: '{"error":"No session with this launch id is open here.","ok":false}' };
        // The host ends the session; its viewer (our console's process) exits with it.
        setTimeout(() => { for (const cb of exits.values()) cb({ exitCode: 129 }); }, 5);
        return ok({ launch_id: LID, exit_code: 129, reason: 'ended' });
      }
      if (line.startsWith('--json project show')) return ok({ project: null, rules: [] });
      return { code: 1, stdout: '', stderr: '' };
    },
    spawn: (file, args, opts) => {
      spawned.push({ file, args, cwd: opts.cwd });
      startedAt = Date.now();
      const me = pid++;
      return { pid: me, onData: () => ({ dispose() {} }), onExit: (cb: (e: { exitCode: number; signal?: number }) => void) => { exits.set(me, cb); return { dispose() {} }; }, write() {}, resize() {}, kill() {} };
    },
    killGroup: (p) => { setTimeout(() => exits.get(p)?.({ exitCode: 0, signal: 1 }), 1); },
    idleMs: 0,
    machine: async () => ({ freeDisk: 50 * GB, swap: null, running: 0 }),
    home: base,
  });
  const start = async () => {
    const done = await host.startNew({ kind: 'session', runtime: 'claude-code', folder, bypass: true, isolated: true }, { cols: 80, rows: 24 });
    assert.ok(done.ok, JSON.stringify(done));
    return done.ok ? done.key : '';
  };
  return { host, folder, settings, spawned, asked, start };
}
const tick = (ms = 30) => new Promise((res) => setTimeout(res, ms));

test('FD-211: a Switchboard is used as a session host only when it can also end what runs there', async () => {
  const answers = (launch: string, sessions: string) => async (_f: string, a: string[]) => {
    const line = a.join(' ');
    return line === 'launch --help' ? { code: 0, stdout: launch, stderr: '' } : line === 'sessions --help' ? { code: 0, stdout: sessions, stderr: '' } : { code: 1, stdout: '', stderr: '' };
  };
  assert.equal((await launchFeatures(answers('--provider --in-place --hosted', 'Commands:\n  show  x\n  end  y\n'), '/sb')).hosted, true);
  assert.equal((await launchFeatures(answers('--provider --in-place --hosted', 'Commands:\n  show  x\n'), '/sb')).hosted, false, '0.7.63: a host, but nothing ends a session there');
  assert.equal((await launchFeatures(answers('--provider --in-place', 'Commands:\n  end  y\n'), '/sb')).hosted, false);
  const CLAUDE = { id: 'claude-code', name: 'Claude Code', path: '/bin/claude', provider: 'claude' as const, canContinue: true };
  const plan = planStart({ runtime: CLAUDE as never, mode: 'new', folder: '/r', binding: { kind: 'project', name: 'G', pool: 'g' }, switchboard: '/sb', inPlace: true, surface: true, hosted: true });
  assert.ok(plan.kind === 'run' && plan.argv.join(' ').includes('--in-place --hosted --surface dashboards'), JSON.stringify(plan));
  const plain = planStart({ runtime: CLAUDE as never, mode: 'new', folder: '/r', binding: { kind: 'project', name: 'G', pool: 'g' }, switchboard: '/sb', inPlace: true });
  assert.ok(plain.kind === 'run' && !plain.argv.includes('--hosted'));
});

test('FD-211: Stop ends a hosted session with `sessions end`, and it is recorded as ended by the person', POSIX, async () => {
  const r = rig();
  const key = await r.start();
  assert.ok(r.spawned[0]!.args.includes('--hosted'), r.spawned[0]!.args.join(' '));
  assert.ok(r.host.runsOnWithoutApp(key));
  r.host.stopByPerson(key);
  await tick(80);
  assert.ok(r.asked.includes(`--json sessions end ${LID}`), r.asked.join('\n'));
  assert.equal(r.host.sessionsStatus().rows.find((x) => x.key === key)?.state, 'ended-by-you');
  assert.ok(!r.host.runsOnWithoutApp(key));
});

test('FD-211: the app quitting closes only the view of a hosted session: nothing ends it, nothing records it as ended', POSIX, async () => {
  const r = rig();
  const key = await r.start();
  await r.host.endAllForQuit();
  await tick();
  assert.ok(!r.asked.some((l) => l.startsWith('--json sessions end')), 'the session is not ended');
  assert.equal(r.settings.get().sessions.records.length, 0, 'no row says it ended here');
  void key;
});

test('FD-211: a hosted session Switchboard does not list, or cannot end, still gets its view closed', POSIX, async () => {
  for (const o of [{ listed: false }, { endFails: true }]) {
    const r = rig(o);
    const key = await r.start();
    r.host.stopByPerson(key);
    await tick(80);
    assert.notEqual(r.host.sessionsStatus().rows.find((x) => x.key === key)?.group, 'running', JSON.stringify(o));
  }
});

test('FD-211: a Switchboard without a way to end hosted sessions starts consoles as before', POSIX, async () => {
  const r = rig({ hosted: false });
  const key = await r.start();
  assert.ok(!r.spawned[0]!.args.includes('--hosted'));
  assert.ok(!r.host.runsOnWithoutApp(key));
});
