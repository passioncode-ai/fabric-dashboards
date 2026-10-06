// LC-16 "in detail": the automatic-update switch is one file, `auto-update`, in the app's own data
// folder — absent means on, only the word `off` turns it off. It is the same in every product of the
// organization. An update, a reinstall or an uninstall never writes it (not even when the person
// asks the uninstall to delete their data); only the person's switch in Settings does.
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite } from './fsutil';

export const AUTO_UPDATE_FILE = 'auto-update';

/** Whether automatic updates are on: absent, unreadable or anything but `off` is on. */
export function autoUpdateOn(dir: string): boolean {
  try {
    return fs.readFileSync(path.join(dir, AUTO_UPDATE_FILE), 'utf8').trim().toLowerCase() !== 'off';
  } catch {
    return true;
  }
}

/** The person's switch: writes `on` or `off`. */
export function setAutoUpdate(dir: string, on: boolean): void {
  atomicWrite(path.join(dir, AUTO_UPDATE_FILE), on ? 'on\n' : 'off\n');
}

/** A choice made before the file existed (settings.json `autoUpdate: false`) is carried over once. */
export function carryOverAutoUpdate(dir: string, legacyOff: boolean): boolean {
  if (!legacyOff || fs.existsSync(path.join(dir, AUTO_UPDATE_FILE))) return false;
  setAutoUpdate(dir, false);
  return true;
}
