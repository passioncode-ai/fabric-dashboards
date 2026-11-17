// ADR-0025 (FD-120): what the app answers its own MCP server on the console channel: a read, or a start through the
// buttons' own code path. Moved out of main.ts unchanged (FD-304); what it needs comes in as ChannelDeps.
import { shell, type BrowserWindow } from 'electron';
import { CHANNELS } from '../core/api';
import type { ChannelAnswer, ChannelRequest } from '../core/console-channel';
import { joinLink } from '../core/join';
import { consoleRowId } from '../core/sessions';
import { sessionListRow } from '../core/sessions-view';
import { agentSettingsPatch, type SettingsStore } from '../core/settings';
import type { Settings, SettingsPatch } from '../core/types';
import type { ConsoleHost } from './console';
import { startAnswer } from './console-channel';
import { moveSkip } from './policy';
import type { Updater } from './updater';

export interface ChannelDeps {
  consoles: ConsoleHost;
  settings: Pick<SettingsStore, 'get'>;
  updater: Updater;
  log: (message: string) => void;
  liveWindow: () => BrowserWindow | null;
  /** Set once the window's settings code is ready; null before. */
  applySettings: () => ((patch: SettingsPatch) => { settings: Settings; error?: string }) | null;
  restartToUpdate: () => Promise<void>;
  copyAt: () => Parameters<typeof moveSkip>[0];
  moveToApplications: (quiet?: boolean) => Promise<unknown>;
  uninstall: (decided: { deleteData: boolean }) => Promise<{ ok: boolean; error?: string }>;
}

