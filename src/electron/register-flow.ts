// FD-193: a `fabric-dashboards://register` link adds an organization's showcase and the agents this person holds a
// grant to. Any page can fire the link, so the person confirms once; the exchange itself is src/core/register.ts.
import { app, dialog, safeStorage, type BrowserWindow } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { servicesDir } from '@passioncode-ai/fabric-service-host';
import { atomicWrite } from '../core/fsutil';
import { t, type Lang } from '../core/i18n';
import { hostOf, register, type RegisterLink, type RegisterResult } from '../core/register';

export interface RegisterFlowDeps {
  lang: () => Lang;
  liveWindow: () => BrowserWindow | null;
  log: (message: string) => void;
  userData: string;
  fetch: typeof fetch;
}

// #region register-flow — docs: docs/ux/scenarios.md#scn-121-register-an-organizations-agents-from-a-link
let running = false;

/** Ask, register, say what came of it. One registration at a time; a second link while one runs is logged only. */
export async function registerFromLink(o: RegisterFlowDeps, link: RegisterLink): Promise<RegisterResult | null> {
  const host = hostOf(link.origin);
  if (running) { o.log(`register: a link for ${host} came while another registration runs; ignored`); return null; }
  running = true;
  try {
    const l = o.lang();
    const parent = o.liveWindow() ?? undefined;
    const ask = { type: 'question' as const, buttons: [t(l, 'register.add'), t(l, 'action.cancel')], defaultId: 0, cancelId: 1, message: t(l, 'register.title', { host }), detail: t(l, 'register.body', { host }) };
    const { response } = parent ? await dialog.showMessageBox(parent, ask) : await dialog.showMessageBox(ask);
    if (response !== 0) { o.log(`register: ${host} declined by the person`); return null; }
    const result = await register(link, {
      fetch: o.fetch,
      servicesDir: servicesDir(),
      label: os.hostname().slice(0, 80),
      installedBy: `Fabric Dashboards ${app.getVersion()} (registration link from ${host})`,
      now: () => new Date(),
      keepKey: (h, pem) => {
        if (!safeStorage.isEncryptionAvailable()) return false;
        atomicWrite(path.join(o.userData, 'showcase-keys', `${h.replace(/[^a-z0-9.-]/g, '-')}.key`), safeStorage.encryptString(pem), 0o600);
        return true;
      },
    });
    // The log says what was written, never the code or the token.
    if (result.ok) o.log(`register: ${host} added ${result.written.join(', ')}${result.skipped.length ? `; skipped ${result.skipped.map((s) => `${s.key} (${s.why})`).join('; ')}` : ''}`);
    else o.log(`register: ${host} failed (${result.code}): ${result.detail}`);
    const done = result.ok
      ? { type: 'info' as const, message: t(l, 'register.done', { host, count: String(result.written.length) }), detail: result.skipped.length ? t(l, 'register.skipped', { count: String(result.skipped.length) }) : '' }
      : { type: 'warning' as const, message: t(l, 'register.failed', { host }), detail: t(l, `register.why.${result.code}`) };
    const box = { ...done, buttons: ['OK'] };
    void (parent ? dialog.showMessageBox(parent, box) : dialog.showMessageBox(box));
    return result;
  } finally {
    running = false;
  }
}
// #endregion register-flow
