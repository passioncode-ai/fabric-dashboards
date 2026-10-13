// End to end, FD-02: SCN-028's administration half walked on the built MCP server (out/main/mcp/server.js, as
// the packaged launcher runs it): doctor runs the declared command and returns its output, control refuses a
// service with no launchd lifecycle, spend returns the agent's own report, and an unknown tool is a JSON-RPC error.
// (list_services, link and activity are walked in app.test.ts.)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { freePort, register, serve, stopProcess, tmp, waitAnswering } from '../helpers';

const ROOT = path.resolve(__dirname, '../..');

test('SCN-028: an agent runs doctor, is refused control without launchd, reads spend, and gets -32602 for an unknown tool', { timeout: 120_000 }, async () => {
  const base = tmp('fd-e2e-mcp-');
  const services = path.join(base, 'services');
  const data = path.join(base, 'data');
  fs.mkdirSync(services);
  const port = await freePort();
  const proc = serve(port, data);
  try {
    await waitAnswering(port);
    register(port, data, services);
    const file = path.join(services, 'sample.default.json');
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...d, commands: { doctor: [process.platform === 'win32' ? 'C:\\Windows\\System32\\whoami.exe' : '/bin/echo', ...(process.platform === 'win32' ? [] : ['doctor ok'])] } }));
    const token = fs.readFileSync(path.join(data, 'service.token'), 'utf8').trim();
    const calls = [
      '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}',
      '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"doctor","arguments":{"service":"sample.default"}}}',
      '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"control","arguments":{"service":"sample.default","action":"restart"}}}',
      '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"spend","arguments":{}}}',
      '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"no_such_tool","arguments":{}}}',
      '',
    ];
    const mcp = spawnSync(process.execPath, [path.join(ROOT, 'out/main/mcp/server.js')], { input: calls.join('\n'), encoding: 'utf8', timeout: 60_000, env: { ...process.env, FABRIC_SERVICES_DIR: services } });
    assert.ok(!mcp.stdout.includes(token), 'no MCP answer carries the service token');
    const replies = new Map(mcp.stdout.trim().split('\n').map((l) => JSON.parse(l) as { id: number; result?: { isError?: boolean; structuredContent?: Record<string, unknown>; content?: { text: string }[] }; error?: { code: number } }).map((r) => [r.id, r]));
    const doctor = replies.get(2)!.result!.structuredContent as { code: number; output: string };
    assert.equal(doctor.code, 0, JSON.stringify(replies.get(2)));
    if (process.platform !== 'win32') assert.match(doctor.output, /doctor ok/);
    const control = replies.get(3)!.result!;
    assert.equal(control.isError, true, 'control is refused');
    assert.match(control.content![0]!.text, /not managed by launchd|supervised by launchd, which this system does not have/);
    const spend = replies.get(4)!.result!.structuredContent as { services?: { key: string }[]; entries?: { key: string }[] };
    assert.ok(JSON.stringify(spend).includes('sample.default'), `spend names the agent: ${JSON.stringify(spend).slice(0, 300)}`);
    assert.equal(replies.get(5)!.error?.code, -32602, 'an unknown tool is a JSON-RPC error');
  } finally {
    await stopProcess(proc);
  }
});
