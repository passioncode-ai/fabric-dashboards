// FD-324 (contract DEC-0183 SL-2, SL-3): changing an agent's spending limit. The host checks the change against the
// agent's own report, says whether it only tightens, and calls the agent's `spend.limits.set` through one MCP door or two.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { summarizeUsage } from '@passioncode-ai/fabric-service-host/usage';
import { callCapability, executeDoorOf } from '../src/core/mcp-client';
import { changeOf, limitDoorOf, planLimitChange } from '../src/core/limit-edit';

const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/contract', name), 'utf8'));
const limits = summarizeUsage(fixture('positive_service-usage-limits-edit.json'), Date.parse('2026-10-04T12:00:00Z')).limits;

test('FD-324: a change is checked against the report: unknown, not editable, outside its bounds, no change, no reason', () => {
  const plan = (c: Parameters<typeof planLimitChange>[1]) => planLimitChange(limits, c);
  assert.equal((plan({ limitId: 'nope', limitUsd: 5, reason: 'x' }) as { code: string }).code, 'unknown-limit');
  assert.equal((plan({ limitId: 'project.demo.weekly', limitUsd: 5, reason: 'x' }) as { code: string }).code, 'limit-not-editable');
  assert.equal((plan({ limitId: 'machine.daily', limitUsd: 500, reason: 'x' }) as { code: string }).code, 'invalid-amount', 'above maxUsd 200');
  assert.equal((plan({ limitId: 'machine.daily', limitUsd: 0.5, reason: 'x' }) as { code: string }).code, 'invalid-amount', 'below minUsd 1');
  assert.equal((plan({ limitId: 'machine.daily', limitUsd: null, reason: 'x' }) as { code: string }).code, 'invalid-amount', 'a daily limit is a dollar amount');
  assert.equal((plan({ limitId: 'machine.daily', limitUsd: 20, reason: 'x' }) as { code: string }).code, 'no-change');
  assert.equal((plan({ limitId: 'machine.daily', limitUsd: 10, reason: '  ' }) as { code: string }).code, 'reason-required');
});

test('FD-324 (SL-2): a lower amount or turning a limit on tightens; a higher amount or turning it off is the operator\'s', () => {
  const tightens = (c: Parameters<typeof planLimitChange>[1]) => { const p = planLimitChange(limits, c); assert.ok(p.ok, JSON.stringify(p)); return p.tightens; };
  assert.equal(tightens({ limitId: 'machine.daily', limitUsd: 10, reason: 'calmer week' }), true);
  assert.equal(tightens({ limitId: 'machine.daily', limitUsd: 50, reason: 'launch' }), false);
  assert.equal(tightens({ limitId: 'machine.monthly', enforced: true, reason: 'back on' }), true);
  assert.equal(tightens({ limitId: 'emergency.day', enforced: false, reason: 'lift it' }), false);
  assert.equal(tightens({ limitId: 'machine.monthly', limitUsd: 100, enforced: true, reason: 'tighter' }), true);
  assert.equal(tightens({ limitId: 'machine.monthly', limitUsd: 300, enforced: true, reason: 'mixed' }), false, 'any loosening part makes it the operator\'s');
  const p = planLimitChange(limits, { limitId: 'machine.daily', limitUsd: 10, enforced: true, reason: ' calmer ' });
  assert.deepEqual(p.ok && p.args, { limitId: 'machine.daily', limitUsd: 10, reason: 'calmer' }, 'only what changes is sent, the reason trimmed');
});

test('FD-324: the door is the agent\'s own MCP surface on this Mac when it lists spend.limits.set; the answer is its change', () => {
  const s = (caps: string[], origin = 'http://127.0.0.1:8720') => ({ descriptor: { origin }, wellKnown: { surfaces: { mcp: { transport: 'streamable-http', path: '/mcp', capabilities: caps } } } });
  assert.deepEqual(limitDoorOf(s(['spend.limits.set'])), { origin: 'http://127.0.0.1:8720', path: '/mcp' });
  assert.equal(limitDoorOf(s(['other.thing'])), null);
  assert.equal(limitDoorOf(s(['spend.limits.set'], 'https://agent.example')), null, 'an online agent waits for a control door (FD-194)');
  const change = { id: 'chg-1', limitId: 'machine.daily', before: { limitUsd: 20, enforced: true }, after: { limitUsd: 10, enforced: true } };
  assert.deepEqual(changeOf({ structuredContent: { change } }), { change, repeated: false });
  assert.deepEqual(changeOf({ content: [{ type: 'text', text: JSON.stringify({ change, repeated: true }) }] }), { change, repeated: true });
  assert.equal(changeOf({ content: [{ type: 'text', text: 'ok' }] }), null);
});

