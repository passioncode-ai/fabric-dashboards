// LC-14 (ADR-0015): Settings → Uninstall, and MCP `app_install`. Moved out of main.ts unchanged (FD-304); what it
// needs from the main process comes in as UninstallDeps.
import { app, dialog, shell, type BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { windowsPowerShellEnv } from '@passioncode-ai/fabric-service-host';
import { powerShellAfterExit } from '../core/after-exit';
import { t, type Lang } from '../core/i18n';
import { applyLoginItem, type LoginItemOs } from '../core/loginitem';
import { uninstallCommand, uninstallTarget } from '../core/platform';
import type { SettingsStore } from '../core/settings';
import { ALWAYS_KEPT, cancelStagedUpdate, KEPT_FILES, productDataPaths, purgeAfterExit, removeMcpRegistrations, restoreMcpRegistrations, writeRestoreRecord } from '../core/uninstall';

export interface UninstallDeps {
  lang: () => Lang;
  liveWindow: () => BrowserWindow | null;
  loginOs: LoginItemOs | null;
  settings: Pick<SettingsStore, 'get'>;
  log: (message: string) => void;
  launcher: () => string;
  userData: string;
  /** S2-01: a second profile (FABRIC_DASHBOARDS_USER_DATA) removes only its own folders, never the default profile's. */
  secondProfile: boolean;
}

// #region uninstall-flow — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
/** LC-14: undo what installing and running added. Registrations go first and stop the flow on
 *  failure, so a half-uninstalled app never deletes its data and leaves an entry behind. */
/** `decided`: FD-175, the operator's words relayed by an agent stand for the confirmation and its box. */
export async function uninstall(o: UninstallDeps, decided?: { deleteData: boolean }): Promise<{ ok: boolean; cancelled?: boolean; error?: string }> {
  const { lang, liveWindow, loginOs, settings, log, launcher, userData } = o;
  const l = lang();
  const parent = liveWindow() ?? undefined;
  // LC-14: data goes only when the person asks. The box is unticked: settings and history stay,
  // and a reinstall picks them up together with the login item and the MCP entry (ADR-0015).
  const ask = {
    type: 'warning' as const, buttons: [t(l, 'uninstall.confirm'), t(l, 'action.cancel')], defaultId: 1, cancelId: 1,
    message: t(l, 'uninstall.title'), detail: t(l, 'settings.uninstall.body'), checkboxLabel: t(l, 'uninstall.deleteData'), checkboxChecked: false,
  };
  const { response, checkboxChecked: deleteData } = decided ? { response: 0, checkboxChecked: decided.deleteData }
    : parent ? await dialog.showMessageBox(parent, ask) : await dialog.showMessageBox(ask);
  if (response !== 0) return { ok: false, cancelled: true };
  const wasAtLogin = Boolean(loginOs && settings.get().launchAtLogin);
  let mcp: ReturnType<typeof removeMcpRegistrations>['entries'] = [];
  try {
    // R-11: the MCP entry first — it is the step that can fail on a busy ~/.claude.json, and a
    // failure then leaves nothing half-removed. The login item second; a refusal puts the MCP entries back.
    if (app.isPackaged) {
      const r = removeMcpRegistrations();
      mcp = r.entries;
      log(`uninstall: MCP registration removed from ${JSON.stringify(r.removed)}`);
    }
    if (loginOs) {
      const refused = applyLoginItem(false, loginOs);
      if (refused) {
        try {
          restoreMcpRegistrations(mcp, launcher());
        } catch (e) {
          // T-15: the MCP entry is gone and could not be put back — say so, never "Nothing was removed".
          log(`uninstall: MCP registration not put back: ${(e as Error).message}`);
          return { ok: false, error: t(l, 'uninstall.partial', { error: refused }) };
        }
        throw new Error(refused);
      }
    }
  } catch (error) {
    log(`uninstall stopped: ${(error as Error).message}`);
    return { ok: false, error: t(l, 'uninstall.failed', { error: (error as Error).message }) };
  }
  // Data goes after this process exits — Chromium writes into userData until then (purgeAfterExit).
  // A development run shares the installed app's profile name, so it purges nothing.
  // Windows helpers start through a launcher that must have finished before this app quits (src/core/after-exit.ts).
  const helpers: Promise<void>[] = [];
  const awaitHelper = (h: ReturnType<typeof purgeAfterExit>) => { if (h instanceof Promise) helpers.push(h.catch((error: Error) => log(`uninstall: a helper could not start: ${error.message}`))); };
  if (app.isPackaged) {
    const all = [...new Set([...(o.secondProfile ? [] : productDataPaths(app.getPath('home'))), userData, app.getPath('logs')])];
    if (deleteData) {
      // LC-16: even «delete my settings» leaves the automatic-update switch as the person set it.
      awaitHelper(purgeAfterExit(process.pid, all.filter((p) => path.resolve(p) !== path.resolve(userData)), { dir: userData, names: ALWAYS_KEPT }));
    } else {
      try {
        writeRestoreRecord(userData, { at: new Date().toISOString(), loginItem: wasAtLogin, mcp });
      } catch (error) {
        log(`uninstall: could not write the restore record: ${(error as Error).message}`);
      }
      awaitHelper(purgeAfterExit(process.pid, all.filter((p) => path.resolve(p) !== path.resolve(userData)), { dir: userData, names: KEPT_FILES }));
    }
    // R-20 (FD-21): a downloaded update would be installed by ShipIt as this app quits, putting the
    // trashed bundle back — its record goes first.
    if (process.platform === 'darwin') {
      const cancelled = cancelStagedUpdate(app.getPath('home'));
      if (cancelled.length) log(`uninstall: the staged update was removed (${cancelled.length} item(s)) so it cannot reinstall the app`);
    }
    // FD-37: only what this install is — never a parent folder (uninstallTarget, ADR-0019).
    const target = uninstallTarget(process.platform, process.execPath, process.env, (p) => fs.existsSync(p));
    log(`uninstall: ${target.kind}${'path' in target ? ` ${target.path}` : ''}`);
    try {
      if (target.kind === 'trash-bundle' || target.kind === 'trash-file') await shell.trashItem(target.path);
      else if (target.kind === 'run-uninstaller') {
        // After this app exits (uninstallCommand); a failure to start it is said, never thrown.
        const cmd = uninstallCommand(target, process.pid);
        // A grandchild outside this app's job, or Windows kills the waiter when the app exits (src/core/after-exit.ts).
        helpers.push(powerShellAfterExit(cmd.args[3]!, windowsPowerShellEnv()).catch((error: Error) => log(`uninstall: the uninstaller could not start: ${error.message}`)));
      } else await dialog.showMessageBox({ type: 'info', message: t(l, 'uninstall.manual', { how: target.kind === 'package' ? target.command : t(l, target.reason) }), buttons: ['OK'] });
    } catch (error) {
      await dialog.showMessageBox({ type: 'info', message: t(l, 'uninstall.trashFailed', { error: (error as Error).message }), buttons: ['OK'] });
    }
  }
  log(`uninstall: login item and registration removed; ${deleteData ? 'all data' : 'everything but settings and history'} is removed after exit`);
  await Promise.all(helpers); // every helper runs outside this app before it quits (bounded: cmd.exe returns at once)
  setImmediate(() => app.quit()); // before-quit sets quitting, so the window lets itself close
  return { ok: true };
}
// #endregion uninstall-flow
