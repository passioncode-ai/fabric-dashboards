// FD-39 SCN-058 (ADR-0020 decision 6): the first session is a setup the person's coding agent runs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { prepareSetup, readSetupState, registerCommand, setupMarkdown, SETUP_KEY } from '../src/core/setup';
import { tmp } from './helpers';

const server = { command: '/Applications/Fabric Dashboards.app/Contents/MacOS/Fabric Dashboards', args: ['/Applications/Fabric Dashboards.app/Contents/Resources/app.asar/out/main/mcp/server.js'], env: { ELECTRON_RUN_AS_NODE: '1' } };

test('FD-39 SCN-058: what is already set up is read, never changed — MCP for Claude or Codex, the adapter skills, a first agent', () => {
  const home = tmp('fd-setup-');
  assert.deepEqual(readSetupState(home, 0), { mcp: false, skills: false, firstAgent: false });
  fs.writeFileSync(path.join(home, '.claude.json'), JSON.stringify({ projects: { '/w': { mcpServers: { 'fabric-dashboards': { command: 'x' } } } } }));
  fs.mkdirSync(path.join(home, '.agents/skills/creating-fabric-agents'), { recursive: true });
  fs.writeFileSync(path.join(home, '.agents/skills/creating-fabric-agents/SKILL.md'), '---');
  assert.deepEqual(readSetupState(home, 2), { mcp: true, skills: true, firstAgent: true });
  const codexOnly = tmp('fd-setup-');
  fs.mkdirSync(path.join(codexOnly, '.codex'));
  fs.writeFileSync(path.join(codexOnly, '.codex/config.toml'), 'model = "x"\n\n[mcp_servers.fabric-dashboards]\ncommand = "x"\n');
  assert.equal(readSetupState(codexOnly, 0).mcp, true);
  fs.writeFileSync(path.join(codexOnly, '.claude.json'), '{ not json');
  assert.equal(readSetupState(codexOnly, 0).mcp, true, 'a damaged ~/.claude.json is not a crash');
});

test('FD-39 SCN-058: the registration command is each CLI\'s own syntax, quoted, with the name before the variadic -e', () => {
  assert.equal(registerCommand('claude-code', server),
    "claude mcp add --scope user fabric-dashboards -e ELECTRON_RUN_AS_NODE=1 -- '/Applications/Fabric Dashboards.app/Contents/MacOS/Fabric Dashboards' '/Applications/Fabric Dashboards.app/Contents/Resources/app.asar/out/main/mcp/server.js'");
  assert.match(registerCommand('codex', server)!, /^codex mcp add fabric-dashboards --env ELECTRON_RUN_AS_NODE=1 -- '/);
  assert.equal(registerCommand('aider', server), null);
});

test('FD-39 SCN-058: setup.md orders the steps, marks what is done, keeps human gates human, and the runtime starts on it', () => {
  const md = setupMarkdown({ runtimeId: 'claude-code', runtimeName: 'Claude Code', server, state: { mcp: true, skills: false, firstAgent: false }, platform: 'darwin' });
  const order = ['MCP server', 'Adapter skills', 'family products', 'first agent', 'Make it a service'].map((x) => md.indexOf(x));
  assert.ok(order.every((i) => i > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'in order');
  assert.match(md, /MCP server, for every session\*\* — \*\*already done/);
  assert.doesNotMatch(md, /Adapter skills\*\* — \*\*already done/);
  for (const gate of ['consent', 'sign-in', 'hidden', 'SHA256SUMS', 'list_services']) assert.ok(md.includes(gate), gate);
  const dir = path.join(tmp('fd-setup-pack-'), 'consoles', SETUP_KEY);
  const r = prepareSetup({ dir, runtimeId: 'claude-code', runtimeName: 'Claude Code', server, state: { mcp: false, skills: false, firstAgent: false } });
  assert.ok(fs.existsSync(r.files.setup) && !fs.existsSync(path.join(dir, 'context.md')));
  assert.equal(r.handoff.before[0], `--mcp-config=${r.files.mcp}`);
  assert.match(r.handoff.after[0]!, /setup\.md and run the setup with me/, 'the setup starts on the click, not on a second prompt');
  for (const a of [...r.handoff.before, ...r.handoff.after]) assert.ok(a.length <= 1024);
  assert.equal(r.env.FABRIC_DASHBOARDS_SETUP, r.files.setup);
});
