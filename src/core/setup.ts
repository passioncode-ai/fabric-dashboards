// #region agent-setup — docs: docs/adr/0020-agents-first-handoff-and-setup.md#decision
// FD-39 / ADR-0020 decision 6 (SCN-058): the first session is a setup run by the person's coding agent in
// a console that belongs to no agent. The app writes `setup.md` — what to do, in order, with the exact
// commands for this machine — and starts the runtime reading it; the person answers only sign-ins,
// consents and secrets. The app checks what is done (MCP registered, adapter skills found, a first agent)
// and shows it; it runs none of the steps itself.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handoffArgs, mcpConfig, writePack, type McpCommand } from './handoff';

export { SETUP_KEY } from './offers';

export interface SetupState {
  /** This app's MCP server is registered with Claude Code or Codex for every session. */
  mcp: boolean;
  /** The Fabric Agent Adapter skills (creating-fabric-agents, …) are installed for a coding agent. */
  skills: boolean;
  /** At least one Fabric service is installed — the first agent exists. */
  firstAgent: boolean;
}

const readText = (file: string) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };

/** What is already set up on this machine — read only, never changed. */
export function readSetupState(home: string, services: number, exists: (p: string) => boolean = fs.existsSync): SetupState {
  let mcp = false;
  try {
    const c = JSON.parse(readText(path.join(home, '.claude.json')) || '{}') as { mcpServers?: Record<string, unknown>; projects?: Record<string, { mcpServers?: Record<string, unknown> }> };
    mcp = Boolean(c.mcpServers?.['fabric-dashboards']) || Object.values(c.projects ?? {}).some((p) => Boolean(p?.mcpServers?.['fabric-dashboards']));
  } catch { /* unreadable: not registered as far as we can tell */ }
  if (!mcp) mcp = /^\s*\[mcp_servers\.(?:"fabric-dashboards"|fabric-dashboards)\]/m.test(readText(path.join(home, '.codex', 'config.toml')));
  const skillDirs = ['.agents/skills', '.claude/skills', '.codex/skills'].map((d) => path.join(home, d, 'creating-fabric-agents', 'SKILL.md'));
  const skills = skillDirs.some((f) => exists(f)) || /fabric-agent-adapter/.test(readText(path.join(home, '.claude', 'plugins', 'installed_plugins.json')));
  return { mcp, skills, firstAgent: services > 0 };
}

