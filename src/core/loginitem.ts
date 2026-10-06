// Launch at login (lifecycle LC-07, LC-14): asked once, registered only by the person's choice,
// never re-registered by a launch or an update. Pure over a small OS port, so it is tested
// without Electron; src/electron/main.ts passes `app.getLoginItemSettings` / `setLoginItemSettings`.
// #region login-item — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
import type { Settings } from './types';

/** macOS asks the person to approve the login item first (System Settings → General → Login Items). */
export const LOGIN_NEEDS_APPROVAL = 'requires-approval';

export interface LoginItemOs {
  get(): { openAtLogin: boolean; status?: string };
  set(openAtLogin: boolean): void;
}

/**
 * What a launch does about the login item: never a registration call. Before the person has
 * chosen, nothing at all. After, if macOS disagrees with the stored choice — the person switched it
 * in System Settings → General → Login Items — the setting follows macOS: the operator's latest
 * intent wins over what the app remembers. `os` is null in a development run.
 */
export function loginItemAtStartup(settings: Settings, os: LoginItemOs | null): Partial<Settings> | null {
  if (!os || !settings.launchAtLoginAsked) return null;
  let now: boolean;
  try {
    now = os.get().openAtLogin;
  } catch {
    return null; // unreadable: keep the stored choice, register nothing
  }
  return now === settings.launchAtLogin ? null : { launchAtLogin: now };
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
