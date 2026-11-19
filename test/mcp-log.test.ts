// FD-347: the MCP server keeps each event of its session in mcp.log beside main.log, so a session that reads
// "disconnected" can be explained afterwards; the file rotates once and holds no arguments.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PassThrough } from 'node:stream';
import { appendMcpLog, mcpLogFile } from '../src/mcp/mcp-log';
import { serve } from '../src/mcp/server';

test('FD-347: mcp.log sits beside main.log; a line carries the time and both process ids; past the cap it rotates once', () => {
  assert.equal(mcpLogFile('darwin', {}, '/Users/x'), '/Users/x/Library/Logs/Fabric Dashboards/mcp.log');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-347-'));
  const file = path.join(dir, 'logs', 'mcp.log');
  appendMcpLog('fabric-dashboards-mcp 1.0.0: started', file, 120, new Date('2026-11-19T11:17:05Z'), 41, 40);
  assert.equal(fs.readFileSync(file, 'utf8'), '2026-11-19T11:17:05.000Z pid=41 ppid=40 fabric-dashboards-mcp 1.0.0: started\n');
  if (process.platform !== 'win32') assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  appendMcpLog('leaving (stdin\nclosed)', file, 120, new Date('2026-11-19T11:17:06Z'), 41, 40);
  assert.match(fs.readFileSync(file, 'utf8'), /leaving \(stdin closed\)\n$/, 'one event, one line');
  appendMcpLog('third', file, 120, new Date('2026-11-19T11:17:07Z'), 41, 40);
  assert.ok(fs.existsSync(`${file}.1`), 'past the cap the file moves to mcp.log.1');
  assert.match(fs.readFileSync(file, 'utf8'), /^\S+ pid=41 ppid=40 third\n$/);
  appendMcpLog('never throws', path.join('/dev/null', 'nope', 'mcp.log'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('FD-347: the server writes its start and the reason it leaves, with the exit code, to the log it is given', async () => {
  const lines: string[] = [];
  const input = new PassThrough();
  const output = new PassThrough();
  const exited = new Promise<number>((resolve) => serve(undefined as never, input, output, { exit: resolve, watch: null, handover: null, log: (l) => lines.push(l) }));
  input.end();
  assert.equal(await exited, 0);
  assert.match(lines[0]!, /^fabric-dashboards-mcp \S+: started$/);
  assert.match(lines.at(-1)!, /: leaving \(stdin closed\), exit 0$/);
});
