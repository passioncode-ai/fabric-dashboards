// The person's settings (SCN-024). Written atomically, with the last good copy beside it: a file
// that cannot be read — a partial copy from another machine, an editor, a full disk at the wrong
// moment — is restored from that copy instead of silently becoming the defaults (ADR-0015).
import { isAbsoluteFolder } from './platform';
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite } from './fsutil';
import { autoUpdateOn, carryOverAutoUpdate, setAutoUpdate } from './autoupdate';
import { CONSOLE_HEIGHT, DEFAULT_SETTINGS, type Settings, type SettingsPatch } from './types';
import { DEFAULT_PAGE_THEME, REFERENCE_THEMES } from './appearance';
import { pruneDismissed, pruneRecords } from './sessions';

export class SettingsStore {
  private readonly file: string;
  private readonly backup: string;
  private readonly dir: string;
  private value: Settings;
  /** What reading found, for the log: null when settings.json was read as it is. */
  readonly recovered: string | null = null;

  /** R-2: settings never throw on a full disk — the value is kept in memory and saved by the next write that succeeds. */
  constructor(dir: string, private readonly onWriteError: (message: string) => void = () => undefined) {
    this.dir = dir;
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
    // LC-16: the switch lives in its own file; an earlier `autoUpdate: false` is carried over once.
    try { carryOverAutoUpdate(dir, main.ok && (main.value as { autoUpdate?: unknown }).autoUpdate === false); } catch (error) { this.onWriteError((error as Error).message); }
  }

  get(): Settings {
    return { ...structuredClone(this.value), autoUpdate: autoUpdateOn(this.dir) };
  }

  update(patch: SettingsPatch): Settings {
    // LC-16: the person's switch writes the `auto-update` file, never settings.json.
    if (typeof patch.autoUpdate === 'boolean') {
      try { setAutoUpdate(this.dir, patch.autoUpdate); } catch (error) { this.onWriteError((error as Error).message); }
    }
    const layout = patch.layout ?? {};
    this.value = merge({
      ...this.value, ...(patch as Partial<Settings>),
      notifications: { ...this.value.notifications, ...(patch.notifications ?? {}) },
      // ADR-0018: one estate field changes alone; a partial patch never resets the others.
      estate: { ...this.value.estate, ...(patch.estate ?? {}) },
      // ADR-0017: one field of the layout, or one service's console, changes alone.
      layout: { ...this.value.layout, ...layout, console: { ...this.value.layout.console, ...(layout.console ?? {}) }, list: mergeList({ ...this.value.layout.list, ...(layout.list ?? {}) }) },
      consoles: { ...this.value.consoles, ...(patch.consoles ?? {}) },
    });
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

const SERVICE_KEY = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*$/;

/** ADR-0017: a layout from any earlier or damaged file reads as a usable one. */
function mergeLayout(raw: unknown): Settings['layout'] {
  const l = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings['layout']>;
  const c = (l.console && typeof l.console === 'object' ? l.console : {}) as Partial<Settings['layout']['console']>;
  const height = typeof c.height === 'number' && Number.isFinite(c.height) ? Math.round(c.height) : CONSOLE_HEIGHT.default;
  return {
    sidebar: l.sidebar === 'collapsed' ? 'collapsed' : 'expanded',
    header: l.header === 'full' ? 'full' : 'compact',
    console: { open: c.open === true, height: Math.min(CONSOLE_HEIGHT.max, Math.max(CONSOLE_HEIGHT.min, height)) },
    list: mergeList(l.list),
    // FD-103 (SCN-077): a damaged value reads as Agents on Overview; nothing else depends on it.
    mode: l.mode === 'sessions' ? 'sessions' : 'agents',
    sessionId: typeof l.sessionId === 'string' && l.sessionId.length > 0 && l.sessionId.length <= 400 ? l.sessionId : null,
    endedOpen: l.endedOpen === true,
  };
}

const PRODUCT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const productIds = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === 'string' && PRODUCT_ID.test(v)))].slice(0, 200) : []);

/** FD-39: a sort the app knows, and pinned product ids — each a valid id, once, at most 200. FD-78: hidden product ids
 *  the same way, a kind per product (`agent` or `service`; anything else is dropped), and whether Hidden is open. */
function mergeList(raw: unknown): Settings['layout']['list'] {
  const l = (raw && typeof raw === 'object' ? raw : {}) as { sort?: unknown; pinned?: unknown; hidden?: unknown; kinds?: unknown; hiddenOpen?: unknown };
  const sort = l.sort === 'status' || l.sort === 'activity' ? l.sort : 'name';
  const kinds: Settings['layout']['list']['kinds'] = {};
  if (l.kinds && typeof l.kinds === 'object' && !Array.isArray(l.kinds)) {
    for (const [id, kind] of Object.entries(l.kinds as Record<string, unknown>).slice(0, 200)) if (PRODUCT_ID.test(id) && (kind === 'agent' || kind === 'service')) kinds[id] = kind;
  }
  return { sort, pinned: productIds(l.pinned), hidden: productIds(l.hidden), kinds, hiddenOpen: l.hiddenOpen === true };
}

