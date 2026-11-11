// Fabric Dashboards main process. Built like Fabric Inbox's shell: one main
// process, sandboxed renderers, context isolation, a single instance. It owns
// no service process — launchd does (ADR-0002) — so quitting stops nothing.
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, Menu, Notification, session, shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ActivityStore } from '../core/activity';
import { parseWindows, sightOf, windowNumberOf, WINDOW_LIST_JXA, type Sight } from '../core/occlusion';
import { CHANNELS, type DrawerChange, type DrawerState, type NavTarget, type Rect } from '../core/api';
import { sessionNotification } from '../core/sessions-notice';
import { consoleRowId } from '../core/sessions';
import { commandEnv, killOwned, ownedCount, runOwned } from '../core/children';
import { doctorArgv, doctorResult, DOCTOR_TIMEOUT_MS, type SetupCheckResult } from '../core/doctor';
import { readLoginPath, searchDirs } from '../core/runtimes';
import { endWorkQuestion } from '../core/consoles';
import { pendingInstallVersion, stepAside } from './pending-install';
import { displayName } from '../core/names';
import { ConsoleHost, HANDOVER_POLL_MS } from './console';
import { appendLog, sweepTemps } from '../core/fsutil';
import { linkFor, parseDeepLink, safePath, SCHEME } from '../core/deeplink';
import { servicesDir, setLoopbackConnectionCheck, setLoopbackOwnerCheck, setWindowsAclReader, windowsPowerShellEnv } from '@passioncode-ai/fabric-service-host';
import { linuxConnectionCheck, linuxLoopbackOwnerCheck, loopbackOwnerCheck, macConnectionCheck, windowsLoopbackOwnerCheck } from '../core/loopback-owner';
import { openChannel, startAnswer, type Channel } from './console-channel';
import type { ChannelAnswer } from '../core/console-channel';
import { chooseLang, langFor, t, type Lang } from '../core/i18n';
import { execRunner } from '../core/launchd';
import { listListeners, unattributed } from '../core/listeners';
import { applyLoginItem, LOGIN_NEEDS_APPROVAL, loginItemAtStartup, type LoginItemOs } from '../core/loginitem';
import { xdgLoginItem } from '../core/autostart';
import { Monitor, type AskNotice, type Notice } from '../core/monitor';
import { BUNDLE_FILE, createAnalytics, installationPath, osNameOf, readBundle } from '../core/analytics';
import { AgentNameStore, findGh, githubRepoOf, NAMES_EVERY_MS, NAMES_FIRST_MS, NAMES_TICK_MS, type GithubRepo } from '../core/agent-names';
import { authHeaders, fetchLoad, fetchUsage, readTokenAsync } from '../core/probe';
import { callCapability } from '../core/mcp-client';
import { OrganizationStore } from '../core/organization-store';
import { ORGANIZATIONS_EVERY_MS, ORGANIZATIONS_FIRST_MS, OWN_REPOSITORY_OWNER } from '../core/organizations';
import { limitsNeedingPerson, readSpend, type SpendEntry } from '../core/spend';
import { attentionQueue, badgeText, nextNewsExpiry } from '../core/attention';
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import { readLoad, type LoadEntry } from '../core/load';
import { NotifyLedger, shouldNotify } from '../core/notify';
import { OutageAlerts } from './outage-alerts';
import { powerShellAfterExit } from '../core/after-exit';
import { agentSettingsPatch, rendererSettingsPatch, SettingsStore } from '../core/settings';
import type { AppStatus, Settings, SettingsPatch } from '../core/types';
import { ALWAYS_KEPT, cancelStagedUpdate, clearRestoreRecord, KEPT_FILES, productDataPaths, purgeAfterExit, readRestoreRecord, removeMcpRegistrations, repairMcpRegistrations, restoreMcpRegistrations, writeRestoreRecord } from '../core/uninstall';
import { autoInstallNow, autoInstallWait, cookieRewrite, inSight, OCCLUSION_PROBE_MS, onScreen, resumeBehind, COOKIES_REENCRYPTED_MARKER, HiddenGrace, partitionFor, RELAUNCH_MARKER, relaunchHidden, RESUME_ROUTE_MARKER, resumeRoute, type ResumeRoute, stalePartitions, UPDATE_IDLE_MS, VIEW_RELEASE_ALL_MS, VIEW_RELEASE_GRACE_MS, VISIBILITY_SYNC_MS, VisibilitySync, WARM_VIEWS } from './policy';
import { AppTray } from './tray';
import { DockSync } from './dock';
import { linkInArgv, menuKeys, modeMenuItems, notificationSettingsUrl, places, startHidden, uninstallCommand, uninstallTarget, windowChrome } from '../core/platform';
import { EstateUpdater } from './estate-updater';
import { readSetupState } from '../core/setup';
import { Updater } from './updater';
import { ServiceViews } from './views';
import { ConsoleDrawer } from './drawer';
import { FABRIC_GET_URL, fabricPress, fabricPresentFrom } from '../core/fabric-button';
import { parseTestRemote, setTestRemote } from '../core/testhooks';
import { OpsDigester } from '../core/ops-digest';

app.enableSandbox();
app.setName('Fabric Dashboards');
// FD-37 / PL-06: Windows keeps the app's data in LOCALAPPDATA (Electron's default is the roaming
// profile) and Linux in the XDG data and state folders; macOS keeps Electron's own places.
const ownPlaces = places(process.platform, process.env, os.homedir());
if (ownPlaces && !process.env.FABRIC_DASHBOARDS_USER_DATA) {
  app.setPath('userData', ownPlaces.userData);
  app.setPath('logs', ownPlaces.logs);
}
if (process.env.FABRIC_DASHBOARDS_USER_DATA) {
  // A test or second profile keeps its logs beside its data; Electron derives `logs` from the
  // app name, not from userData, so without this a test run writes into the operator's log.
  app.setPath('userData', process.env.FABRIC_DASHBOARDS_USER_DATA);
  app.setPath('logs', path.join(process.env.FABRIC_DASHBOARDS_USER_DATA, 'logs'));
}
// FD-144 (docs/RUNBOOK.md#log-digests): what the log takes is counted by operation and outcome, hour by hour; a digest
// that cannot be written never stops the log.
const digester = new OpsDigester(path.join(app.getPath('userData'), 'digests'));
let digestTick: NodeJS.Timeout | null = null;

// DEC-0019 test hook — an unpackaged build only (testhooks.ts). Chromium resolves the test name to
// the dial address; the main process dials it directly. A packaged app ignores FD_TEST_REMOTE.
if (!app.isPackaged && process.env.FD_TEST_REMOTE) {
  const remote = parseTestRemote(process.env.FD_TEST_REMOTE);
  setTestRemote(remote);
  if (remote) app.commandLine.appendSwitch('host-resolver-rules', `MAP ${remote.name} ${remote.connectHost}`);
}

const assets = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, '../../../build/assets');
const rendererIndex = path.join(__dirname, '../../renderer/index.html');
/** How a service joins (SCN-002): the kit that writes a descriptor on install. */
const SERVICE_GUIDE = 'https://github.com/passioncode-ai/fabric-agent-adapter#readme';

/** ~/Library/Logs/Fabric Dashboards/main.log: timestamped, 0600, 5 × 5 MB at most (LC-12). */
function log(message: string): void {
  appendLog(path.join(app.getPath('logs'), 'main.log'), `${new Date().toISOString()} ${message}`);
  try { digester.record(message); } catch { /* the digest is best effort */ }
}
// R-2: installed first — an exception during start-up is logged instead of leaving a process that
// holds the single-instance lock with no window, tray or link handler.
process.on('uncaughtException', (error) => log(`uncaught: ${error.stack ?? error.message}`));
process.on('unhandledRejection', (error) => log(`unhandled: ${String(error)}`));