// #region console-channel-answers — docs: docs/adr/0025-the-console-channel.md#decision
export function channelAnswers(d: ChannelDeps): (r: ChannelRequest) => Promise<ChannelAnswer> {
  const { consoles, settings, updater, log, liveWindow, restartToUpdate, copyAt, moveToApplications, uninstall } = d;
  return async (r: ChannelRequest): Promise<ChannelAnswer> => {
    if (r.op === 'console.list') return { ok: true, consoles: consoles.openConsoles() };
    if (r.op === 'sessions.list') {
      // FD-247 (step 8): the Sessions list as the window has it, every machine included.
      const s = consoles.sessionsStatus();
      return { ok: true, result: { sessions: s.rows.map(sessionListRow), machines: s.machines ?? [], switchboard: s.switchboard, degraded: s.degraded.map((d) => d.source) } };
    }
    // #region agent-doors — docs: docs/ux/scenarios.md#scn-098-an-agent-changes-what-a-person-changes-in-settings-and-on-the-sessions-page
    // FD-175: the window's own buttons for an agent, each through the code its button runs.
    if (r.op === 'settings.update') {
      const { patch, refused } = agentSettingsPatch(r.patch);
      const applySettingsFn = d.applySettings();
      if (!applySettingsFn) return { ok: false, code: 'not-ready' };
      const done = applySettingsFn(patch);
      // Scenario walk 2026-11-11 (SCN-098 step 1): the window changes at once, as if the person had clicked.
      liveWindow()?.webContents.send(CHANNELS.settingsPush, settings.get());
      return { ok: true, result: { changed: Object.keys(patch), refused, ...(done.error ? { error: done.error } : {}) } };
    }
    if (r.op === 'sessions.act' && r.session) {
      const { act, row, account } = r.session;
      if (act === 'clear-ended') { await consoles.clearEnded(); return { ok: true, result: { act } }; }
      const done = act === 'continue' ? await consoles.continueSession(row!, { cols: 100, rows: 30 }, account)
        : act === 'end' ? await consoles.endSession(row!) : act === 'attach' ? await consoles.attachSession(row!) : await consoles.dismissSession(row!);
      return done.ok ? { ok: true, result: { act, ...done } } : { ok: false, code: done.reason ?? 'refused', ...(done.detail ? { detail: String(done.detail).slice(0, 200) } : {}) };
    }
    if (r.op === 'app.update') {
      if (r.update === 'check') { await updater.check(true); return { ok: true, result: { state: updater.state.state, version: updater.state.version ?? null } }; }
      // Restart to update may ask the person first (running consoles): started, never awaited here.
      void restartToUpdate();
      return { ok: true, result: { state: updater.state.state, version: updater.state.version ?? null, restarting: updater.state.state === 'ready' } };
    }
    if (r.op === 'session.new' && r.start?.kind === 'terminal') {
      // FD-247 (SCN-111): Open terminal on {machine}, as the machine heading's button does.
      const done = await consoles.openMachineTerminal(r.start.machine!, { cols: 120, rows: 32 });
      return done.ok ? { ok: true, result: { consoleKey: done.key, machine: r.start.machine } } : { ok: false, code: done.reason, ...(done.detail ? { detail: String(done.detail).slice(0, 200) } : {}) };
    }
    if (r.op === 'session.new' && r.start) {
      // FD-191 (SCN-101, SCN-102): the New session and New agent dialogs' Start; a choice left out is the dialog's default.
      const o = await consoles.newSessionOptions();
      const runtime = r.start.runtime ?? o.runtime;
      if (!runtime) return { ok: false, code: 'no-runtime' };
      const done = await consoles.startNew({ kind: r.start.kind as Exclude<typeof r.start.kind, 'terminal'>, runtime, folder: r.start.folder ?? o.folder, bypass: r.start.bypass ?? o.bypass, isolated: r.start.isolated ?? false, ...(r.start.machine ? { machine: r.start.machine } : {}) }, { cols: 120, rows: 32 }, 'mcp');
      if (!done.ok) {
        if ('why' in done) return { ok: false, code: `admission_${done.why}` };
        return { ok: false, code: done.reason, ...(done.detail ? { detail: String(done.detail).slice(0, 200) } : {}) };
      }
      const snap = consoles.manager.snapshot(done.key);
      return { ok: true, result: { started: true, console: done.key, row: consoleRowId(done.key, snap.startedAt ?? Date.now()), kind: r.start.kind, runtime, folder: r.start.machine ? r.start.folder : snap.cwd, ...(r.start.machine ? { machine: r.start.machine } : {}) } };
    }
    if (r.op === 'console.choose' && r.choice) {
      const done = await consoles.chooseFor(r.service, r.choice);
      return done.ok ? { ok: true, result: { runtime: done.runtime, folder: done.folder, where: done.where } } : { ok: false, code: done.reason, detail: done.detail };
    }
    if (r.op === 'org.join') {
      // FD-248 (SCN-115): MCP `organization_join` with `open: true`, the same check as the button.
      const j = joinLink(r.link ?? null);
      if (!j.ok) return { ok: false, code: 'refused', detail: 'host' };
      await shell.openExternal(j.url);
      return { ok: true, result: { opened: j.url } };
    }
    if (r.op === 'app.install' && r.install) {
      if (r.install === 'move-to-applications') {
        const skip = moveSkip(copyAt());
        if (skip) return { ok: true, result: { moved: false, why: skip } };
        // A move that works quits and relaunches from Applications: the answer goes first.
        setTimeout(() => { void moveToApplications(true); }, 500);
        return { ok: true, result: { moving: true } };
      }
      const deleteData = r.install === 'uninstall-all';
      // The app quits once its helpers run: the answer goes first, and a refusal is in main.log.
      setTimeout(() => { void uninstall({ deleteData }).then((u) => { if (!u.ok) log(`uninstall asked by an agent stopped: ${u.error ?? 'cancelled'}`); }); }, 500);
      return { ok: true, result: { uninstalling: true, deleteData } };
    }
    // #endregion agent-doors
    // FD-249: an `ask` over the channel is an agent's words, read as a service's text would be (FD-234).
    const task = r.task ? { ...r.task, ...(r.task.kind === 'ask' ? { from: 'agent' as const } : {}) } : undefined;
    return consoles.start(r.service, r.mode === 'continue' ? 'continue' : 'new', { cols: 120, rows: 32 }, task).then((x) => {
      // FD-175 (FD-129's button): a fix for an agent whose session runs is typed into that session, not a second one.
      if (!x.ok && x.reason === 'running' && task) {
        const sent = consoles.sendTask(r.service, task);
        // FD-236 (4): a typed task that reads like instructions holds the conversation; the agent is told, as on a start.
        return sent.ok ? { ok: true, result: { typed: true, console: r.service, waitsForEnter: true, ...(sent.held ? { held: true, held_why: 'the task read like instructions, so its next Continue asks before each action; a person sends the typed line' } : {}) } } : { ok: false, code: sent.error ?? 'not-sent' };
      }
      return startAnswer(r.service, x);
    });
  };
}
// #endregion console-channel-answers
