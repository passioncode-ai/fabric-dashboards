// e2e preflight (FD-35): a locked macOS screen sends windows no show/hide events, so an e2e run
// there measures the lock, not the app — FD-05's Dock assertion fails on every run (2026-10-06,
// 2026-10-08). Refuse up front with the reason instead of reporting a failed test.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Whether ioreg's console-session record says the screen is locked (the key exists only while locked). */
export function screenLocked(ioregText) {
  return /"CGSSessionScreenIsLocked"\s*=\s*Yes/.test(ioregText);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.platform !== 'darwin') process.exit(0);
  let text = '';
  try {
    text = execFileSync('/usr/sbin/ioreg', ['-n', 'Root', '-d1'], { encoding: 'utf8', timeout: 10_000 });
  } catch (error) {
    console.error(`e2e preflight: could not read the session state (${error.message}); running anyway`);
    process.exit(0);
  }
  if (screenLocked(text)) {
    console.error('e2e preflight: the screen is locked — macOS sends windows no show/hide events, so the e2e run would measure the lock. Unlock the screen and run again.');
    process.exit(1);
  }
}