/** How to register this app's MCP server with the runtime, as a command the agent runs. */
export function registerCommand(runtimeId: string, server: McpCommand): string | null {
  const q = (s: string) => (/^[A-Za-z0-9_./:@=+-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
  const argv = [server.command, ...server.args].map(q).join(' ');
  const env = Object.entries(server.env ?? {});
  // The name before -e: `-e` takes several values (claude mcp add --help: `my-server -e API_KEY=xxx -- …`).
  if (runtimeId === 'claude-code') return `claude mcp add --scope user fabric-dashboards ${env.map(([k, v]) => `-e ${k}=${q(v)} `).join('')}-- ${argv}`;
  if (runtimeId === 'codex') return `codex mcp add fabric-dashboards ${env.map(([k, v]) => `--env ${k}=${q(v)} `).join('')}-- ${argv}`;
  return null;
}

/** `setup.md`: the steps, in order, with this machine's commands; done steps are marked, not repeated. */
export function setupMarkdown(o: { runtimeId: string; runtimeName: string; server: McpCommand; state: SetupState; platform: NodeJS.Platform }): string {
  const reg = registerCommand(o.runtimeId, o.server);
  const done = (b: boolean) => (b ? ' — **already done; check it, do not repeat it**' : '');
  return [
    '# Set up Fabric on this computer — run by you, the coding agent',
    '',
    `You are ${o.runtimeName}, started by Fabric Dashboards' Setup console. The person watches the result in the app:`,
    'its list fills as agents appear, and its setup card ticks each step. **Run every command yourself.** Ask the',
    'person only for: a consent before installing anything, a sign-in in a browser, a secret (typed into a hidden',
    'prompt — never printed, never in an argument or a file you show), a choice only they can make. One question at',
    'a time. Say what you are about to do before each step, and what happened after it.',
    '',
    '## Steps, in order',
    '',
    `1. **Fabric Dashboards' MCP server, for every session**${done(o.state.mcp)}.`,
    reg ? `   Register it: \`${reg}\`` : `   Register this MCP server with ${o.runtimeName} the way its documentation says: command \`${o.server.command}\`, arguments ${JSON.stringify(o.server.args)}, environment ${JSON.stringify(o.server.env ?? {})}.`,
    `   Prove it: ${o.runtimeId === 'codex' ? '`codex mcp list`' : '`claude mcp list`'} shows \`fabric-dashboards\` connected. In this session the server is already loaded: call its tool \`list_services\` and tell the person how many agents it sees.`,
    '',
    `2. **The Fabric Agent Adapter skills**${done(o.state.skills)}.`,
    '   They teach you to create, adapt and run Fabric agents (`creating-fabric-agents`, `adapting-projects-to-fabric`, `building-fabric-services`).',
    '   If the family setup entry exists (`npx @passioncode-ai/passioncode onboard --help` answers), run it and follow it — it orders the steps below itself.',
    '   Otherwise, with the person\'s consent: `npx --yes @passioncode-ai/passioncode@latest update`. Skills load when a session starts: tell the person to restart you after this step, and continue with `--continue`.',
    '',
    '3. **The family products — one at a time, each only with the person\'s consent**, in the order fabric-workspace `knowledge/agents-first.md` gives (its one home). Say in one sentence what each does, then ask.',
    '   **Every download is verified before it runs:** `gpg --verify SHA256SUMS.asc SHA256SUMS` against the organization key (fingerprint `63B3 0DC3 24BD 6974 87AA 3194 4FAF B8AE C803 B6A7`, published in passioncode-ai/.github `release-signing/passioncode-release-signing.asc`), then `shasum -a 256 -c SHA256SUMS --ignore-missing`. A file that fails either is not installed.',
    '   - **Fabric Switchboard** (accounts for Claude Code and Codex, a project per folder): https://github.com/passioncode-ai/fabric-switchboard/releases/latest. Then run `switchboard onboard` and follow its guide; `switchboard --json onboard --status --folder <abs> --host claude|codex` answers each step (owner, accounts, project, mcp, proving_call) as done, todo, needs_person or optional, with the next command. A `needs_person` step (the sign-in to each account) is the person\'s, in their browser. An older Switchboard without `onboard`: set up one account and one project with its CLI.',
    '   - **Project Observatory** (watches every project, keeps credentials out of chats): follow `project-observatory full onboard` once it is installed.',
    '   - **Fabric** (the desktop app that runs agents on tasks): https://github.com/passioncode-ai/fabric/releases/latest.',
    '   - **Fabric Inbox** (mail your agents can read and answer): https://github.com/passioncode-ai/fabric-inbox/releases/latest. Its server setup and the Cloudflare sign-in are the person\'s gates; when its `onboard` guide exists (Inbox B-79), follow it.',
    '   A product the person declines is skipped without asking again.',
    '',
    `4. **The first agent**${done(o.state.firstAgent)}.`,
    '   Ask what it should do — or whether a project they already have should become one. Then use the `creating-fabric-agents` skill (new) or `adapting-projects-to-fabric` (existing), and its intake questions, one at a time.',
    '',
    '5. **Make it a service** with `building-fabric-services`, so it runs by itself and appears in Fabric Dashboards. Confirm with the MCP tool `list_services` that it is there and `ready`, and tell the person to look at the list.',
    '',
    '## When you are done',
    '',
    'Summarize what was set up and what the person declined. Remind them: every agent in Fabric Dashboards has a console that starts you with its context, and *Fix with agent* hands you a problem.',
    '',
  ].join('\n');
}

/** The Setup console's start: setup.md written, and the runtime told to begin with it. */
export function prepareSetup(o: { dir: string; runtimeId: string; runtimeName: string; server: McpCommand; state: SetupState; platform?: NodeJS.Platform }): { handoff: { before: string[]; after: string[] }; env: Record<string, string>; files: { setup: string; mcp: string } } {
  const packed = writePack(o.dir, { context: setupMarkdown({ ...o, platform: o.platform ?? process.platform }), task: null, mcp: mcpConfig(o.server) });
  const setup = path.join(o.dir, 'setup.md');
  fs.renameSync(packed.context, setup);
  const brief = 'You are setting up Fabric on this person\'s computer from Fabric Dashboards\' Setup console. '
    + `The steps, with this machine's commands, are in ${setup}; the fabric-dashboards MCP server is loaded in this session. `
    + 'Run every command yourself; ask the person only for consents, sign-ins and secrets (hidden prompt, never printed), one question at a time.';
  const prompt = `Read ${setup} and run the setup with me, step by step.`;
  const h = handoffArgs(o.runtimeId, { mcp: packed.mcp, mcpServer: o.server, brief: brief.slice(0, 1000), prompt });
  return { handoff: { before: h.before, after: h.after }, env: { ...h.env, FABRIC_DASHBOARDS_SETUP: setup }, files: { setup, mcp: packed.mcp } };
}

/** Where the Setup console runs: the person's home folder, unless they chose another. */
export const setupFolder = (home = os.homedir()) => home;
// #endregion agent-setup
