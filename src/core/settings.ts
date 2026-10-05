// The person's settings (SCN-024). Written atomically, with the last good copy beside it: a file
// that cannot be read — a partial copy from another machine, an editor, a full disk at the wrong
// moment — is restored from that copy instead of silently becoming the defaults (ADR-0015).
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite } from './fsutil';
import { DEFAULT_SETTINGS, type Settings } from './types';

export class SettingsStore {
  private readonly file: string;
  private readonly backup: string;
  private value: Settings;
  /** What reading found, for the log: null when settings.json was read as it is. */
  readonly recovered: string | null = null;

  /** R-2: settings never throw on a full disk — the value is kept in memory and saved by the next write that succeeds. */
  constructor(dir: string, private readonly onWriteError: (message: string) => void = () => undefined) {
    this.file = path.join(dir, 'settings.json');
    this.backup = `${this.file}.bak`;
    const main = readObject(this.file);
    if (main.ok) {
      this.value = merge(main.value);
    } else {
      const bak = readObject(this.backup);
      this.value = merge(bak.ok ? bak.value : {});
      if (main.reason !== 'absent') {
        this.recovered = bak.ok ? `settings.json ${main.reason}; restored from settings.json.bak` : `settings.json ${main.reason} and no readable copy; defaults in use`;
        // Keep the unreadable file for a person to look at, and write back what is in use now.
        try { fs.renameSync(this.file, `${this.file}.unreadable-${Date.now()}`); } catch { /* gone meanwhile */ }
        this.persist();
      } else if (bak.ok) {
        this.recovered = 'settings.json was missing; restored from settings.json.bak';
        this.persist();
      }
    }
  }

  get(): Settings {
    return structuredClone(this.value);
  }

  update(patch: Partial<Settings>): Settings {
    this.value = merge({ ...this.value, ...patch, notifications: { ...this.value.notifications, ...(patch.notifications ?? {}) } });
    this.persist();
    return this.get();
  }

  /** settings.json first, then its copy: a failure between the two leaves the older good copy. */
  private persist(): void {
    const text = JSON.stringify(this.value, null, 2);
    try {
      atomicWrite(this.file, text);
      atomicWrite(this.backup, text);
    } catch (error) {
      this.onWriteError(`settings: not saved, kept in memory: ${(error as Error).message}`);
    }
  }
}

function readObject(file: string): { ok: true; value: Partial<Settings> } | { ok: false; reason: string } {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    return { ok: false, reason: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'absent' : 'could not be read' };
  }
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? { ok: true, value } : { ok: false, reason: 'is not a settings object' };
  } catch {
    return { ok: false, reason: 'is not valid JSON' };
  }
}

export function merge(raw: Partial<Settings>): Settings {
  const n = raw.notifications ?? DEFAULT_SETTINGS.notifications;
  return {
    launchAtLogin: typeof raw.launchAtLogin === 'boolean' ? raw.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    // A file written by an earlier version never asked: its `launchAtLogin` was the old default, not a choice.
    launchAtLoginAsked: raw.launchAtLoginAsked === true,
    theme: raw.theme === 'light' ? 'light' : 'dark',
    // Absent in a file from an earlier version: on, so every install keeps itself current.
    autoUpdate: raw.autoUpdate !== false,
    moveToApplicationsAsked: raw.moveToApplicationsAsked === true,
    notifications: {
      enabled: typeof n.enabled === 'boolean' ? n.enabled : true,
      perService: typeof n.perService === 'object' && n.perService ? n.perService : {},
      quietHours: {
        enabled: Boolean(n.quietHours?.enabled),
        from: /^\d{1,2}:\d{2}$/.test(n.quietHours?.from ?? '') ? n.quietHours!.from : '22:00',
        to: /^\d{1,2}:\d{2}$/.test(n.quietHours?.to ?? '') ? n.quietHours!.to : '08:00',
      },
      pausedUntil: typeof n.pausedUntil === 'string' ? n.pausedUntil : null,
    },
  };
}
