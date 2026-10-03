import path from 'node:path';
import { atomicWrite, readJson } from './fsutil';
import { DEFAULT_SETTINGS, type Settings } from './types';

export class SettingsStore {
  private readonly file: string;
  private value: Settings;

  constructor(dir: string) {
    this.file = path.join(dir, 'settings.json');
    this.value = merge(readJson<Partial<Settings>>(this.file, {}));
  }

  get(): Settings {
    return structuredClone(this.value);
  }

  update(patch: Partial<Settings>): Settings {
    this.value = merge({ ...this.value, ...patch, notifications: { ...this.value.notifications, ...(patch.notifications ?? {}) } });
    atomicWrite(this.file, JSON.stringify(this.value, null, 2));
    return this.get();
  }
}

export function merge(raw: Partial<Settings>): Settings {
  const n = raw.notifications ?? DEFAULT_SETTINGS.notifications;
  return {
    launchAtLogin: typeof raw.launchAtLogin === 'boolean' ? raw.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    // A file written by an earlier version never asked: its `launchAtLogin` was the old default, not a choice.
    launchAtLoginAsked: raw.launchAtLoginAsked === true,
    theme: raw.theme === 'light' ? 'light' : 'dark',
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