test('FD-324: callCapability carries _meta, and reaches an agent with two doors through execute with its key', async (t) => {
  const calls: { name: string; args: unknown; meta: unknown }[] = [];
  let tools = ['search', 'execute'];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.method === 'DELETE') { res.writeHead(204); res.end(); return; }
      const msg = JSON.parse(body) as { id?: number; method: string; params?: { name: string; arguments?: unknown; _meta?: unknown } };
      const json = (result: unknown) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })); };
      if (msg.method === 'initialize') return json({ protocolVersion: '2025-03-26' });
      if (!msg.id) { res.writeHead(202); res.end(); return; }
      if (msg.method === 'tools/list') return json({ tools: tools.map((name) => ({ name })) });
      calls.push({ name: msg.params!.name, args: msg.params!.arguments, meta: msg.params!._meta });
      return json({ structuredContent: { change: { id: 'chg-9' } } });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const target = { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, path: '/mcp' };
  const decision = { by: 'operator', via: 'relayed-instruction', action: 'spend.limits.set', target: 'demo.default:machine.daily', instruction: 'launch week', at: '2026-11-18T21:00:00Z' };
  const args = { limitId: 'machine.daily', limitUsd: 50, reason: 'launch week' };
  await callCapability(target, 'spend.limits.set', args, '0.8.205', 5_000, { meta: { decision }, idempotencyKey: 'k-1' });
  assert.deepEqual(calls[0], { name: 'execute', args: { operation: 'spend.limits.set', arguments: args, idempotencyKey: 'k-1' }, meta: { decision } });
  tools = ['spend_limits_set'];
  await callCapability(target, 'spend.limits.set', args, '0.8.205', 5_000, { idempotencyKey: 'k-2' });
  assert.deepEqual(calls[1], { name: 'spend_limits_set', args, meta: undefined }, 'a tool of its own takes the arguments as they are');
});

test('FD-343 (DEC-0180 CM-1, DEC-0182 TD-5): the execute door is the declared one, else `execute`, else one `<domain>.execute` beside a search door', () => {
  assert.equal(executeDoorOf(['records.search', 'records.execute'], 'records.execute'), 'records.execute');
  assert.equal(executeDoorOf(['records_search', 'records_execute'], 'records.execute'), 'records_execute', 'the declared name in its underscored spelling');
  assert.equal(executeDoorOf(['search', 'execute']), 'execute');
  assert.equal(executeDoorOf(['assessment.search', 'assessment.execute']), 'assessment.execute', 'a surface pinned before DEC-0180');
  assert.equal(executeDoorOf(['search', 'agents_db.execute']), 'agents_db.execute');
  assert.equal(executeDoorOf(['assessment.execute']), undefined, 'no search door: not a two-door surface');
  assert.equal(executeDoorOf(['a.search', 'a.execute', 'b.execute']), undefined, 'two candidates: none is guessed');
  assert.equal(executeDoorOf(['records.list', 'records.get']), undefined);
  const s = { descriptor: { origin: 'http://127.0.0.1:8720' }, wellKnown: { surfaces: { mcp: { transport: 'streamable-http', path: '/mcp', capabilities: ['spend.limits.set'], compact: { search: 'spend.search', execute: 'spend.execute' } } } } };
  assert.deepEqual(limitDoorOf(s), { origin: 'http://127.0.0.1:8720', path: '/mcp', execute: 'spend.execute' });
});

