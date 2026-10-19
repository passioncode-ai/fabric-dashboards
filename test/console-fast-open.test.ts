// FD-74 (SCN-048): the console opens at once. Switchboard's answer about a folder is shown from memory while it is
// young and refreshed in the background when it is old; the runtimes are read ahead of the first open (warm).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { BINDING_FRESH_MS, ConsoleHost } from '../src/electron/console';
import { tmp } from './helpers';

const posixOnly = process.platform === 'win32' && 'POSIX execute bits: the fake runtime and Switchboard are shell scripts';

function rig() {
  const base = tmp('fd-fast-open-');
  const bin = path.join(base, 'bin');
  const folder = path.join(base, 'agent');
  fs.mkdirSync(bin); fs.mkdirSync(folder);
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'switchboard'), '#!/bin/sh\n', { mode: 0o755 });
  const settings = { consoles: { 'example-agent.default': { runtime: 'claude-code', folder } } } as Record<string, unknown>;
  const calls: string[] = [];
  let hold = false;
  const host = new ConsoleHost({
    settings: { get: () => settings, update: () => undefined } as never,
    snapshot: () => null, window: () => null, visible: () => false, log: () => {},
    testDirs: [bin], scriptsDir: path.join(base, 'scripts'),
    run: (_file: string, args: string[]) => {
      calls.push(args.join(' '));
      if (args.includes('project')) {
        if (hold) return new Promise(() => undefined); // a Switchboard that stalls (FD-71)
        return Promise.resolve({ code: 0, stdout: JSON.stringify({ ok: true, data: { path: folder, project: { name: 'Growth', pool: 'growth' }, rules: [] } }), stderr: '' });
      }
      return Promise.resolve({ code: 0, stdout: '{}', stderr: '' });
    },
    spawn: () => { throw new Error('nothing starts here'); },
    killGroup: () => {},
  });
  return { host, calls, stall: () => { hold = true; }, projectReads: () => calls.filter((c) => c.includes('project show')).length };
}

test('FD-74: warm() reads the runtimes before the console is first opened', { skip: posixOnly }, async () => {
  const r = rig();
  r.host.warm();
  for (let i = 0; i < 50 && !r.calls.some((c) => c.includes('agents list')); i++) await new Promise((x) => setTimeout(x, 10));
  assert.ok(r.calls.some((c) => c.includes('agents list')), 'the runtime catalog was read ahead');
  assert.equal(r.projectReads(), 0, 'no folder is asked about before a console opens');
});

test('FD-74: a young answer about the folder is shown without asking Switchboard again', { skip: posixOnly }, async () => {
  const r = rig();
  const first = await r.host.info('example-agent.default');
  assert.equal(first.binding.kind, 'project');
  assert.equal(r.projectReads(), 1);
  await r.host.info('example-agent.default');
  assert.equal(r.projectReads(), 1, 'the second open asks nothing');
});

test('FD-74: an old answer is shown at once while a stalled Switchboard is asked again in the background', { skip: posixOnly }, async (t) => {
  const r = rig();
  await r.host.info('example-agent.default');
  const realNow = Date.now;
  t.after(() => { Date.now = realNow; });
  Date.now = () => realNow() + BINDING_FRESH_MS + 1_000;
  r.stall();
  const shown = await Promise.race([r.host.info('example-agent.default'), new Promise<null>((x) => setTimeout(() => x(null), 500))]);
  assert.ok(shown, 'the console opened without waiting for Switchboard');
  assert.equal(shown!.binding.kind, 'project', 'with the answer it had');
  assert.equal(r.projectReads(), 2, 'and asked again once in the background');
  await r.host.info('example-agent.default');
  assert.equal(r.projectReads(), 2, 'a question already in flight is not asked twice');
});
