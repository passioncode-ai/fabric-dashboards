// #region pending-install — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#lc-16
// FD-31: never open the old bundle while ShipIt replaces it. A launch that finds ShipIt running with a
// newer staged build tells the person, quits before doing anything else, and leaves a bounded helper
// that opens the app again once ShipIt has finished (at most 10 minutes) — the new version, or the old
// one if the install failed, which then runs normally because ShipIt is gone.
import { app, Notification } from 'electron';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { t, type Lang } from '../core/i18n';
import { launchdJobRunning, stagedBundlePath, stepAsideForInstall } from '../core/version';

const BUNDLE_ID = 'ai.passioncode.fabric-dashboards';
export const SHIPIT_LABEL = `${BUNDLE_ID}.ShipIt`;
const HELPER_WAIT_S = 600;

function read(file: string, args: string[]): string {
  const r = spawnSync(file, args, { encoding: 'utf8', timeout: 5000 });
  return r.status === 0 ? String(r.stdout ?? '') : '';
}

/** The staged version this launch must wait for, or null to start normally. */
export function pendingInstallVersion(): string | null {
  if (!app.isPackaged || process.platform !== 'darwin') return null;
  const stateFile = path.join(os.homedir(), 'Library/Caches', SHIPIT_LABEL, 'ShipItState.plist');
  if (!fs.existsSync(stateFile)) return null;
  let bundle: string | null = null;
  try { bundle = stagedBundlePath(JSON.parse(read('/usr/bin/plutil', ['-convert', 'json', '-o', '-', stateFile]))); } catch { return null; }
  if (!bundle) return null;
  const staged = read('/usr/bin/plutil', ['-extract', 'CFBundleShortVersionString', 'raw', '-o', '-', path.join(bundle, 'Contents/Info.plist')]).trim() || null;
  const shipItRunning = launchdJobRunning(read('/bin/launchctl', ['list', SHIPIT_LABEL]));
  return stepAsideForInstall({ stagedVersion: staged, running: app.getVersion(), shipItRunning }) ? staged : null;
}

/** Tell the person, leave the reopen helper, and quit now. */
export function stepAside(version: string, lang: Lang, log: (line: string) => void): void {
  log(`update_install resumed version=${version} from=${app.getVersion()} (ShipIt is installing; this launch steps aside)`);
  try {
    new Notification({ title: t(lang, 'update.finishing.title', { version }), body: t(lang, 'update.finishing.body'), silent: true }).show();
  } catch { /* no notification centre: the log says it */ }
  const script = `i=0; while launchctl list ${SHIPIT_LABEL} 2>/dev/null | grep -q '"PID"' && [ $i -lt ${HELPER_WAIT_S} ]; do sleep 1; i=$((i+1)); done; sleep 2; exec /usr/bin/open -b ${BUNDLE_ID}`;
  try {
    spawn('/bin/sh', ['-c', script], { detached: true, stdio: 'ignore' }).unref();
  } catch (error) {
    log(`update: could not leave the reopen helper: ${(error as Error).message}`);
  }
  setTimeout(() => app.exit(0), 1500);
}
// #endregion pending-install