// Deep links (docs/adr/0004-deep-links-and-mcp.md). macOS delivers `open-url` as early as
// `will-finish-launching`, before the window or the monitor exists: the link waits in a queue.
const pendingLinks: string[] = [];
let handleLink: ((raw: string) => void) | null = null;
app.on('will-finish-launching', () => {
  app.on('open-url', (event, raw) => {
    event.preventDefault();
    if (handleLink) handleLink(raw);
    else pendingLinks.push(raw);
  });
});
// FD-37: Windows and Linux start the app WITH the link as an argument when it is not running yet.
const launchLink = linkInArgv(process.platform, process.argv, SCHEME, true);
if (launchLink) pendingLinks.push(launchLink);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let window: BrowserWindow | null = null;
  let views: ServiceViews | null = null;
  let drawer: ConsoleDrawer | null = null;
  let quitting = false;
  const userData = app.getPath('userData');
  // A writer killed between write and rename leaves its temporary file; nothing else removes it (LC-12).
  for (const name of sweepTemps(userData)) log(`removed a temporary file left by a stopped process: ${name}`);
  const settings = new SettingsStore(userData, (message) => log(message));
  // FD-122: a change someone else writes into settings.json (an agent's MCP `arrange`) reaches the window at once.
  const stopSettingsWatch = settings.watch(() => {
    log('settings: changed outside the app; read again');
    monitor.listChanged(); // FD-123: an agent turned off or on by an agent's MCP `arrange`
    if (window && !window.isDestroyed()) window.webContents.send(CHANNELS.settingsPush, settings.get());
    pushStatus();
  });
  if (settings.recovered) log(`settings: ${settings.recovered}`);
  // Embedded dashboards follow the app's theme, not only macOS (prefers-color-scheme in every page).
  nativeTheme.themeSource = settings.get().theme;
  // FD-42: with `system`, macOS switching light/dark repaints the dashboards' background at once.
  nativeTheme.on('updated', () => void views?.applyAppearance());
  const activity = new ActivityStore(userData, { onWriteError: (message) => log(message) });
  // The app speaks the system's first language. FD_TEST_LANG (`en`, `ru`) is honoured only when the
  // app is not packaged, so a test can walk the Russian interface; a shipped app ignores it.
  const testLang = !app.isPackaged ? process.env.FD_TEST_LANG : undefined;
  // The person's choice in Settings wins over the system's first language (a Mac set to English first
  // with Russian second reads Russian when the person picks it).
  const lang = (): Lang => (testLang ? langFor(testLang) : chooseLang(settings.get().language, app.getPreferredSystemLanguages()[0] || app.getLocale()));
  // FD_TEST_REMOTE_MS shortens the online-service probe interval (60 s) so the e2e suite does not
  // depend on a minute of wall clock; honoured only when the app is not packaged (as FD_TEST_REMOTE).
  const testRemoteMs = !app.isPackaged ? Number(process.env.FD_TEST_REMOTE_MS) : Number.NaN;
  // FD-45 (ADR-0021): whether anything handles `fabric://`, asked of the OS. FD_TEST_FABRIC (`present`,
  // `absent`) stands in for the OS, and makes a press log what it would open or show instead of opening
  // it (a native menu runs a nested loop the e2e suite cannot drive); honoured only when not packaged.
  const testFabric = !app.isPackaged && (process.env.FD_TEST_FABRIC === 'present' || process.env.FD_TEST_FABRIC === 'absent') ? process.env.FD_TEST_FABRIC : undefined;
  const fabricPresent = (): boolean => (testFabric ? testFabric === 'present' : fabricPresentFrom(app.getApplicationNameForProtocol('fabric://chat')));
  const openOutside = async (url: string): Promise<void> => {
    if (testFabric) { log(`fabric_open ${url}`); return; }
    await shell.openExternal(url);
  };
  // #region agent-names — docs: docs/adr/0026-agent-names-in-their-repositories.md#decision
  // FD-135: the names agents' repositories give them, read from GitHub with `gh` (cache: agent-names.json).
  let ghDirs: Promise<string[]> | null = null;
  // FD_TEST_GH stands in for `gh` (a fake GitHub for the e2e suite); honoured only when the app is not packaged.
  const testGh = !app.isPackaged ? process.env.FD_TEST_GH : undefined;
  const agentNames = new AgentNameStore({
    file: path.join(userData, 'agent-names.json'), run: execRunner, log,
    // FD-177: an unchanged read is counted in the log digest without a main.log line.
    quiet: (line) => { try { digester.record(line); } catch { /* the digest is best effort */ } },
    gh: async () => testGh || findGh(await (ghDirs ??= readLoginPath().then((p) => searchDirs(p)))),
    onChange: () => { monitor.namesChanged(); pushStatus(); },
  });
  /** The GitHub repositories the agents on this Mac name; a repository GitHub never showed is asked again in 30 min. */
  const agentRepos = (): GithubRepo[] => monitor.snapshots().map((x) => githubRepoOf(x.descriptor?.source?.repository)).filter((r): r is GithubRepo => r !== null);
  let namesTimer: NodeJS.Timeout | null = null;
  let namesStopped = false;
  function startAgentNames(): void {
    const tick = () => {
      if (namesStopped) return;
      agentNames.reloadIfChanged(); // the MCP server's rename wrote the cache
      const due = agentNames.stale(agentRepos(), NAMES_EVERY_MS);
      if (due.length) void agentNames.refresh(due);
    };
    setTimeout(() => { if (namesStopped) return; tick(); namesTimer = setInterval(tick, NAMES_TICK_MS); namesTimer.unref?.(); }, NAMES_FIRST_MS).unref?.();
  }
  // #endregion agent-names
  // #region organizations — docs: docs/ux/scenarios.md#scn-094-show-only-one-organizations-agents
  // FD-162: each agent's organization, from Project Observatory's registry (its MCP `observatory_status`, full detail,
  // read on this Mac with Observatory's own descriptor token); kept in organizations.json beside the settings.
  const organizations = new OrganizationStore({
    file: path.join(userData, 'organizations.json'), log,
    // Observatory's own registry on this Mac, read without a token (as FD-132 reads its placement record); its MCP
    // surface below asks for its own credential (`auth: own`), so it is the fallback.
    readRegistry: () => {
      const base = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'project-observatory-full');
      let projects: Record<string, unknown>;
      try { projects = JSON.parse(fs.readFileSync(path.join(base, 'registry', 'projects.json'), 'utf8')) as Record<string, unknown>; } catch { return null; }
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(base, 'config', 'organizations.json'), 'utf8')) as { organizations?: Record<string, { label?: unknown; default?: unknown; platform?: unknown; match?: { repository_owners?: unknown } }> };
        projects.organization_labels = Object.fromEntries(Object.entries(cfg.organizations ?? {}).map(([k, v]) => [k, v?.label]));
        // FD-195: the organization marked `default: true` is the operator's own: the filter's "Mine".
        projects.organization_personal = Object.entries(cfg.organizations ?? {}).find(([, v]) => v?.default === true)?.[0] ?? null;
        // FD-197: the platform's organizations: those the config marks `platform: true`, else the one that owns this
        // app's own repository (the platform's publisher).
        const entries = Object.entries(cfg.organizations ?? {});
        const marked = entries.filter(([, v]) => v?.platform === true).map(([k]) => k);
        projects.organization_platform = marked.length ? marked : entries
          .filter(([, v]) => Array.isArray(v?.match?.repository_owners) && (v.match.repository_owners as unknown[]).some((o) => typeof o === 'string' && o.toLowerCase() === OWN_REPOSITORY_OWNER))
          .map(([k]) => k);
      } catch { /* no labels: names are shown as they are */ }
      // FD-197: which organization each Cloudflare account belongs to, for the online instances.
      try { projects.cloudflare_accounts = JSON.parse(fs.readFileSync(path.join(base, 'registry', 'cloudflare-account.json'), 'utf8')); } catch { /* none: online instances keep their repository's organization */ }
      return projects;
    },
    onChange: () => { monitor.namesChanged(); pushStatus(); },
    fetchPage: async (cursor) => {
      const obs = monitor.snapshots().find((x) => x.descriptor?.id === 'project-observatory' && x.descriptor.placement !== 'remote' && (x.state === 'ready' || x.state === 'degraded'));
      const mcp = obs?.wellKnown?.surfaces.mcp;
      if (!obs?.descriptor || !mcp || mcp.transport !== 'streamable-http') return null;
      const tokenFile = obs.descriptor.auth.tokenFile;
      const headers = tokenFile ? authHeaders(obs.descriptor, await readTokenAsync(tokenFile)) : {};
      const result = await callCapability({ origin: obs.descriptor.origin, path: mcp.path, headers }, 'observatory_status',
        { detail: 'full', limit: 100, ...(cursor ? { cursor } : {}) }, app.getVersion(), 60_000) as { structuredContent?: unknown; content?: { text?: string }[] } | undefined;
      return result?.structuredContent ?? JSON.parse(result?.content?.[0]?.text ?? 'null');
    },
  });
  let orgTimer: NodeJS.Timeout | null = null;
  function startOrganizations(): void {
    const tick = () => { if (organizations.due()) void organizations.refresh(); };
    setTimeout(() => { tick(); orgTimer = setInterval(tick, ORGANIZATIONS_EVERY_MS / 6); orgTimer.unref?.(); }, ORGANIZATIONS_FIRST_MS).unref?.();
  }
  // #endregion organizations
  const monitor = new Monitor({ servicesDir: servicesDir(), activity, settings: () => settings.get(), lang, ledger: new NotifyLedger(path.join(userData, 'notified.json')),
    customName: (key, repository) => agentNames.name(key, repository),
    organizationOf: (instance) => (organizations.get().readAt ? organizations.of(instance) : undefined),
    intervals: Number.isFinite(testRemoteMs) && testRemoteMs >= 1_000 ? { remote: testRemoteMs } : undefined });
  // #region usage-analytics — docs: docs/ANALYTICS.md#what-is-sent
  // FD-136: anonymous usage and error data, on by default, this product's own switch; only a release build that
  // carries `analytics.json` (its App Key) sends anything.
  let bundleText: string | null = null;
  try { bundleText = app.isPackaged ? fs.readFileSync(path.join(process.resourcesPath, BUNDLE_FILE), 'utf8') : null; } catch { /* no key: nothing is sent */ }
  const analytics = createAnalytics({
    // A smoke run on a CI runner is never production: its events land in the Debug dataset.
    bundle: bundleText ? readBundle(bundleText) : null, appVersion: app.getVersion(), packaged: app.isPackaged && process.env.CI !== 'true',
    osName: osNameOf(process.platform), osVersion: process.getSystemVersion(), locale: app.getLocale(), engineVersion: process.versions.electron,
    installationFile: installationPath(process.platform, process.env, os.homedir()), stateFile: path.join(userData, 'analytics-state.json'),
    enabled: () => settings.get().analytics, fetch: (url, init) => fetch(url, init), log: (line) => log(JSON.stringify(line)),
  });
  const analyticsCounts = (): Record<string, number> => {
    const all = monitor.snapshots();
    return { agents_local: all.filter((x) => x.descriptor?.placement !== 'remote').length, agents_online: all.filter((x) => x.descriptor?.placement === 'remote').length };
  };
  // A crash the app noticed: where and a code only; the default handling stays (an observing handler).
  process.on('uncaughtExceptionMonitor', (e) => analytics.error('main', String((e as NodeJS.ErrnoException).code ?? e.name ?? 'Error')));
  app.on('render-process-gone', (_e, _wc, d) => { if (d.reason !== 'clean-exit') analytics.error('renderer', d.reason); });
  app.on('child-process-gone', (_e, d) => { if (d.reason !== 'clean-exit') analytics.error(['gpu', 'utility', 'zygote'].includes(d.type.toLowerCase()) ? d.type.toLowerCase() : 'unknown', d.reason); });
  let analyticsTimer: NodeJS.Timeout | null = null;
  // #endregion usage-analytics
  // ADR-0017: the agent consoles. FD_TEST_RUNTIME_DIRS replaces where runtimes are looked for, only
  // in a development run (the e2e suite's scripted runtime); a packaged app reads the login shell's PATH.
  const testRuntimeDirs = !app.isPackaged && process.env.FD_TEST_RUNTIME_DIRS ? process.env.FD_TEST_RUNTIME_DIRS.split(path.delimiter).filter(Boolean) : undefined;
  // FD-39 (ADR-0020): every console start writes its context pack under userData/consoles/<key>, and the
  // agent reaches this app's MCP server as Node inside this binary (the RunAsNode fuse), on every OS.
  const mcpServer = () => ({
    command: process.execPath,
    args: [app.isPackaged ? path.join(process.resourcesPath, 'app.asar', 'out', 'main', 'mcp', 'server.js') : path.join(__dirname, '../mcp/server.js')],
    env: { ELECTRON_RUN_AS_NODE: '1' },
  });
  // FD-65: the last Check setup, kept until the next press; a run in progress is shared, never doubled.
  let lastSetupCheck: SetupCheckResult | null = null;
  let setupCheckRun: Promise<SetupCheckResult> | null = null;
  const consoles = new ConsoleHost({ failed: (code) => analytics.failed('console', code), started: (props) => analytics.sessionStarted(props), settings, snapshot: (key) => monitor.snapshot(key), placedElsewhere: (key) => monitor.placedElsewhere(key), window: () => window, drawer: () => drawer?.contents() ?? null, visible: () => windowVisible(), log: (line) => log(line), testDirs: testRuntimeDirs, scriptsDir: path.join(userData, 'console'),
    packRoot: path.join(userData, 'consoles'), keptDir: path.join(userData, 'console-output'), version: app.getVersion(), activity: (key) => activity.list({ serviceKey: key }, 200), mcpServer,
    setupState: () => readSetupState(os.homedir(), monitor.snapshots().length),
    doctor: () => (lastSetupCheck?.kind === 'report' ? lastSetupCheck.report : null),
    keys: () => monitor.snapshots().map((x) => x.key), changed: () => pushStatus(),
    // FD-103 (SCN-085, decision 9): a taken hand-over or an automatic continue is one system notification, silenced by
    // paused notifications and quiet hours; a click opens that session in the Sessions mode.
    notice: (n) => {
      log(`sessions: ${n.kind} ${n.key} in ${n.project}`);
      if (windowVisible()) window!.webContents.send(CHANNELS.sessionsNotice, n);
      const text = sessionNotification(lang(), n, settings.get(), new Date());
      if (text) notify({ title: text.title, body: text.body, target: 'sessions', serviceKey: n.id });
    } });
  let tray: AppTray | null = null;
  const MAX_KEPT_NOTICES = 50;
  const shownNotices = new Set<Notification>();
  /** R-12: kept until clicked or closed: a collected notification loses its click handler. T-13:
   *  macOS does not always send close (a banner that times out into Notification Center), so only
   *  the newest MAX_KEPT_NOTICES are kept; an older one's click is the one that may be lost.
   *  Scenario walk 2026-11-11 (SCN-093, SCN-024): declared before the updater so the update and login-item notices
   *  are kept the same way as notify()'s; a local one could be collected and its click lost. */
  function keepNotice(n: Notification, onClick: () => void): void {
    shownNotices.add(n);
    for (const old of shownNotices) { if (shownNotices.size <= MAX_KEPT_NOTICES) break; shownNotices.delete(old); }
    const forget = () => shownNotices.delete(n);
    n.on('click', () => { forget(); onClick(); });
    n.on('close', forget);
  }
  // R-3: the window lets itself close only once a quit is really under way — before-quit, or
  // Squirrel's before-quit-for-update. A failed install puts the window back to hiding on close.
  // Operator 2026-10-16 (LC-16): a downloaded, verified update asks once per version to restart and finish.
  let restartAsked: string | null = null;
  // FD-143: with automatic updates off, a newer version is announced once per version; the click updates.
  // Scenario walk 2026-11-11 (SCN-093): the announced version lives in settings (`updateAnnounced`), so the same
  // banner does not come back at every launch.
  const updater = new Updater(() => {
    pushStatus();
    if (updater.state.state === 'ready' && updater.state.version && restartAsked !== updater.state.version) {
      restartAsked = updater.state.version;
      try {
        const n = new Notification({ title: t(lang(), 'update.finish.title'), body: t(lang(), 'update.finish.body', { version: updater.state.version }), silent: true });
        // Scenario walk 2026-11-11 (SCN-093): kept like notify()'s, so its click still restarts after a collection.
        keepNotice(n, () => void restartToUpdate());
        n.show();
        log(`update: asked to restart and finish installing ${updater.state.version}`);
      } catch { /* no notification centre */ }
    }
    if (updater.state.state === 'available' && updater.state.version && settings.get().updateAnnounced !== updater.state.version) {
      settings.update({ updateAnnounced: updater.state.version });
      try {
        const n = new Notification({ title: t(lang(), 'update.available.title', { version: updater.state.version }), body: t(lang(), 'update.available.body'), silent: true });
        // Scenario walk 2026-11-11 (SCN-093): kept like notify()'s, so its click (the person's Update) is not lost.
        keepNotice(n, () => updater.check(true));
        n.show();
        log(`update: told that ${updater.state.version} is out (automatic updates off)`);
      } catch { /* no notification centre */ }
    }
    if (updater.state.state === 'ready' && !windowSeen()) updateGrace.hidden();
    // FD-80: a ready update held by a shown window says so once, not only when the grace fires.
    else if (updater.state.state === 'ready') autoInstall();
    if (updater.state.state === 'error') {
      // A failed install: the window hides on close again, and no later launch starts hidden because of a marker
      // written for an install that never happened (the waiter or shell may fail before the quit began).
      if (installing) { installing = false; quitting = false; }
      try { fs.rmSync(path.join(userData, RELAUNCH_MARKER), { force: true }); } catch { /* gone */ }
    }
  }, log, () => { installing = true; quitting = true; }, () => settings.get().autoUpdate);
  let installing = false;
  updater.onFailure = (code) => analytics.failed('self_update', code); // FD-141
  // #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
  // ADR-0018: the estate watcher lives in this process next to the Updater — git/npm tool spawns on
  // the LC-16 cadence, started in whenReady, stopped in will-quit, nothing while its switch is off.
  const estate = new EstateUpdater({ settings: () => settings.get(), log, onChange: () => pushStatus(), dataDir: userData });
  // #endregion estate-update

  // #region outage-alerts — docs: docs/adr/0010-notifications-only-when-it-matters.md#amendment-2026-10-11--outages-reach-the-operator-away-from-the-mac-fd-48
  // FD-48: outages and failed/attention banners also reach the operator channel (a service offering `<id>.notify`).
  const alerts = new OutageAlerts({
    dataDir: userData, snapshots: () => monitor.snapshots(), settings: () => settings.get(), version: app.getVersion(), log,
    nameOf: (s) => displayName(s.wellKnown?.service.name ?? s.descriptor?.name ?? s.key, s.descriptor?.instance ?? s.key.split('.')[1] ?? 'default'),
    reasonOf: (s) => (s.reasons[0] ? t(lang(), s.reasons[0].code, s.reasons[0].params) : s.state),
    allowed: (key, now) => shouldNotify(settings.get(), { kind: 'down', serviceKey: key }, now),
    words: () => {
      const l = lang();
      return {
        down: (name) => t(l, 'alerts.down', { name }),
        failing: (name, source) => t(l, 'alerts.failing', { name, source }),
        back: (name) => t(l, 'alerts.back', { name }),
        since: (minutes, reason) => t(l, 'alerts.since', { minutes, reason }),
        after: (minutes) => t(l, 'alerts.after', { minutes }),
        removed: (name) => t(l, 'alerts.removed', { name }),
        wasDown: (minutes, reason) => t(l, 'alerts.wasDown', { minutes, reason }),
        ask: (name) => t(l, 'alerts.ask', { name }),
        open: (link) => t(l, 'alerts.open', { link }),
      };
    },
    changed: () => pushStatus(),
  });
  // FD-132: a placement record that cannot be used is said once in the log; the agents then read as placed here.
  monitor.on('placement-error', (error: string | null) => log(error ? `placement_unreadable ${error}` : 'placement_readable'));
  // FD-125: a decision an agent waits for reaches the operator channel too, with the link that opens its page.
  monitor.on('ask', (a: AskNotice) => alerts.ask(a.serviceKey, a.id, { name: a.name, episode: a.episode, at: a.at, text: a.text, link: askLink(a.serviceKey, a.link) }));
  function askLink(key: string, link: string | null): string | null {
    try { return linkFor(key, link && safePath(link) ? link : undefined); } catch { return null; }
  }
  // #endregion outage-alerts
  // W2 (UX-05, UX-06): the limits that need a person, from the last spend read; W2 (UX-08): the last show.
  let personLimits: Record<string, LimitView[]> = {};
  let lastShown: { at: string; afterHiddenMs: number } | undefined;
  let hiddenSince: number | null = Date.now(); // the app starts with nothing on screen (a login start stays hidden)
  const status = (): AppStatus => ({
    services: monitor.snapshots(), off: monitor.offServices(), ...monitor.meta(), unread: activity.unread(), activityRev: activity.revision, update: updater.state, estate: estate.state, version: app.getVersion(),
    alerts: alerts.status(), sessions: consoles.sessionsStatus(), analyticsAvailable: analytics.availability() !== 'unavailable-no-key',
    limits: personLimits, ...(lastShown ? { shown: lastShown } : {}),
  });

  // #region quiet-push — docs: AGENTS.md#lifecycle
  // The monitor emits only real changes; here a hidden window gets no IPC (it is sent the current
  // status the moment it shows), the tray rebuilds only when its menu would differ, and the Dock
  // badge is set only when it changes (LC-08).
  let pushTimer: NodeJS.Timeout | null = null;
  let badge: string | null = null;
  // FD-80: a window of a hidden app (⌘H, or hidden by another program) is not on screen, whatever isVisible() says;
  // measured 2026-10-21: System Events hid the app and Electron still reported the window visible for an hour.
  const windowVisible = () => onScreen({ exists: Boolean(window && !window.isDestroyed()), visible: Boolean(window && !window.isDestroyed() && window.isVisible()), minimized: Boolean(window && !window.isDestroyed() && window.isMinimized()), appHidden: process.platform === 'darwin' && app.isHidden() });
  // FD-80: on screen and neither covered by other windows nor on another Space, from macOS's window list; read only
  // while an update waits for the window (`probeSight`), unknown otherwise.
  let occlusion: Sight | null = null;
  const windowSeen = () => inSight(windowVisible(), occlusion);
  function pushStatus(): void {
    if (pushTimer) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      const s = status();
      if (windowVisible()) window!.webContents.send(CHANNELS.statusPush, s);
      // W2 (UX-04): the tray, the Dock and the window count one queue (src/core/attention.ts).
      const now = Date.now();
      tray?.update(s.services, s.limits ?? {}, s.sessions?.rows ?? []);
      const next = badgeText(attentionQueue(s.services, { now, limits: s.limits }).length);
      if (next !== badge) { badge = next; app.dock?.setBadge(next); }
      // A failed action leaves the queue after 30 minutes with no event of its own: count again then.
      if (newsTimer) { clearTimeout(newsTimer); newsTimer = null; }
      const expiry = nextNewsExpiry(s.services, now);
      if (expiry !== null) { newsTimer = setTimeout(() => { newsTimer = null; pushStatus(); }, Math.max(1000, expiry - now + 50)); newsTimer.unref(); }
    }, 30);
  }
  let newsTimer: NodeJS.Timeout | null = null;

  // Embedded dashboards are released once the window has been hidden for the grace period: first all but the
  // WARM_VIEWS shown most recently (FD-74), then, after VIEW_RELEASE_ALL_MS, every one.
  const viewGrace = new HiddenGrace(VIEW_RELEASE_GRACE_MS, () => {
    const count = views?.releaseCold(WARM_VIEWS) ?? 0;
    if (count) log(`released ${count} dashboard view(s) after ${VIEW_RELEASE_GRACE_MS / 60_000} min hidden; kept ${views?.keys().length ?? 0}`);
  });
  const viewGraceAll = new HiddenGrace(VIEW_RELEASE_ALL_MS, () => {
    const count = views?.keys().length ?? 0;
    if (!count) return;
    views?.releaseAll();
    log(`released ${count} dashboard view(s) after ${VIEW_RELEASE_ALL_MS / 60_000} min hidden`);
  });
  // #region auto-install-flow — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
  // ADR-0015: a downloaded update installs by itself once the window has been hidden for
  // UPDATE_IDLE_MS and no command the app started is running; the relaunch stays in the menu bar.
  const updateGrace = new HiddenGrace(UPDATE_IDLE_MS, () => autoInstall());
  let busyRetry: NodeJS.Timeout | null = null;
  let waitSaid: string | null = null;
  function autoInstall(): void {
    const busy = ownedCount() + consoles.manager.runningCount(); // ADR-0017: a running console is work in progress
    const now = { ready: updater.state.state === 'ready', autoUpdate: settings.get().autoUpdate, visible: windowSeen(), busy };
    if (!autoInstallNow(now)) {
      // FD-64: a held install says why, once per reason — 0.7.7 waited two silent hours on this Mac.
      const why = autoInstallWait(now);
      if (why && why !== waitSaid) log(`update: the automatic install of ${updater.state.version ?? 'the update'} waits: ${why}`);
      waitSaid = why;
      // R-10: one retry at a time, and showing the window cancels it — the 10 hidden minutes start again.
      if (busy && updater.state.state === 'ready' && !busyRetry) busyRetry = setTimeout(() => { busyRetry = null; autoInstall(); }, 60_000);
      busyRetry?.unref();
      return;
    }
    // FD-80: a window open behind others comes back on its screen, behind them; a hidden one stays in the menu bar.
    const behind = windowVisible();
    const marker = path.join(userData, behind ? RESUME_ROUTE_MARKER : RELAUNCH_MARKER);
    const body = behind ? JSON.stringify({ at: new Date().toISOString(), route: shownRoute, behind: true }) : new Date().toISOString();
    try { fs.writeFileSync(marker, body, { mode: 0o600 }); } catch (error) { log(`update: could not mark the relaunch: ${(error as Error).message}`); }
    log(`update: installing ${updater.state.version ?? 'the downloaded update'} while the window is ${behind ? 'covered by other windows' : 'hidden'}`);
    if (!updater.restart()) { try { fs.rmSync(marker, { force: true }); } catch { /* gone */ } }
  }
  // #endregion auto-install-flow
  // #region restart-to-update — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
  /** Restart to Update, from the window, the menu or the «Restart to finish updating» notification. */
  async function restartToUpdate(): Promise<void> {
    // FD-75: a ready update whose staged files are gone is staged again first; it installs once it is.
    if (updater.state.state === 'ready' && !updater.readyToInstall()) return;
    // A held release only hands the verified build to Squirrel: nothing quits, nothing to ask.
    if (updater.state.state === 'ready' && !(await mayEndWork('restart'))) return;
    if (updater.state.state === 'ready') {
      // FD-31: the person should not open the old copy while ShipIt installs — say it reopens by itself.
      const version = updater.state.version ?? '';
      try { new Notification({ title: t(lang(), 'update.installing.title', { version }), body: t(lang(), 'update.installing.body'), silent: true }).show(); } catch { /* no notification centre */ }
    }
    // U-18 (FD-21): the next copy opens on this screen. Only when the app is about to quit for the
    // install; a held release staying in place keeps the person where they are anyway.
    const resume = path.join(userData, RESUME_ROUTE_MARKER);
    const quitting = updater.state.state === 'ready';
    if (quitting) {
      try { fs.writeFileSync(resume, JSON.stringify({ at: new Date().toISOString(), route: shownRoute }), { mode: 0o600 }); } catch (error) { log(`update: could not keep the screen for the relaunch: ${(error as Error).message}`); }
    }
    if (!updater.restart() && quitting) { try { fs.rmSync(resume, { force: true }); } catch { /* gone */ } }
  }
  // #endregion restart-to-update
  // #region end-work-question — docs: docs/adr/0017-focus-layout-and-agent-console.md#decision
  // Audit 2026-10-07 HIGH-2: a restart to update or a quit the person asks for never ends an agent's
  // console session or a running command silently — it names them and waits for a yes. The automatic
  // install never asks: it waits until nothing runs (auto-install-flow).
  async function mayEndWork(kind: 'restart' | 'quit'): Promise<boolean> {
    const names = consoles.manager.runningKeys().map((key) => {
      const d = monitor.snapshot(key)?.descriptor;
      if (d) return displayName(d.name, d.instance);
      // FD-191: a console of its own (a new session, a hand-over) is named by its coding agent and folder, not its key.
      const snap = consoles.manager.snapshot(key);
      return snap.cwd ? `${snap.label || key} · ${path.basename(snap.cwd)}` : key;
    });
    const q = endWorkQuestion(lang(), { kind, consoles: names, commands: ownedCount() });
    if (!q) return true;
    const ask = { type: 'warning' as const, message: q.message, detail: q.detail, buttons: [q.confirm, t(lang(), 'action.cancel')], defaultId: 1, cancelId: 1 };
    const parent = window && !window.isDestroyed() && window.isVisible() ? window : null;
    const { response } = parent ? await dialog.showMessageBox(parent, ask) : await dialog.showMessageBox(ask);
    log(`${kind === 'restart' ? 'update_restart' : 'quit'} ${response === 0 ? 'confirmed' : 'refused'} consoles=${names.length} commands=${ownedCount()}`);
    return response === 0;
  }
  async function quitAsked(): Promise<void> {
    if (!(await mayEndWork('quit'))) return;
    quitting = true;
    app.quit();
  }
  // #endregion end-work-question
  function windowShown(): void {
    // Several signals can report one show (show, restore, FD-64's sync): only the first after a hide is a show.
    if (hiddenSince !== null || !lastShown) lastShown = { at: new Date().toISOString(), afterHiddenMs: hiddenSince === null ? 0 : Date.now() - hiddenSince };
    hiddenSince = null;
    visibility.note(true);
    sight.note(true); // FD-80: a window shown behind others is found covered on the next sync, and its grace starts
    updateGrace.shown();
    if (busyRetry) { clearTimeout(busyRetry); busyRetry = null; }
    viewGrace.shown();
    viewGraceAll.shown();
    monitor.setVisible(true);
    pushStatus();
    void views?.resume((key) => monitor.snapshot(key)).then(() => views?.announce());
  }
  function windowHidden(): void {
    hiddenSince ??= Date.now();
    visibility.note(false);
    sight.note(false);
    monitor.setVisible(false);
    viewGrace.hidden();
    viewGraceAll.hidden();
    updateGrace.hidden();
  }
  // FD-64: ⌘H and the return from it send the window no hide or show event, so what is on screen is
  // compared after every activation change and on a slow tick (one boolean, no spawn, no IPC).
  const visibility = new VisibilitySync(windowVisible, windowShown, windowHidden, false);
  const syncVisibility = () => { if (visibility.sync()) log(`window ${windowVisible() ? 'shown' : 'hidden'} without a window event (FD-64)`); };
  app.on('did-resign-active', () => setTimeout(syncVisibility, 500));
  app.on('did-become-active', () => setTimeout(syncVisibility, 500));
  // FD-80: covering and uncovering the window fire no event either; only the update's grace follows it.
  const sight = new VisibilitySync(windowSeen, () => { updateGrace.shown(); if (busyRetry) { clearTimeout(busyRetry); busyRetry = null; } }, () => updateGrace.hidden(), false);
  const syncSight = () => { if (sight.sync() && windowVisible()) log(`window ${windowSeen() ? 'in sight again' : occlusion === 'off-screen' ? 'on another Space' : 'covered by other windows'} (FD-80)`); };
  // FD-80: the window list is read only while an update waits with the window on screen and installing by itself is
  // on: one osascript a minute (~0.1 s), never otherwise; anything else leaves the sight unknown, as before.
  let probing = false;
  const probeSight = async () => {
    const wants = process.platform === 'darwin' && updater.state.state === 'ready' && settings.get().autoUpdate && windowVisible() && window && !window.isDestroyed();
    if (!wants) { if (occlusion !== null) { occlusion = null; syncSight(); } return; }
    if (probing) return;
    probing = true;
    try {
      const r = await runOwned('/usr/bin/osascript', ['-l', 'JavaScript', '-e', WINDOW_LIST_JXA], { timeoutMs: 5_000, env: commandEnv() });
      const next = r.code === 0 ? sightOf(parseWindows((r.stdout ?? r.output).trim()), window && !window.isDestroyed() ? windowNumberOf(window.getMediaSourceId()) : null) : null;
      if (next !== occlusion) { occlusion = next; syncSight(); }
    } catch {
      occlusion = null;
    } finally {
      probing = false;
    }
  };
  app.on('did-resign-active', () => setTimeout(() => { syncSight(); void probeSight(); }, 500));
  app.on('did-become-active', () => setTimeout(() => { syncSight(); void probeSight(); }, 500));
  const visibilityTick = setInterval(() => { syncVisibility(); syncSight(); recheckDock(); }, VISIBILITY_SYNC_MS);
  visibilityTick.unref();
  const sightTick = setInterval(() => void probeSight(), OCCLUSION_PROBE_MS);
  sightTick.unref();
  // FD-62 (SB-108): hand-overs Switchboard leaves for a console — every 15 s while the window is shown, every
  // 60 s while it is hidden, nothing without Switchboard (ConsoleHost.pollHandovers). FD-83: limit stops too.
  let handoverTimer: NodeJS.Timeout | null = null;
  const pollHandovers = () => {
    handoverTimer = null;
    // FD-83: the limit stops are read on the same tick, after the hand-overs (ConsoleHost.pollRecovery). FD-103: Switchboard's
    // machine-wide session list beside them (one read in flight at most; a failure is a degraded source).
    const chain = consoles.pollHandovers().catch((error) => log(`console: hand-over read failed: ${(error as Error).message}`))
      .then(() => consoles.pollRecovery()).catch((error) => log(`console: limit stops read failed: ${(error as Error).message}`));
    void Promise.all([chain, consoles.pollSessions().catch((error) => log(`console: session list read failed: ${(error as Error).message}`))]).finally(() => {
      if (quitting) return;
      handoverTimer = setTimeout(pollHandovers, windowVisible() ? HANDOVER_POLL_MS.visible : HANDOVER_POLL_MS.hidden);
      handoverTimer.unref();
    });
  };
  handoverTimer = setTimeout(pollHandovers, HANDOVER_POLL_MS.visible);
  // FD-74: the runtimes and the login shell's PATH are read 3 s after start, so the first console opens at once.
  setTimeout(() => { if (!quitting) consoles.warm(); }, 3_000).unref();
  handoverTimer.unref();
  // #endregion quiet-push

  // FD-05 / FD-35: the Dock follows the window, and a hide always wins (src/electron/dock.ts).
  const dockSync = new DockSync(app.dock);
  function syncDock(visible: boolean): void {
    // FD-172: a hide replaced by a show is not a failure; only one still wished when it gives up is logged.
    void dockSync.want(visible).then((ok) => { if (!ok && !visible && dockSync.wantsHidden) log('dock_hide failed: the Dock still shows the icon after the window hid'); });
  }
  /** FD-35 follow-up: a hide that gave up is asked again on the slow tick while the window stays hidden. */
  function recheckDock(): void {
    if (windowVisible()) return;
    void dockSync.recheck().then((ok) => {
      if (ok === true) log('dock_hide recovered: the icon left the Dock on a later pass');
      else if (ok === false) log('dock_hide failed again on a later pass');
    });
  }

  function showWindow(inactive = false): BrowserWindow {
    if (window && !window.isDestroyed()) {
      if (window.isMinimized()) window.restore();
      if (inactive) { window.showInactive(); return window; }
      window.show();
      window.focus();
      return window;
    }
    window = new BrowserWindow({
      width: 1280, height: 820, minWidth: 960, minHeight: 600, show: false, title: 'Fabric Dashboards',
      ...windowChrome(process.platform), backgroundColor: settings.get().theme === 'light' ? '#ffffff' : '#0a070d',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false },
    });
    const w = window;
    rendererListening = false;
    w.webContents.on('did-start-loading', () => { rendererListening = false; });
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.webContents.on('will-navigate', (event) => event.preventDefault());
    w.webContents.session.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
    // LC-08 (R-13, T-14): page moves and loads are not sent to a hidden window; `announce` catches the
    // toolbar up on show. Errors, crashes and restarts are rare and always sent, so the page host never
    // shows a dead view.
    views = new ServiceViews(w, lang, (event) => { if ((event.kind !== 'navigated' && event.kind !== 'loaded') || windowVisible()) w.webContents.send(CHANNELS.viewEvent, event); },
      // ADR-0016: a dashboard's link to another service takes the same path as a link from outside.
      (raw) => { if (handleLink) handleLink(raw); else pendingLinks.push(raw); },
      () => monitor.snapshots().map((x) => x.descriptor?.origin).filter((o): o is string => Boolean(o)),
      (key) => monitor.snapshot(key),
      fabricPresent,
      // FD-42: the scheme and the dashboard theme the operator chose, for `fabric_appearance`.
      () => ({ scheme: settings.get().theme, theme: settings.get().pageTheme, systemDark: nativeTheme.shouldUseDarkColors }),
      log);
    w.once('ready-to-show', () => (inactive ? w.showInactive() : w.show())); // FD-80: back behind the person's work
    // FD-05 (operator decision 2026-10-05): a hidden window leaves only the menu-bar icon; showing
    // it brings the Dock icon back. A minimized window keeps its Dock icon — that is where it lives.
    w.on('show', () => { syncDock(true); windowShown(); });
    w.on('hide', () => { windowHidden(); syncDock(false); });
    w.on('minimize', windowHidden);
    w.on('restore', windowShown);
    w.on('close', (event) => {
      if (quitting) return;
      event.preventDefault(); // the window hides; the app keeps watching from the menu bar
      w.hide();
    });
    // FD-92: the console drawer over the content area, above any dashboard.
    drawer = new ConsoleDrawer(w, { preload: path.join(__dirname, 'preload.js'), index: rendererIndex, log });
    views.afterAttach = () => drawer?.raise();
    w.on('closed', () => { drawer?.destroy(); window = null; views = null; drawer = null; });
    void w.loadFile(rendererIndex);
    return w;
  }

  // A navigation sent before the renderer subscribes is lost (a link at launch lands while React
  // is still mounting), so until the renderer takes it (CHANNELS.navigateTake) it waits here.
  /** U-18: the screen on show, reported by the renderer; Restart to update writes it for the next copy. */
  let shownRoute: ResumeRoute = { page: 'overview' };
  let rendererListening = false;
  let pendingNav: NavTarget | null = null;
  function navigate(target: NavTarget, inactive = false): void {
    const w = showWindow(inactive);
    if (rendererListening) w.webContents.send(CHANNELS.navigate, target);
    else pendingNav = target; // the latest wins, as a click would
  }

  // U-7: when a notification pause ends — set from the tray or from Settings — the tray rebuilds once.
  let pauseTimer: NodeJS.Timeout | null = null;
  function schedulePauseEnd(): void {
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = null;
    const until = Date.parse(settings.get().notifications.pausedUntil ?? '');
    if (!Number.isFinite(until) || until <= Date.now()) return;
    pauseTimer = setTimeout(() => { pauseTimer = null; pushStatus(); }, Math.min(until - Date.now() + 1000, 2 ** 31 - 1));
    pauseTimer.unref();
  }
  function notify(notice: Omit<Notice, 'target'> & { target: NavTarget['page'] }): void {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title: notice.title, subtitle: notice.subtitle, body: notice.body, silent: false });
    keepNotice(n, () => navigate({ page: notice.target, key: notice.serviceKey, link: notice.link }));
    n.show();
  }

  // A development run must never register the Electron binary at login: no OS port at all.
  // FD-37: Windows keeps the login item in the Run key with `--hidden` (Electron compares the same args
  // when reading it back); Linux has no Electron login item, so it is an XDG autostart entry (autostart.ts).
  const loginArgs = process.platform === 'win32' ? { args: ['--hidden'] } : {};
  const loginOs: LoginItemOs | null = !app.isPackaged ? null
    : process.platform === 'linux' ? xdgLoginItem(process.env, os.homedir(), process.execPath)
    : { get: () => app.getLoginItemSettings(loginArgs), set: (openAtLogin) => app.setLoginItemSettings({ openAtLogin, ...loginArgs }) };

  // #region uninstall-flow — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
  /** LC-14: undo what installing and running added. Registrations go first and stop the flow on
   *  failure, so a half-uninstalled app never deletes its data and leaves an entry behind. */
  /** `decided`: FD-175, the operator's words relayed by an agent stand for the confirmation and its box. */
  async function uninstall(decided?: { deleteData: boolean }): Promise<{ ok: boolean; cancelled?: boolean; error?: string }> {
    const l = lang();
    const parent = window && !window.isDestroyed() ? window : undefined;
    // LC-14: data goes only when the person asks. The box is unticked: settings and history stay,
    // and a reinstall picks them up together with the login item and the MCP entry (ADR-0015).
    const ask = {
      type: 'warning' as const, buttons: [t(l, 'uninstall.confirm'), t(l, 'action.cancel')], defaultId: 1, cancelId: 1,
      message: t(l, 'uninstall.title'), detail: t(l, 'settings.uninstall.body'), checkboxLabel: t(l, 'uninstall.deleteData'), checkboxChecked: false,
    };
    const { response, checkboxChecked: deleteData } = decided ? { response: 0, checkboxChecked: decided.deleteData }
      : parent ? await dialog.showMessageBox(parent, ask) : await dialog.showMessageBox(ask);
    if (response !== 0) return { ok: false, cancelled: true };
    const wasAtLogin = Boolean(loginOs && settings.get().launchAtLogin);
    let mcp: ReturnType<typeof removeMcpRegistrations>['entries'] = [];
    try {
      // R-11: the MCP entry first — it is the step that can fail on a busy ~/.claude.json, and a
      // failure then leaves nothing half-removed. The login item second; a refusal puts the MCP entries back.
      if (app.isPackaged) {
        const r = removeMcpRegistrations();
        mcp = r.entries;
        log(`uninstall: MCP registration removed from ${JSON.stringify(r.removed)}`);
      }
      if (loginOs) {
        const refused = applyLoginItem(false, loginOs);
        if (refused) {
          try {
            restoreMcpRegistrations(mcp, launcher());
          } catch (e) {
            // T-15: the MCP entry is gone and could not be put back — say so, never "Nothing was removed".
            log(`uninstall: MCP registration not put back: ${(e as Error).message}`);
            return { ok: false, error: t(l, 'uninstall.partial', { error: refused }) };
          }
          throw new Error(refused);
        }
      }
    } catch (error) {
      log(`uninstall stopped: ${(error as Error).message}`);
      return { ok: false, error: t(l, 'uninstall.failed', { error: (error as Error).message }) };
    }
    // Data goes after this process exits — Chromium writes into userData until then (purgeAfterExit).
    // A development run shares the installed app's profile name, so it purges nothing.
    // Windows helpers start through a launcher that must have finished before this app quits (src/core/after-exit.ts).
    const helpers: Promise<void>[] = [];
    const awaitHelper = (h: ReturnType<typeof purgeAfterExit>) => { if (h instanceof Promise) helpers.push(h.catch((error: Error) => log(`uninstall: a helper could not start: ${error.message}`))); };
    if (app.isPackaged) {
      const all = [...new Set([...productDataPaths(app.getPath('home')), userData, app.getPath('logs')])];
      if (deleteData) {
        // LC-16: even «delete my settings» leaves the automatic-update switch as the person set it.
        awaitHelper(purgeAfterExit(process.pid, all.filter((p) => path.resolve(p) !== path.resolve(userData)), { dir: userData, names: ALWAYS_KEPT }));
      } else {
        try {
          writeRestoreRecord(userData, { at: new Date().toISOString(), loginItem: wasAtLogin, mcp });
        } catch (error) {
          log(`uninstall: could not write the restore record: ${(error as Error).message}`);
        }
        awaitHelper(purgeAfterExit(process.pid, all.filter((p) => path.resolve(p) !== path.resolve(userData)), { dir: userData, names: KEPT_FILES }));
      }
      // R-20 (FD-21): a downloaded update would be installed by ShipIt as this app quits, putting the
      // trashed bundle back — its record goes first.
      if (process.platform === 'darwin') {
        const cancelled = cancelStagedUpdate(app.getPath('home'));
        if (cancelled.length) log(`uninstall: the staged update was removed (${cancelled.length} item(s)) so it cannot reinstall the app`);
      }
      // FD-37: only what this install is — never a parent folder (uninstallTarget, ADR-0019).
      const target = uninstallTarget(process.platform, process.execPath, process.env, (p) => fs.existsSync(p));
      log(`uninstall: ${target.kind}${'path' in target ? ` ${target.path}` : ''}`);
      try {
        if (target.kind === 'trash-bundle' || target.kind === 'trash-file') await shell.trashItem(target.path);
        else if (target.kind === 'run-uninstaller') {
          // After this app exits (uninstallCommand); a failure to start it is said, never thrown.
          const cmd = uninstallCommand(target, process.pid);
          // A grandchild outside this app's job, or Windows kills the waiter when the app exits (src/core/after-exit.ts).
          helpers.push(powerShellAfterExit(cmd.args[3]!, windowsPowerShellEnv()).catch((error: Error) => log(`uninstall: the uninstaller could not start: ${error.message}`)));
        } else await dialog.showMessageBox({ type: 'info', message: t(l, 'uninstall.manual', { how: target.kind === 'package' ? target.command : t(l, target.reason) }), buttons: ['OK'] });
      } catch (error) {
        await dialog.showMessageBox({ type: 'info', message: t(l, 'uninstall.trashFailed', { error: (error as Error).message }), buttons: ['OK'] });
      }
    }
    log(`uninstall: login item and registration removed; ${deleteData ? 'all data' : 'everything but settings and history'} is removed after exit`);
    await Promise.all(helpers); // every helper runs outside this app before it quits (bounded: cmd.exe returns at once)
    setImmediate(() => app.quit()); // before-quit sets quitting, so the window lets itself close
    return { ok: true };
  }
  // #endregion uninstall-flow

  // #region reinstall — docs: docs/adr/0015-data-survives-uninstall-updates-install-themselves.md#decision
  /** The packaged MCP launcher of this install. */
  const launcher = () => path.join(process.resourcesPath, 'bin', 'fabric-dashboards-mcp');

  /** After an uninstall that kept the data: put back the login item and the MCP entries it removed.
   *  Every launch also points an entry of ours whose launcher is gone at this install (ADR-0015). */
  function restoreAfterReinstall(): void {
    const record = readRestoreRecord(userData);
    if (record) {
      // The login item is tried once — a refusal is macOS's or the person's answer, and LC-07 never
      // registers on every launch. The MCP entries are retried while ~/.claude.json cannot be edited.
      if (record.loginItem && loginOs) {
        const refused = applyLoginItem(true, loginOs);
        if (refused) log(`reinstall: login item not restored: ${refused}`);
        else { settings.update({ launchAtLogin: true, launchAtLoginAsked: true }); log('reinstall: login item restored'); }
      }
      try {
        log(`reinstall: MCP registration restored in ${JSON.stringify(restoreMcpRegistrations(record.mcp, launcher()))}`);
        clearRestoreRecord(userData);
      } catch (error) {
        log(`reinstall: MCP registration not restored, retried at the next launch: ${(error as Error).message}`);
        try { writeRestoreRecord(userData, { at: record.at, loginItem: false, mcp: record.mcp }); } catch { /* the next launch tries the login item once more */ }
      }
    }
    try {
      const repaired = repairMcpRegistrations(launcher());
      if (repaired.length) log(`MCP registration pointed at this install in ${JSON.stringify(repaired)}`);
    } catch (error) {
      log(`MCP registration not checked: ${(error as Error).message}`);
    }
  }

  /** U-6/R-3: a move that macOS refuses says so, and leaves the app as it was. A move that works
   *  quits through app.quit (before-quit sets `quitting`) and relaunches from Applications. */
  /** `quiet`: FD-175, an agent asked; its answer says the refusal, so no box waits for a person. */
  async function moveToApplications(quiet = false): Promise<{ ok: boolean; error?: string }> {
    if (!app.isPackaged || process.platform !== 'darwin' || app.isInApplicationsFolder()) return { ok: true }; // the Applications folder is macOS's
    let error = '';
    try {
      // An older copy already in Applications is replaced; a running one cannot be, since this
      // copy holds the single-instance lock.
      if (app.moveToApplicationsFolder({ conflictHandler: () => true })) return { ok: true };
      error = t(lang(), 'move.refused');
    } catch (e) {
      error = (e as Error).message;
    }
    log(`move to Applications failed: ${error}`);
    if (!quiet) await dialog.showMessageBox({ type: 'warning', message: t(lang(), 'move.failed', { error }), buttons: ['OK'] });
    return { ok: false, error };
  }

  /** Asked once (LC-07): a copy outside Applications cannot update itself. */
  async function offerMoveToApplications(): Promise<void> {
    if (!app.isPackaged || process.platform !== 'darwin' || app.isInApplicationsFolder() || settings.get().moveToApplicationsAsked) return;
    settings.update({ moveToApplicationsAsked: true });
    const l = lang();
    const ask = { type: 'question' as const, buttons: [t(l, 'move.confirm'), t(l, 'move.later')], defaultId: 0, cancelId: 1, message: t(l, 'move.title'), detail: t(l, 'move.body') };
    const { response } = window && !window.isDestroyed() ? await dialog.showMessageBox(window, ask) : await dialog.showMessageBox(ask);
    if (response === 0) await moveToApplications(); // a refusal is shown by moveToApplications itself
  }
  // #endregion reinstall

  /** FD-175: Settings' own change, for the console channel (set by registerIpc, where it lives beside its handler). */
  let applySettingsFn: ((patch: SettingsPatch) => { settings: Settings; error?: string }) | null = null;
  function registerIpc(): void {
    consoles.register();
    const snap = (key: string) => monitor.snapshot(key);
    ipcMain.handle(CHANNELS.status, () => status());
    ipcMain.on(CHANNELS.routeChanged, (_e, route: unknown) => {
      const r = resumeRoute(JSON.stringify({ at: new Date().toISOString(), route }), Date.now());
      if (r) shownRoute = r;
    });
    ipcMain.handle(CHANNELS.navigateTake, () => {
      rendererListening = true;
      const target = pendingNav;
      pendingNav = null;
      return target;
    });
    // FD-135 (SCN-090): the row menu's Rename; the agent's repository is the one its descriptor names.
    ipcMain.handle(CHANNELS.renameAgent, async (_e, key: string, name: string | null) => {
      if (typeof key !== 'string' || (name !== null && typeof name !== 'string')) throw new Error('bad rename');
      const d = monitor.snapshot(key)?.descriptor;
      if (!d) return { ok: false, error: `no agent ${key}` };
      const res = await agentNames.rename(key, d.source?.repository, name);
      if (!res.ok) analytics.failed('rename', 'refused' in res ? res.refused : 'github'); // FD-141
      return res.ok ? { ok: true } : res;
    });
    ipcMain.handle(CHANNELS.control, async (_e, key: string, action: 'restart' | 'stop' | 'start') => {
      if (!['restart', 'stop', 'start'].includes(action)) throw new Error('unknown action');
      if (action !== 'restart') views?.drop(key);
      const res = await monitor.control(key, action);
      if (!res.ok) analytics.failed(action, res.reason.code); // FD-141
      return res;
    });
    ipcMain.handle(CHANNELS.command, (_e, key: string, which: 'doctor' | 'update') => {
      if (which !== 'doctor' && which !== 'update') throw new Error('unknown command');
      // FD-141: a refusal, a deadline or a non-zero exit, as a code only (never the command's output).
      return monitor.command(key, which).then((r) => {
        const code = r.refused ? 'refused' : r.timedOut ? 'timeout' : r.code === null ? 'not_started' : r.code !== 0 ? `exit_${r.code}` : null;
        if (code) analytics.failed(which, code);
        return r;
      });
    });
    ipcMain.handle(CHANNELS.logs, (_e, key: string) => monitor.logs(key));
    // LC-08: a hidden window reads nothing — the Spend page's timer may keep running while hidden,
    // and the renderer cannot tell (no visibility change on hide), so the main process answers the
    // last sums instead of reading every service again.
    // Overview and Spend both ask; one read serves both for SPEND_FRESH_MS (ADR-0014).
    let lastSpend: SpendEntry[] = [];
    let lastSpendAt = 0;
    // Tests shorten it to see each read; honoured only when the app is not packaged (as FD_TEST_REMOTE).
    const SPEND_FRESH_MS = !app.isPackaged && process.env.FD_TEST_SPEND_FRESH_MS ? Number(process.env.FD_TEST_SPEND_FRESH_MS) : 30_000;
    ipcMain.handle(CHANNELS.spend, async (_e, force?: boolean) => {
      const stale = Date.now() - lastSpendAt > SPEND_FRESH_MS;
      // D-4: Refresh reads now (a person asked); "read at" is the main process's own read time.
      if ((windowVisible() && (stale || force === true)) || !lastSpendAt) {
        lastSpend = await readSpend(monitor.snapshots(), { token: readTokenAsync, fetchUsage, now: () => Date.now() });
        lastSpendAt = Date.now();
        const limits = limitsNeedingPerson(lastSpend);
        if (JSON.stringify(limits) !== JSON.stringify(personLimits)) { personLimits = limits; pushStatus(); }
      }
      return { entries: lastSpend, readAt: lastSpendAt ? new Date(lastSpendAt).toISOString() : null };
    });
    // #region load-ipc — docs: docs/ux/scenarios.md#scn-076-see-how-busy-an-agent-is
    // FD-93: one agent's load, read while its Load tab asks (every 60 s while shown); a hidden window gets the last
    // read of that agent instead of a new one (LC-08), as Spend does.
    const lastLoad = new Map<string, { entry: LoadEntry; at: number }>();
    ipcMain.handle(CHANNELS.load, async (_e, key: string) => {
      const snapshots = monitor.snapshots();
      for (const k of lastLoad.keys()) if (!snapshots.some((x) => x.key === k)) lastLoad.delete(k);
      const snap = snapshots.find((x) => x.key === key);
      if (!snap) return { entry: { key, kind: 'none' } satisfies LoadEntry, readAt: new Date().toISOString() };
      let last = lastLoad.get(key);
      if (windowVisible() || !last) {
        last = { entry: await readLoad(snap, { token: readTokenAsync, fetchLoad, now: () => Date.now() }), at: Date.now() };
        lastLoad.set(key, last);
      }
      return { entry: last.entry, readAt: new Date(last.at).toISOString() };
    });
    // #endregion load-ipc
    ipcMain.handle(CHANNELS.activity, (_e, filter) => activity.list(filter ?? {}));
    ipcMain.handle(CHANNELS.activitySeen, () => { activity.markSeen(); pushStatus(); });
    ipcMain.handle(CHANNELS.settings, () => settings.get());
    ipcMain.handle(CHANNELS.setupState, () => readSetupState(os.homedir(), monitor.snapshots().length));
    // #region setup-check — docs: docs/ux/scenarios.md#scn-070-check-what-is-set-up
    // FD-65: the launcher's read-only doctor, run only when the person presses Check setup, one at a time.
    ipcMain.handle(CHANNELS.setupCheckLast, () => lastSetupCheck);
    ipcMain.handle(CHANNELS.setupCheck, (_e, auto?: boolean) => {
      // FD-184: a check by itself runs npx from npm; a build from source (e2e, development) runs it only with the fixture.
      if (auto === true && !app.isPackaged && !process.env.FD_TEST_DOCTOR) return Promise.resolve(lastSetupCheck);
      setupCheckRun ??= (async () => {
        const dirs = searchDirs(await readLoginPath());
        const testDoctor = !app.isPackaged ? process.env.FD_TEST_DOCTOR : undefined; // e2e: a fixture stands in for npx
        const npx = testDoctor ?? dirs.map((d) => path.join(d, process.platform === 'win32' ? 'npx.cmd' : 'npx')).find((f) => fs.existsSync(f)) ?? null;
        if (!npx) return { kind: 'no-node' } as SetupCheckResult;
        const [cmd, args] = doctorArgv(npx);
        const env = { ...commandEnv(), PATH: dirs.join(path.delimiter) };
        const r = await runOwned(cmd, args, { timeoutMs: DOCTOR_TIMEOUT_MS, env });
        const result = doctorResult(r);
        log(`setup_check ${result.kind}${result.kind === 'report' ? ` ok=${result.report.ok} fail=${result.report.summary.fail} warn=${result.report.summary.warn}` : result.kind === 'error' ? ` ${result.detail}` : ''}`);
        return result;
      })().then((result) => { lastSetupCheck = result; return result; }).finally(() => { setupCheckRun = null; });
      return setupCheckRun;
    });
    // #endregion setup-check
    // Review R-4, R1-S1: a console's runtime and folder, and the Sessions list's records, are never written through a
    // generic settings change. FD-175: an agent's change (MCP `settings`) takes this same path.
    ipcMain.handle(CHANNELS.settingsUpdate, (_e, raw: SettingsPatch) => applySettings(rendererSettingsPatch(raw)));
    applySettingsFn = applySettings;
    function applySettings(patch: SettingsPatch): { settings: Settings; error?: string } {
      // Choosing launch at login — on the first-run card or in Settings — is the one moment it is registered (LC-07).
      const choosing = 'launchAtLogin' in patch;
      const before = settings.get().autoUpdate;
      const next = settings.update(choosing ? { ...patch, launchAtLoginAsked: true } : patch);
      if (patch.layout?.list) { monitor.listChanged(); pushStatus(); } // FD-123: who is off takes effect at once; FD-129: the tray drops a hidden agent
      if (patch.notifications) schedulePauseEnd(); // U-7: a pause set here also rebuilds the tray when it ends
      if (typeof patch.autoUpdate === 'boolean' && patch.autoUpdate !== before) updater.switched(patch.autoUpdate); // LC-16 auto_update on|off
      if (typeof patch.analytics === 'boolean') { analytics.switched(patch.analytics); pushStatus(); } // FD-136: off drops what waits
      // #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
      if (patch.estate) {
        estate.switched(next.estate.enabled); // ADR-0018: the switch starts/stops the timers at once
        estate.checkSoon(); // what is watched changed: the status line follows within seconds, not hours
      }
      // #endregion estate-update
      if ('language' in patch) appMenu(); // the menu speaks the new language at once; the tray follows with pushStatus
      nativeTheme.themeSource = next.theme;
      void views?.applyAppearance(); // FD-42: every open dashboard's cookie and background follow at once
      const refusal = choosing && loginOs ? applyLoginItem(next.launchAtLogin, loginOs) : undefined;
      const error = refusal === LOGIN_NEEDS_APPROVAL ? t(lang(), 'login.approval') : refusal; // P-10
      if (error) {
        const reverted = settings.update({ launchAtLogin: false });
        return { settings: reverted, error };
      }
      pushStatus();
      return { settings: next };
    }
    ipcMain.handle(CHANNELS.listeners, async () => {
      try {
        const claimed = new Set(monitor.snapshots().map((s) => Number(/:(\d+)$/.exec(s.descriptor?.origin ?? '')?.[1] ?? 0)));
        return { listeners: unattributed(await listListeners(execRunner), claimed) };
      } catch (error) {
        return { listeners: [], error: (error as Error).message };
      }
    });
    ipcMain.handle(CHANNELS.showPath, (_e, p: string) => {
      const known = monitor.snapshots().flatMap((s) => [s.descriptorPath, s.descriptor?.paths?.data, s.descriptor?.auth.tokenFile].filter(Boolean) as string[]);
      const allowed = [monitor.meta().servicesDir, ...known].map((x) => x.replace(/^~\//, `${app.getPath('home')}/`));
      const target = p.replace(/^~\//, `${app.getPath('home')}/`);
      if (!allowed.includes(target)) return { ok: false, error: 'not a path this app shows' };
      try {
        if (target === monitor.meta().servicesDir) fs.mkdirSync(target, { recursive: true, mode: 0o700 });
      } catch (error) {
        return { ok: false, error: (error as Error).message };
      }
      // R-15: a bundle (`.app`) is a directory to the file system: reveal it, never launch it.
      if (fs.existsSync(target) && fs.statSync(target).isDirectory() && !/\.app\/?$/i.test(target)) {
        return shell.openPath(target).then((error) => (error ? { ok: false, error } : { ok: true }));
      }
      shell.showItemInFolder(target);
      return { ok: true };
    });
    ipcMain.handle(CHANNELS.viewShow, async (_e, key: string, rect: Rect, link: string | undefined, owner: string, fresh?: boolean) => {
      const s = snap(key);
      if (!s || !views) return { ok: false, error: 'unknown service', stage: 'page' };
      if (typeof owner !== 'string' || !owner) throw new Error('a view is shown for a dashboard host');
      return views.show(s, rect, typeof link === 'string' ? link : undefined, owner, fresh === true);
    });
    ipcMain.handle(CHANNELS.viewHide, (_e, owner?: string) => views?.hide(typeof owner === 'string' ? owner : undefined));
    ipcMain.handle(CHANNELS.viewPage, (_e, key: string) => views?.page(String(key)) ?? null);
    ipcMain.handle(CHANNELS.viewNavigate, (_e, key: string, action: string) => {
      if (!['back', 'forward', 'home', 'refresh'].includes(action)) throw new Error('unknown navigation');
      views?.navigate(String(key), action as 'back' | 'forward' | 'home' | 'refresh');
    });
    // The toolbar copies only what it shows: a page address or an app link, never a token.
    ipcMain.handle(CHANNELS.copyText, (_e, text: string) => { clipboard.writeText(String(text).slice(0, 4096)); });
    // FD-74 (SCN-040): one Copy button, a native menu (a page menu would sit under the embedded dashboard).
    ipcMain.handle(CHANNELS.copyMenu, (_e, key: unknown, anchor?: { x?: unknown; y?: unknown }) => new Promise<'address' | 'link' | null>((resolve) => {
      const page = typeof key === 'string' ? views?.page(key) : null;
      const w = window;
      if (!page || !w || w.isDestroyed()) { resolve(null); return; }
      let picked: 'address' | 'link' | null = null;
      const copy = (which: 'address' | 'link') => { picked = which; clipboard.writeText((which === 'address' ? page.address : page.link).slice(0, 4096)); resolve(which); };
      // e2e: a native menu cannot be clicked from the page; an unpackaged test run names the item instead.
      const testPick = !app.isPackaged ? process.env.FD_TEST_COPY_PICK : undefined;
      if (testPick === 'address' || testPick === 'link') { copy(testPick); log(`copy_menu ${testPick}`); resolve(picked); return; }
      const at = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
      Menu.buildFromTemplate([
        { label: t(lang(), 'view.copyAddress'), click: () => copy('address') },
        { label: t(lang(), 'view.copyLink'), sublabel: t(lang(), 'view.copyLinkHint'), click: () => copy('link') },
      ]).popup({ window: w, x: at(anchor?.x), y: at(anchor?.y), callback: () => setTimeout(() => resolve(picked), 200) }); // a click may land just after the menu closes
    }));
    // FD-45 (DEC-0040, ADR-0021): Fabric's button. A press opens a view in Fabric and nothing more (FB-8);
    // the link carries the service id only, and Fabric finds the project itself.
    ipcMain.handle(CHANNELS.fabricButton, (_e, key: string) => fabricPress(String(key), fabricPresent()).kind);
    ipcMain.handle(CHANNELS.fabricPress, async (_e, key: string, anchor: { x?: unknown; y?: unknown }) => {
      const press = fabricPress(String(key), fabricPresent());
      if (press.kind === 'none') return { opened: 'none' };
      if (press.kind === 'direct') {
        try {
          await openOutside(press.url);
          log(`fabric_button opened chat service=${String(key)}`);
          return { opened: 'fabric' };
        } catch (error) {
          // A handler the OS names but that cannot open the link: the same answer as no Fabric (FB-5).
          log(`fabric_button failed service=${String(key)}: ${(error as Error).message}`);
        }
      }
      const label = t(lang(), 'fabric.notInstalled');
      const get = () => void openOutside(FABRIC_GET_URL).catch((error: Error) => log(`fabric_button get_failed: ${error.message}`));
      if (testFabric) { log(`fabric_menu ${label}`); return { opened: 'menu' }; }
      const w = window;
      if (!w || w.isDestroyed()) return { opened: 'none' };
      const at = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
      Menu.buildFromTemplate([{ label, click: get }]).popup({ window: w, x: at(anchor?.x), y: at(anchor?.y) });
      return { opened: 'menu' };
    });
    ipcMain.handle(CHANNELS.rescan, () => monitor.tick(true));
    ipcMain.handle(CHANNELS.serviceGuide, () => shell.openExternal(SERVICE_GUIDE));
    ipcMain.handle(CHANNELS.updateRestart, () => restartToUpdate());
    ipcMain.handle(CHANNELS.updateSteps, () => { const steps = updater.state.state === 'held' ? updater.state.steps : undefined; if (steps && steps.startsWith('https://')) return shell.openExternal(steps); });
    ipcMain.handle(CHANNELS.updateCheck, () => updater.check(true)); // the person asked: works with automatic updates off
    ipcMain.handle(CHANNELS.moveToApplications, () => moveToApplications());
    ipcMain.handle(CHANNELS.notificationSettings, async () => { const url = notificationSettingsUrl(process.platform); if (url) await shell.openExternal(url); });
    ipcMain.handle(CHANNELS.locale, () => lang());
    ipcMain.handle(CHANNELS.uninstall, () => uninstall());
    ipcMain.on(CHANNELS.viewBounds, (_e, rect: Rect) => views?.setBounds(rect));
    // FD-92: the window's page sets the drawer; the drawer's page reports folds and heights to the window's page.
    ipcMain.on(CHANNELS.drawerState, (e, state: DrawerState) => { if (window && e.sender.id === window.webContents.id) drawer?.set(state); });
    ipcMain.on(CHANNELS.drawerChange, (e, change: DrawerChange) => {
      if (!window || window.isDestroyed() || e.sender.id !== drawer?.contents()?.id) return;
      if (change?.kind === 'focusOut') window.webContents.focus(); // VIS-05: Esc then Tab leaves the terminal for the window's page
      window.webContents.send(CHANNELS.drawerChange, change);
    });
    ipcMain.on(CHANNELS.drawerDrag, (e, on: boolean) => { if (e.sender.id === drawer?.contents()?.id) drawer?.setDragging(on === true); });
  }

  /** FD-74: ⌘R reloads the dashboard on screen, signed in again; ⇧⌘R first empties its cache. With no dashboard
   *  on screen it reads every service again. */
  function reloadCommand(hard: boolean): void {
    const key = views?.shownKey();
    if (key && windowVisible()) { log(`dashboard: ${key} reload (${hard ? 'ignoring cache' : 'menu'})`); void views!.reload(key, hard); return; }
    void monitor.tick(true);
  }

  function layoutCommand(which: 'sidebar' | 'console' | 'details'): void {
    if (window && !window.isDestroyed()) window.webContents.send(CHANNELS.layoutCommand, which);
  }

  function appMenu(): void {
    const l = lang();
    const keys = menuKeys(process.platform);
    // FD-37: the app menu and the Command key are macOS's; elsewhere a File menu holds updates and Quit.
    const quit: Electron.MenuItemConstructorOptions = { label: t(l, 'menu.quit'), accelerator: keys.quit, click: () => void quitAsked() };
    const checkUpdates: Electron.MenuItemConstructorOptions = { label: t(l, 'menu.checkUpdates'), click: () => updater.check(true) };
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      keys.appMenu
        ? { role: 'appMenu', submenu: [
          { role: 'about' }, checkUpdates,
          { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, quit,
        ] }
        : { label: t(l, 'menu.file'), submenu: [checkUpdates, { type: 'separator' }, quit] },
      { role: 'editMenu' },
      // ADR-0017: the panels fold away from the menu too; the window holds the state (Settings.layout).
      { label: t(l, 'menu.view'), submenu: [
        // FD-103 (SCN-077): ⌘1 Agents, ⌘2 Sessions (Ctrl elsewhere).
        ...modeMenuItems(process.platform, (key) => t(l, key)).map((m) => ({ id: m.id, label: m.label, accelerator: m.accelerator, click: () => navigate({ page: m.page }) })),
        { type: 'separator' },
        { id: 'reload-page', label: t(l, 'menu.reload'), accelerator: keys.reload, click: () => reloadCommand(false) },
        { id: 'reload-hard', label: t(l, 'menu.hardReload'), accelerator: keys.hardReload, click: () => reloadCommand(true) },
        { type: 'separator' },
        { label: t(l, 'menu.toggleSidebar'), accelerator: keys.sidebar, click: () => layoutCommand('sidebar') },
        { label: t(l, 'menu.toggleConsole'), accelerator: keys.console, click: () => layoutCommand('console') },
        { label: t(l, 'menu.toggleDetails'), accelerator: keys.details, click: () => layoutCommand('details') },
      ] },
      { role: 'windowMenu' },
      ...(keys.appMenu ? [] : [{ role: 'help' as const, submenu: [{ role: 'about' as const }] }]),
    ]));
  }

  // A link opened while the app runs reaches the first instance as an argument (and through
  // `open-url` on macOS); a second process only forwards it and exits.
  app.on('second-instance', (_event, argv) => {
    const raw = linkInArgv(process.platform, argv, SCHEME, false);
    if (raw && handleLink) handleLink(raw);
    else if (raw) pendingLinks.push(raw); // R-14: before the first scan, the link waits like a launch link
    else if (app.isReady()) showWindow();
  });
  app.on('activate', () => showWindow());
  app.on('before-quit', () => { quitting = true; });
  let killing = false;
  let consoleChannel: Channel | null = null;
  app.on('will-quit', (event) => {
    // Nothing starts after quit begins; pending state reaches disk; commands we started end with us (LC-01, LC-02).
    void consoleChannel?.close(); // ADR-0025: the socket and its key go with the run
    stopSettingsWatch();
    consoleChannel = null;
    monitor.stop();
    alerts.stop(); // FD-48: no tick after quit begins
    viewGrace.dispose();
    viewGraceAll.dispose();
    updateGrace.dispose();
    clearInterval(visibilityTick); // FD-64
    clearInterval(sightTick); // FD-80
    if (digestTick) clearInterval(digestTick); // FD-144: the open hour is kept for the next start
    try { digester.save(); } catch { /* best effort */ }
    if (handoverTimer) clearTimeout(handoverTimer); handoverTimer = null; // FD-62: no read after quit begins
    // #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
    estate.stop(); // ADR-0018: no estate check or retry past this point
    namesStopped = true; // FD-135: no names read past this point
    if (analyticsTimer) clearInterval(analyticsTimer); // FD-136
    analytics.stop();
    if (namesTimer) clearInterval(namesTimer);
    if (orgTimer) clearInterval(orgTimer); // FD-162
    // #endregion estate-update
    activity.flush();
    // R-4: Electron does not wait for timers, so the SIGKILL that follows SIGTERM would never run.
    // With a command still running, the quit waits for killOwned (≤ 300 ms + a beat), then exits.
    // ADR-0017: an agent console ends with the app too (hang-up, then kill after its grace).
    // F3 of FIX-2: a continue after a limit still in flight, or a stop claimed and not finished, is settled first.
    if ((ownedCount() > 0 || consoles.manager.runningCount() > 0 || consoles.quitWork() > 0) && !killing) {
      killing = true;
      event.preventDefault();
      void Promise.allSettled([killOwned(300), consoles.endAllForQuit()]).finally(() => app.exit(0)); // R1-S4: closed when the app quit
    }
  });

  // FD-156, FD-159: a service token goes to 127.0.0.1 only when this user's own process listens on the port (several
  // users share loopback on the Studio). macOS: a user's lsof sees only its own sockets; Linux: /proc/net/tcp names
  // each socket's owner. Windows: the compiled reader below (FD-159).
  if ((process.platform === 'darwin' || process.platform === 'linux') && typeof process.getuid === 'function') {
    let told = false;
    const failed = (why: string) => { if (!told) { told = true; log(`loopback_owner unreadable: ${why}`.slice(0, 300)); } };
    setLoopbackOwnerCheck(process.platform === 'darwin'
      ? loopbackOwnerCheck(execRunner, process.getuid(), Date.now, failed)
      : linuxLoopbackOwnerCheck((p) => fs.promises.readFile(p, 'utf8'), process.getuid(), Date.now, failed));
    // FD-168 (CT-254): and the open connection itself is checked just before the token is written.
    setLoopbackConnectionCheck(process.platform === 'darwin'
      ? macConnectionCheck(execRunner, process.getuid(), failed)
      : linuxConnectionCheck((p) => fs.promises.readFile(p, 'utf8'), process.getuid(), failed));
  }
  // FD-94: the installed copy's compiled ACL reader, so a token check never waits for Windows PowerShell to start.
  if (process.platform === 'win32' && app.isPackaged) {
    const reader = path.join(process.resourcesPath, 'bin', 'fabric-dashboards-acl.exe');
    if (fs.existsSync(reader)) {
      setWindowsAclReader(reader);
      // FD-159: the same reader names whose process listens on a loopback port (DEC-0154 HA-2).
      let told = false;
      setLoopbackOwnerCheck(windowsLoopbackOwnerCheck(execRunner, reader, Date.now, (why) => { if (!told) { told = true; log(`loopback_owner unreadable: ${why}`.slice(0, 300)); } }));
    }
  }
  void app.whenReady().then(() => {
    // FD-31: ShipIt is replacing this bundle — stay out of its way; the helper reopens the app after.
    const pending = pendingInstallVersion();
    if (pending) { stepAside(pending, lang(), log); return; }
    registerIpc();
    // FD-144: closed hours and days are written within a minute of their end.
    digestTick = setInterval(() => { try { digester.roll(); } catch { /* best effort */ } }, 60_000);
    digestTick.unref();
    // #region console-channel-start — docs: docs/adr/0025-the-console-channel.md#decision
    // ADR-0025 (FD-120): the app's own MCP server starts a console session or a fix through the buttons' code path.
    void openChannel({
      userData, log,
      // FD-166: the read answers what the Sessions list shows; the starts take the buttons' own path.
      start: async (r): Promise<ChannelAnswer> => {
        if (r.op === 'console.list') return { ok: true, consoles: consoles.openConsoles() };
        // #region agent-doors — docs: docs/ux/scenarios.md#scn-098-an-agent-changes-what-a-person-changes-in-settings-and-on-the-sessions-page
        // FD-175: the window's own buttons for an agent, each through the code its button runs.
        if (r.op === 'settings.update') {
          const { patch, refused } = agentSettingsPatch(r.patch);
          if (!applySettingsFn) return { ok: false, code: 'not-ready' };
          const done = applySettingsFn(patch);
          return { ok: true, result: { changed: Object.keys(patch), refused, ...(done.error ? { error: done.error } : {}) } };
        }
        if (r.op === 'sessions.act' && r.session) {
          const { act, row, account } = r.session;
          if (act === 'clear-ended') { await consoles.clearEnded(); return { ok: true, result: { act } }; }
          const done = act === 'continue' ? await consoles.continueSession(row!, { cols: 100, rows: 30 }, account)
            : act === 'end' ? await consoles.endSession(row!) : await consoles.dismissSession(row!);
          return done.ok ? { ok: true, result: { act, ...done } } : { ok: false, code: done.reason ?? 'refused', ...(done.detail ? { detail: String(done.detail).slice(0, 200) } : {}) };
        }
        if (r.op === 'app.update') {
          if (r.update === 'check') { await updater.check(true); return { ok: true, result: { state: updater.state.state, version: updater.state.version ?? null } }; }
          // Restart to update may ask the person first (running consoles): started, never awaited here.
          void restartToUpdate();
          return { ok: true, result: { state: updater.state.state, version: updater.state.version ?? null, restarting: updater.state.state === 'ready' } };
        }
        if (r.op === 'session.new' && r.start) {
          // FD-191 (SCN-101, SCN-102): the New session and New agent dialogs' Start; a choice left out is the dialog's default.
          const o = await consoles.newSessionOptions();
          const runtime = r.start.runtime ?? o.runtime;
          if (!runtime) return { ok: false, code: 'no-runtime' };
          const done = await consoles.startNew({ kind: r.start.kind, runtime, folder: r.start.folder ?? o.folder, bypass: r.start.bypass ?? o.bypass, isolated: r.start.isolated ?? false }, { cols: 120, rows: 32 });
          if (!done.ok) {
            if ('why' in done) return { ok: false, code: `admission_${done.why}` };
            return { ok: false, code: done.reason, ...(done.detail ? { detail: String(done.detail).slice(0, 200) } : {}) };
          }
          const snap = consoles.manager.snapshot(done.key);
          return { ok: true, result: { started: true, console: done.key, row: consoleRowId(done.key, snap.startedAt ?? Date.now()), kind: r.start.kind, runtime, folder: snap.cwd } };
        }
        if (r.op === 'console.choose' && r.choice) {
          const done = await consoles.chooseFor(r.service, r.choice);
          return done.ok ? { ok: true, result: { runtime: done.runtime, folder: done.folder } } : { ok: false, code: done.reason, detail: done.detail };
        }
        if (r.op === 'app.install' && r.install) {
          if (r.install === 'move-to-applications') {
            const where = !app.isPackaged ? 'not-packaged' : process.platform !== 'darwin' ? 'not-macos' : app.isInApplicationsFolder() ? 'already-there' : null;
            if (where) return { ok: true, result: { moved: false, why: where } };
            // A move that works quits and relaunches from Applications: the answer goes first.
            setTimeout(() => { void moveToApplications(true); }, 500);
            return { ok: true, result: { moving: true } };
          }
          const deleteData = r.install === 'uninstall-all';
          // The app quits once its helpers run: the answer goes first, and a refusal is in main.log.
          setTimeout(() => { void uninstall({ deleteData }).then((u) => { if (!u.ok) log(`uninstall asked by an agent stopped: ${u.error ?? 'cancelled'}`); }); }, 500);
          return { ok: true, result: { uninstalling: true, deleteData } };
        }
        // #endregion agent-doors
        return consoles.start(r.service, 'new', { cols: 120, rows: 32 }, r.task).then((x) => {
          // FD-175 (FD-129's button): a fix for an agent whose session runs is typed into that session, not a second one.
          if (!x.ok && x.reason === 'running' && r.task) {
            const sent = consoles.sendTask(r.service, r.task);
            return sent.ok ? { ok: true, result: { typed: true, console: r.service, waitsForEnter: true } } : { ok: false, code: sent.error ?? 'not-sent' };
          }
          return startAnswer(r.service, x);
        });
      },
    }).then((c) => { consoleChannel = c; if (c) log('console channel open'); });
    // #endregion console-channel-start
    appMenu();
    tray = new AppTray(assets, {
      open: (key) => (key ? navigate({ page: 'service', key }) : showWindow()),
      sessions: () => navigate({ page: 'sessions', key: 'all' }), // SCN-085 step 4
      pause: () => {
        settings.update({ notifications: { ...settings.get().notifications, pausedUntil: new Date(Date.now() + 3600_000).toISOString() } });
        pushStatus();
        schedulePauseEnd();
      },
      resume: () => { settings.update({ notifications: { ...settings.get().notifications, pausedUntil: null } }); pushStatus(); },
      paused: () => { const p = settings.get().notifications.pausedUntil; return Boolean(p && new Date(p) > new Date()); },
      quit: () => void quitAsked(), // the menu itself says quitting stops no service (LC-07)
      hidden: () => settings.get().layout.list.hidden,
    }, lang);
    monitor.on('change', pushStatus);
    monitor.on('change', () => alerts.tick());
    alerts.start();
    schedulePauseEnd(); // a pause that outlived a restart still ends with a tray rebuild
    monitor.on('notify', notify);
    monitor.on('restarted', (key: string) => views?.serviceRestarted(key));
    // An uninstalled service takes its view and its stored session with it (LC-12).
    monitor.on('removed', (key: string) => {
      views?.drop(key);
      consoles.manager.forget(key); // ADR-0017: its console ends with it
      const ses = session.fromPartition(partitionFor(key));
      void Promise.all([ses.clearStorageData(), ses.clearCache()]).catch((error) => log(`could not clear the session of ${key}: ${(error as Error).message}`));
    });
    // Partitions of services removed while the app was not running: no session holds them yet.
    monitor.once('change', () => {
      if (monitor.meta().dirError) return; // an unreadable directory says nothing about what is installed
      const dir = path.join(userData, 'Partitions');
      let names: string[] = [];
      try { names = fs.readdirSync(dir); } catch { return; }
      for (const name of stalePartitions(names, monitor.snapshots().map((s) => s.key))) {
        try { fs.rmSync(path.join(dir, name), { recursive: true, force: true }); log(`removed the stored session of a service that is gone: ${name}`); } catch (error) { log(`could not remove ${name}: ${(error as Error).message}`); }
      }
      // FD-04 follow-up: cookies stored before encryption are written back once, so Chromium stores them encrypted.
      // Linux keeps the fuse off (dist-other.mjs), so there is nothing to do there. Counts are logged, never values.
      const marker = path.join(userData, COOKIES_REENCRYPTED_MARKER);
      if (process.platform !== 'linux' && app.isPackaged && !fs.existsSync(marker)) {
        void (async () => {
          let rewritten = 0, failed = 0;
          for (const key of monitor.snapshots().map((s) => s.key)) {
            if (!names.includes(partitionFor(key).slice('persist:'.length))) continue;
            const ses = session.fromPartition(partitionFor(key));
            try {
              for (const c of await ses.cookies.get({})) {
                const back = cookieRewrite(c);
                if (!back) continue;
                try { await ses.cookies.set(back); rewritten += 1; } catch { failed += 1; }
              }
              await ses.cookies.flushStore();
            } catch { failed += 1; }
          }
          log(`dashboard cookies written back for encryption: ${rewritten} rewritten, ${failed} failed`);
          if (failed === 0) try { fs.writeFileSync(marker, new Date().toISOString(), { mode: 0o600 }); } catch { /* tried again next start */ }
        })();
      }
    });
    monitor.start();
    if (app.isPackaged) restoreAfterReinstall();
    updater.onInstallWhenReady = () => void restartToUpdate(); // FD-75
    updater.start();
    // #region estate-update — docs: docs/adr/0018-estate-updates-from-inside-the-app.md#decision
    startAgentNames(); // FD-135: names read 20 s after start, then each repository every 30 min
    startOrganizations(); // FD-162: Observatory's organization map 25 s after start, then every 30 min
    estate.start(); // ADR-0018: first estate check 90 s after start, then every 6 h — only when the switch is on
    // #endregion estate-update
    if (app.isPackaged) app.setAsDefaultProtocolClient(SCHEME);
    handleLink = (raw: string) => {
      const known = monitor.snapshots().map((s) => ({ key: s.key, descriptor: s.descriptor }));
      const result = parseDeepLink(raw, known);
      if (!result.ok) {
        // The reason is logged, never the raw link — a link is not trusted text; the parts a
        // reason quotes are JSON-escaped and clipped (src/core/deeplink.ts).
        log(`deep link refused: ${result.reason}`);
        showWindow();
        // The reason names what is wrong (an unknown service, a path off its origin), never the link.
        void dialog.showMessageBox({ type: 'warning', message: t(lang(), 'link.refused.title'), detail: t(lang(), 'link.refused.body', { reason: result.reason }), buttons: ['OK'] });
        return;
      }
      const { target } = result;
      if (target.page === 'overview') navigate({ page: 'overview' }); // U-5: the overview, not whatever page was open
      else navigate(target);
    };
    // The first scan fills the snapshots a link is checked against; a link that arrived with the
    // launch waits for it rather than being refused as «no installed service».
    const argvLink = process.argv.find((a) => a.startsWith(`${SCHEME}:`));
    if (argvLink) pendingLinks.push(argvLink);
    const flush = () => { for (const raw of pendingLinks.splice(0)) handleLink?.(raw); };
    if (monitor.snapshots().length || !pendingLinks.length) flush();
    else monitor.once('change', flush);
    // #region login-item-startup — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
    // LC-07 as amended 2026-10-16: on by default (the first launch registers it once), the person's choice kept
    // after that, and checked at every launch — a login item macOS holds for approval is said in a notification.
    const login = loginItemAtStartup(settings.get(), loginOs);
    if (login.patch) settings.update(login.patch);
    if (login.registered) log('login item registered by default (LC-07, 2026-10-16)');
    else if (login.patch) log(`login item changed in System Settings: launchAtLogin=${login.patch.launchAtLogin}`);
    if (login.refused) log(`login item: macOS refused the default registration: ${login.refused}; the next launch tries again`);
    if (login.needsApproval) {
      log('login item: macOS holds it for approval (System Settings → General → Login Items)');
      try {
        const n = new Notification({ title: t(lang(), 'login.approval.title'), body: t(lang(), 'login.approval.body'), silent: true });
        // Scenario walk 2026-11-11 (SCN-024): kept like notify()'s, so its click still opens Login Items.
        keepNotice(n, () => { if (process.platform === 'darwin') void shell.openExternal('x-apple.systempreferences:com.apple.LoginItems-Settings.extension'); });
        n.show();
      } catch { /* no notification centre */ }
    }
    // #endregion login-item-startup
    // Opened at login: stay in the menu bar; the operator opens the window when they want it.
    // Relaunched by an automatic update install: back in the menu bar, as it was (ADR-0015).
    const marker = path.join(userData, RELAUNCH_MARKER);
    let markerText: string | null = null;
    try { markerText = fs.readFileSync(marker, 'utf8'); fs.rmSync(marker, { force: true }); } catch { /* none */ }
    const afterUpdate = relaunchHidden(markerText, Date.now());
    if (afterUpdate) log(`update: relaunched as ${app.getVersion()} after an automatic install`);
    const hidden = startHidden(process.platform, { argv: process.argv, wasOpenedAtLogin: process.platform === 'darwin' ? app.getLoginItemSettings().wasOpenedAtLogin : undefined, afterUpdate });
    // FD-136: the start, then one `app_active` a UTC day while the app runs (checked hourly; LC-08: unref'd, no spawn).
    analytics.started(launchLink ? 'link' : process.argv.includes('--background') ? 'background' : hidden && !afterUpdate ? 'login' : 'ordinary', analyticsCounts());
    setTimeout(() => analytics.activeTick(analyticsCounts()), 60_000).unref();
    analyticsTimer = setInterval(() => analytics.activeTick(analyticsCounts()), 3_600_000);
    analyticsTimer.unref();
    // U-18: after Restart to update, back on the screen the person left (never for a hidden relaunch).
    let resumeText: string | null = null;
    const resumeFile = path.join(userData, RESUME_ROUTE_MARKER);
    try { resumeText = fs.readFileSync(resumeFile, 'utf8'); fs.rmSync(resumeFile, { force: true }); } catch { /* none */ }
    const resume = hidden ? null : resumeRoute(resumeText, Date.now());
    const behind = Boolean(resume) && resumeBehind(resumeText); // FD-80: installed while the window was covered
    if (resume && resume.page !== 'overview') { navigate(resume, behind); log(`update: reopened on ${resume.page} ${behind ? 'behind other windows after an automatic install' : 'after Restart to update'}`); }
    else if (!hidden) { showWindow(behind); if (behind) log('update: reopened behind other windows after an automatic install'); }
    else { syncDock(false); updateGrace.hidden(); } // the menu bar only, as when the window is hidden (FD-05)
    if (!hidden) void offerMoveToApplications();
    log(`started ${app.getVersion()} watching ${monitor.meta().servicesDir}`);
  });

}
