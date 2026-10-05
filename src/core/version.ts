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
