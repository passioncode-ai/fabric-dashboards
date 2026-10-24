// #region e2e-machine-preflight — docs: CONTRIBUTING.md#end-to-end-tests
// e2e preflight (HV-02): every e2e file starts its own Electron, and on a loaded Mac the run measured the machine, not
// the app (0.7.28: the suite stopped with 130 MB of disk free and swap full). Refuse at once, as check-screen.mjs
// refuses a locked screen, when the 1-minute load average is above a floor or free disk is under a floor. Both floors
// are overridable: FD_E2E_MAX_LOAD (default 150), FD_E2E_MIN_FREE_GB (default 5).
import { statfsSync } from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

export const DEFAULT_MAX_LOAD = 150;
export const DEFAULT_MIN_FREE_GB = 5;
const GB = 1024 ** 3;

/** The floors from the environment; a value that is not a non-negative number is an error, never a silent default. */
export function machineLimits(env) {
  const read = (name, fallback) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number, not ${JSON.stringify(raw)}`);
    return n;
  };
  return { maxLoad: read('FD_E2E_MAX_LOAD', DEFAULT_MAX_LOAD), minFreeGb: read('FD_E2E_MIN_FREE_GB', DEFAULT_MIN_FREE_GB) };
}

/** Why the machine cannot run the e2e suite now, or null. `load1` is the 1-minute load average, `freeBytes` the
 *  smallest free space of the disks the run writes to. */
export function machineRefusal({ load1, freeBytes, maxLoad, minFreeGb }) {
  if (Number.isFinite(load1) && load1 > maxLoad) {
    return `e2e preflight: the 1-minute load average is ${load1.toFixed(1)}, above ${maxLoad}; each test file starts its own Electron, so the run would measure the machine, not the app. Wait for the load to fall, or set FD_E2E_MAX_LOAD to run anyway.`;
  }
  if (Number.isFinite(freeBytes) && freeBytes < minFreeGb * GB) {
    return `e2e preflight: ${(freeBytes / GB).toFixed(1)} GB of disk is free, under ${minFreeGb} GB; the build and each test's app data need room. Free some disk, or set FD_E2E_MIN_FREE_GB to run anyway.`;
  }
  return null;
}

/** Free bytes on the volume holding `dir`, or NaN when it cannot be read. */
function freeBytesAt(dir) {
  try {
    const s = statfsSync(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return Number.NaN;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let limits;
  try {
    limits = machineLimits(process.env);
  } catch (error) {
    console.error(`e2e preflight: ${error.message}`);
    process.exit(1);
  }
  const free = [process.cwd(), os.tmpdir()].map(freeBytesAt).filter(Number.isFinite);
  const why = machineRefusal({ load1: os.loadavg()[0], freeBytes: free.length ? Math.min(...free) : Number.NaN, ...limits });
  if (why) {
    console.error(why);
    process.exit(1);
  }
}
// #endregion e2e-machine-preflight
