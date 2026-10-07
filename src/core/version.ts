// Release versions compared the way the update feed needs (ADR-0015, audit F-1): an installed copy
// moves only forward. Squirrel installs whatever the latest feed names, older or not, so the app
// reads the feed's version first and asks Squirrel only when it is newer.

/** x.y.z with an optional -pre suffix; null for anything else. */
function parts(v: string): { nums: [number, number, number]; pre: string | null } | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
  return m ? { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null } : null;
}

/** Whether `candidate` is a newer release than `current`. Unreadable versions are never newer. */
export function isNewer(candidate: string, current: string): boolean {
  const a = parts(candidate);
  const b = parts(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) if (a.nums[i] !== b.nums[i]) return a.nums[i]! > b.nums[i]!;
  if (a.pre === b.pre) return false;
  if (a.pre === null) return true; // 1.0.0 is newer than 1.0.0-rc.1
  if (b.pre === null) return false;
  return a.pre.localeCompare(b.pre, 'en', { numeric: true }) > 0;
}

// #region update-verify — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
/** LC-16: the Developer ID team every release of the organization is signed by. */
export const RELEASE_TEAM = 'KJ35UYYL22';
/** LC-16: first automatic check after start, then the interval. */
export const FIRST_CHECK_MS = 90_000;
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

/** Whether an automatic check may run now: the person's switch (LC-16 opt-out); a manual one always may.
 *  A held release (verified, waiting for the person's step) is not downloaded again by the timer;
 *  the person's own check looks for a newer one. */
export function mayCheck(o: { manual: boolean; enabled: boolean; state: string }): boolean {
  if (['unsupported', 'misplaced', 'downloading', 'ready', 'checking'].includes(o.state)) return false;
  if (o.state === 'held' && !o.manual) return false;
  return o.manual || o.enabled;
}

/** The staged bundle Squirrel.Mac will install at quit, from its ShipItState.plist (as JSON). */
export function stagedBundlePath(state: unknown): string | null {
  const raw = (state as { updateBundleURL?: unknown } | null)?.updateBundleURL;
  if (typeof raw !== 'string') return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'file:' ? decodeURIComponent(u.pathname).replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

/** LC-16: why a downloaded update must not install, or null when it may: the bundle's version is the
 *  one the feed announced and newer than this copy, and it is signed by the organization's team. */
export function stagedRefusal(o: { feedVersion: string | null; stagedVersion: string | null; team: string | null; current: string }): string | null {
  if (!o.stagedVersion) return 'the downloaded update carries no version';
  if (o.feedVersion && o.stagedVersion !== o.feedVersion) return `the feed announced ${o.feedVersion} but the download is ${o.stagedVersion}`;
  if (!isNewer(o.stagedVersion, o.current)) return `the download is ${o.stagedVersion}, not newer than ${o.current}`;
  if (o.team !== RELEASE_TEAM) return `the download is signed by ${o.team ?? 'no team'}, not ${RELEASE_TEAM}`;
  return null;
}

/** FD-31: a fresh launch while Squirrel's ShipIt is installing a newer build must step aside — opening
 *  the old bundle mid-install aborted the 0.5.6 → 0.6.2 install twice (2026-10-07). A second copy of a
 *  running app never gets here (single-instance lock), so ShipIt alive with a newer staged build at a
 *  launch means an install is under way or starts as soon as no copy runs. */
export function stepAsideForInstall(o: { stagedVersion: string | null; running: string; shipItRunning: boolean }): boolean {
  return o.shipItRunning && !!o.stagedVersion && isNewer(o.stagedVersion, o.running);
}

/** Whether `launchctl list <label>` describes a running job (it prints `"PID" = n;` only then). */
export function launchdJobRunning(listOutput: string): boolean {
  return /"PID"\s*=\s*\d+/.test(listOutput);
}
// #endregion update-verify