/** ADR-0017: per-service console choices; a key that is not a service key, or a folder that is not absolute, is dropped. */
function mergeConsoles(raw: unknown): Settings['consoles'] {
  const out: Settings['consoles'] = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!SERVICE_KEY.test(key) || !value || typeof value !== 'object') continue;
    const v = value as { runtime?: unknown; folder?: unknown; idle?: unknown };
    const idle = v.idle as { at?: unknown; account?: unknown } | null | undefined;
    out[key] = {
      runtime: typeof v.runtime === 'string' && /^[a-z0-9][a-z0-9-]{0,40}$/.test(v.runtime) ? v.runtime : null,
      folder: typeof v.folder === 'string' && isAbsoluteFolder(v.folder, process.platform) ? v.folder : null,
      ...(idle && typeof idle === 'object' && typeof idle.at === 'string' && Number.isFinite(Date.parse(idle.at))
        ? { idle: { at: idle.at, account: typeof idle.account === 'string' ? idle.account.slice(0, 120) : null } } : {}),
    };
  }
  return out;
}

/** ADR-0018: the estate watcher; the clone path is absolute, `~/…` (resolved against the home folder
 *  when used — the field's own placeholder is written that way), or empty. A relative one would
 *  resolve against the app's own working directory, which is never what the person meant. */
// #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
function mergeEstate(raw: unknown): Settings['estate'] {
  const e = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings['estate']>;
  const clone = typeof e.contractClone === 'string' ? e.contractClone.trim() : '';
  return {
    enabled: typeof e.enabled === 'boolean' ? e.enabled : DEFAULT_SETTINGS.estate.enabled,
    autoSkills: typeof e.autoSkills === 'boolean' ? e.autoSkills : DEFAULT_SETTINGS.estate.autoSkills,
    contractClone: isAbsoluteFolder(clone, process.platform) || clone.startsWith('~/') || (process.platform === 'win32' && clone.startsWith('~\\')) ? clone : '',
  };
}
// #endregion estate-update

/** FD-103: the Sessions list's memory; an entry older than 24 hours, or malformed, is dropped on every read and write,
 *  so a restart keeps the rest and nothing stays for ever. At most 500 of each. */
function mergeSessionMemory(raw: unknown): Settings['sessions'] {
  const s = (raw && typeof raw === 'object' ? raw : {}) as { records?: unknown; dismissed?: unknown };
  const now = Date.now();
  return {
    records: pruneRecords(Array.isArray(s.records) ? s.records : [], now).slice(-500),
    dismissed: pruneDismissed(Array.isArray(s.dismissed) ? s.dismissed : [], now).slice(-500),
  };
}

/** Review R-4, R1-S1: what the window's generic settings change may write. A console's runtime and folder are set only
 *  through the console's own calls (a folder only from the folder dialog), and the Sessions list's memory only by the
 *  main process: a session record names a folder Continue starts a coding agent in. */
export function rendererSettingsPatch(raw: unknown): SettingsPatch {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const { consoles: _consoles, sessions: _sessions, ...patch } = raw as SettingsPatch & Record<string, unknown>;
  return patch as SettingsPatch;
}

export function merge(raw: Partial<Settings>): Settings {
  const n = raw.notifications ?? DEFAULT_SETTINGS.notifications;
  return {
    launchAtLogin: typeof raw.launchAtLogin === 'boolean' ? raw.launchAtLogin : DEFAULT_SETTINGS.launchAtLogin,
    // A file written by an earlier version never asked: its `launchAtLogin` was the old default, not a choice.
    launchAtLoginAsked: raw.launchAtLoginAsked === true,
    theme: raw.theme === 'light' || raw.theme === 'system' ? raw.theme : 'dark',
    pageTheme: typeof raw.pageTheme === 'string' && (REFERENCE_THEMES as readonly string[]).includes(raw.pageTheme) ? raw.pageTheme : DEFAULT_PAGE_THEME,
    language: raw.language === 'en' || raw.language === 'ru' ? raw.language : 'system',
    // Absent in a file from an earlier version: on, so every install keeps itself current.
    autoUpdate: raw.autoUpdate !== false,
    moveToApplicationsAsked: raw.moveToApplicationsAsked === true,
    setupDone: raw.setupDone === true,
    lastVisitAt: typeof raw.lastVisitAt === 'string' && !Number.isNaN(Date.parse(raw.lastVisitAt)) ? raw.lastVisitAt : null,
    knownServices: Array.isArray(raw.knownServices) ? [...new Set(raw.knownServices.filter((k): k is string => typeof k === 'string' && SERVICE_KEY.test(k)))].slice(0, 500) : [],
    lastService: typeof raw.lastService === 'string' && SERVICE_KEY.test(raw.lastService) ? raw.lastService : null,
    notifications: {
      enabled: typeof n.enabled === 'boolean' ? n.enabled : true,
      perService: typeof n.perService === 'object' && n.perService ? n.perService : {},
      quietHours: {
        enabled: Boolean(n.quietHours?.enabled),
        from: /^\d{1,2}:\d{2}$/.test(n.quietHours?.from ?? '') ? n.quietHours!.from : '22:00',
        to: /^\d{1,2}:\d{2}$/.test(n.quietHours?.to ?? '') ? n.quietHours!.to : '08:00',
      },
      pausedUntil: typeof n.pausedUntil === 'string' ? n.pausedUntil : null,
      channel: n.channel === 'off' || (typeof n.channel === 'string' && SERVICE_KEY.test(n.channel)) ? n.channel : 'auto',
    },
    layout: mergeLayout(raw.layout),
    consoles: mergeConsoles(raw.consoles),
    // FD-83: absent in a file from an earlier version: on, as the operator asked (2026-10-21).
    resumeAfterLimit: raw.resumeAfterLimit !== false,
    sessions: mergeSessionMemory(raw.sessions),
    sessionsNoteSeen: raw.sessionsNoteSeen === true,
    estate: mergeEstate(raw.estate),
  };
}
