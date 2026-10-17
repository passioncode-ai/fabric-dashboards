// Launch at login (lifecycle LC-07 as amended 2026-10-16, LC-14): ON by default — the first packaged launch
// registers it once; from then on the person's choice (Settings, or System Settings → Login Items) is kept and
// never re-registered by a launch or an update. Every launch checks that macOS still allows it. Pure over a
// small OS port, so it is tested without Electron; src/electron/main.ts passes `app.getLoginItemSettings` / `set…`.
// #region login-item — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
import type { Settings } from './types';

/** macOS asks the person to approve the login item first (System Settings → General → Login Items). */
export const LOGIN_NEEDS_APPROVAL = 'requires-approval';

export interface LoginItemOs {
  get(): { openAtLogin: boolean; status?: string };
  set(openAtLogin: boolean): void;
}

/** What a launch did about the login item, and what the person must be told. */
export interface LoginItemStartup {
  /** The settings to store, or null. */
  patch: Partial<Settings> | null;
  /** The default registration ran (the first launch with no choice made). */
  registered?: boolean;
  /** macOS keeps it from opening at login until the person allows it (System Settings → Login Items). */
  needsApproval?: boolean;
  /** The registration failed for another reason, in macOS's words. */
  refused?: string;
}

/**
 * What a launch does about the login item (operator 2026-10-16: on by default, checked at every launch).
 * - No choice made yet: register it — once; it is then the stored choice. A failure is not stored as a
 *   choice, so the next launch tries again.
 * - A choice made: no registration call. If macOS disagrees — the person switched it in System Settings —
 *   the setting follows macOS. If macOS holds it for approval, the person is told.
 * `os` is null in a development run: nothing at all.
 */
export function loginItemAtStartup(settings: Settings, os: LoginItemOs | null): LoginItemStartup {
  if (!os) return { patch: null };
  if (!settings.launchAtLoginAsked) {
    const refused = applyLoginItem(true, os);
    if (refused && refused !== LOGIN_NEEDS_APPROVAL) return { patch: null, refused };
    return { patch: { launchAtLogin: true, launchAtLoginAsked: true }, registered: true, needsApproval: refused === LOGIN_NEEDS_APPROVAL };
  }
  let now: { openAtLogin: boolean; status?: string };
  try {
    now = os.get();
  } catch {
    return { patch: null }; // unreadable: keep the stored choice, register nothing
  }
  if (settings.launchAtLogin && now.status === LOGIN_NEEDS_APPROVAL) return { patch: null, needsApproval: true };
  return { patch: now.openAtLogin === settings.launchAtLogin ? null : { launchAtLogin: now.openAtLogin } };
}

/** Register or unregister because the person chose it. Returns why macOS refused, if it did. */
export function applyLoginItem(openAtLogin: boolean, os: LoginItemOs): string | undefined {
  try {
    os.set(openAtLogin);
    const now = os.get();
    if (openAtLogin && now.status === 'requires-approval') return LOGIN_NEEDS_APPROVAL; // the caller words it in the window's language
    if (openAtLogin && !now.openAtLogin && now.status !== 'enabled') return now.status ?? 'not registered';
  } catch (error) {
    return (error as Error).message;
  }
  return undefined;
}
// #endregion login-item