test('FD-343: callCapability reaches a `<domain>.execute` door, and the declared one before any other', async (t) => {
  const calls: { name: string; args: unknown }[] = [];
  let tools = ['assessment.search', 'assessment.execute'];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (req.method === 'DELETE') { res.writeHead(204); res.end(); return; }
      const msg = JSON.parse(body) as { id?: number; method: string; params?: { name: string; arguments?: unknown } };
      const json = (result: unknown) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result })); };
      if (msg.method === 'initialize') return json({ protocolVersion: '2025-03-26' });
      if (!msg.id) { res.writeHead(202); res.end(); return; }
      if (msg.method === 'tools/list') return json({ tools: tools.map((name) => ({ name })) });
      calls.push({ name: msg.params!.name, args: msg.params!.arguments });
      return json({ structuredContent: { change: { id: 'chg-1' } } });
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const target = { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}`, path: '/mcp' };
  const args = { limitId: 'machine.daily', limitUsd: 10, reason: 'calmer' };
  await callCapability(target, 'spend.limits.set', args, '0.8.207', 5_000, { idempotencyKey: 'k-1' });
  assert.deepEqual(calls[0], { name: 'assessment.execute', args: { operation: 'spend.limits.set', arguments: args, idempotencyKey: 'k-1' } });
  tools = ['search', 'execute', 'spend.run'];
  await callCapability(target, 'spend.limits.set', args, '0.8.207', 5_000, { idempotencyKey: 'k-2', execute: 'spend.run' });
  assert.equal(calls[1]!.name, 'spend.run', 'the name the surface declares wins over a plain `execute`');
  tools = ['records.list'];
  await assert.rejects(callCapability(target, 'spend.limits.set', args, '0.8.207', 5_000), /offers no tool for spend\.limits\.set/);
});

test('FD-324: Change shows the amount within its bounds, Enforced and the reason; the change history reads in words', async () => {
  const React = await import('react');
  (globalThis as { React?: unknown }).React = React; // the renderer's JSX reads React from the scope
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LimitEditor, LimitChanges } = await import('../src/renderer/components/Spend');
  const { t: tr } = await import('../src/core/i18n');
  const en = (k: string, p?: Record<string, string | number>) => tr('en', k, p);
  const ru = (k: string, p?: Record<string, string | number>) => tr('ru', k, p);
  const daily = limits.find((l) => l.id === 'machine.daily')!;
  const form = renderToStaticMarkup(React.createElement(LimitEditor, { agent: 'example-agent.default', limit: daily, t: en, onCancel: () => undefined, onDone: () => undefined }));
  assert.match(form, /Limit, USD/);
  assert.match(form, /value="20"/);
  assert.match(form, /min="1"/);
  assert.match(form, /max="200"/);
  assert.match(form, /From \$1\.00 to \$200\.00/);
  assert.match(form, /Enforced/);
  assert.match(form, /The agent records it with the change/);
  assert.match(form, /disabled=""[^>]*>Save/, 'nothing changed and no reason yet: Save waits');
  const report = summarizeUsage(fixture('positive_service-usage-limits-edit.json'), Date.parse('2026-10-04T12:00:00Z'));
  const day = (iso: string) => iso.slice(0, 10);
  const history = renderToStaticMarkup(React.createElement(LimitChanges, { changes: report.limitChanges!, limits: report.limits, t: en, day }));
  assert.match(history, /<h3>Changes<\/h3>/);
  assert.match(history, /2026-10-04, Monthly · all projects: \$100\.00 → \$250\.00, not enforced\. Decided by: the operator\. The operator raised/);
  assert.match(history, /2026-10-01, Emergency stop · all projects: set to \$500\.00\. Decided by: the agent&#x27;s settings\./);
  const ruHistory = renderToStaticMarkup(React.createElement(LimitChanges, { changes: report.limitChanges!, limits: report.limits, t: ru, day }));
  assert.match(ruHistory, /<h3>Изменения<\/h3>/);
  assert.match(ruHistory, /Кто решил: оператор/);
});

test('FD-324 (SL-6): the months chart names each month and its money; the last is so far, an unpriced one a lower bound', async () => {
  const React = await import('react');
  (globalThis as { React?: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MonthlyChart } = await import('../src/renderer/components/Spend');
  const { t: tr } = await import('../src/core/i18n');
  const en = (k: string, p?: Record<string, string | number>) => tr('en', k, p);
  const months = summarizeUsage(fixture('positive_service-usage-limits-edit.json'), Date.parse('2026-10-04T12:00:00Z')).months!;
  const html = renderToStaticMarkup(React.createElement(MonthlyChart, { months, t: en, monthName: (m: string) => m }));
  assert.match(html, /Spend by month, as the agent reports it/);
  assert.match(html, /aria-label="Spend by month over the last 3 months"/);
  assert.match(html, /<title>2026-08: \$14\.20<\/title>/);
  assert.match(html, /<title>2026-09: ≥ \$38\.75<\/title>/, '4 calls carry no price: a lower bound');
  assert.match(html, /<title>2026-10: ≥ \$1\.59 so far<\/title>/);
  assert.equal((html.match(/class="partial"/g) ?? []).length, 2);
});
