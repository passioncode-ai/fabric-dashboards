# Usage and error data

**State:** built 2026-11-04 (FD-136) on the operator's decision of 2026-11-04, relayed by Fabric's session
`5d9bed98`: anonymous usage and error data, on by default for new installs and installs already out, a notice at
the first launch, turned off in Settings for each product on its own. Code: [`src/core/analytics.ts`](../src/core/analytics.ts),
tests: [`test/analytics.test.ts`](../test/analytics.test.ts), scenario: [SCN-091](ux/scenarios.md#scn-091-learn-that-anonymous-usage-and-error-data-is-shared).
The approach is the organization's: Fabric's `apps/desktop/src/main/analytics.ts` and Fabric Inbox's B-200.

## On by default, off for this product

- **On by default.** A settings file without the switch reads it as on (`merge` in `src/core/settings.ts`), so an
  install that ran an earlier version shares from its first start on this one.
- **The notice.** The first time the window shows in a build that can send, a dialog says what is shared and what
  never is, with OK and Turn off. It is shown once (`analyticsNoticeSeen` in `settings.json`).
- **Off, for this product alone.** Settings → Privacy → *Share anonymous usage and error data*. Off drops every event
  still waiting, and nothing more is queued or sent. The shared `installation.json`'s `analytics` field does not turn
  this product off (B-200): it holds only the shared id here.

## What is sent

Every event carries the app version, the OS name and version, the locale, the Electron version, the SDK tag
`fabric-dashboards-analytics@1`, a session id and `props.environment`: `production` for a release build of a release
version, `sandbox` for a pre-release version, a key set by hand outside GitHub Actions, a development run or a run on a
CI runner. Aptabase's dataset follows it (`isDebug` exactly when not production). With the shared file readable, every
event also carries `props.install_id`, repeated as `props.iid`.

This table is the app's event catalogue: a name keeps its meaning, a new meaning gets a new name, and a retired event
stays listed with its date.

| Event | Status | When | Props (besides `environment`, `install_id`, `iid`) | Code |
|---|---|---|---|---|
| `app_installed` | live since 0.8.19 | the first start with the switch on (once; `installedAt` in `analytics-state.json`) | `first_passioncode_app` (this app made the shared file), `agents_local`, `agents_online` | `src/core/analytics.ts` `started` |
| `app_updated` | live since 0.8.19 | the first start of a new version | `from`: the version that ran before | `src/core/analytics.ts` `started` |
| `app_started` | live since 0.8.19 | every start | `launch`: `ordinary`, `login` (opened hidden at login), `link` (a `fabric-dashboards://` link) or `background` (the lifecycle broker's `--background`, since 0.8.20); `agents_local`, `agents_online` | `src/electron/main.ts` (usage-analytics) |
| `app_active` | live since 0.8.19 | once per UTC day while the app runs, window open or not (checked a minute after start, then hourly) | `agents_local`, `agents_online` | `src/electron/main.ts` (usage-analytics) |
| `app_error` | live since 0.8.19 | a crash the app noticed, once per launch for each `where` and `code`: the main process's uncaught exception (watched with `uncaughtExceptionMonitor`, so its default handling stays), the window's renderer or a helper process gone for a reason other than a clean exit | `where`: `main`, `renderer`, `gpu`, `utility`, `zygote` or `unknown`; `code`: the error's code or name, or the process's reason (letters, digits, `_.-`, at most 40) | `src/electron/main.ts` (usage-analytics) |
| `action_failed` | live since 0.8.20 (FD-141) | an action that did not succeed, not a crash, once per launch for each `action` and `code` | `action`: `start`, `stop`, `restart` (an agent), `doctor`, `update` (an agent's own command), `self_update` (this app's update check, download or verification), `console` (a console start refused), `rename`; `code`: the result's reason code (`result.placedElsewhere`), `refused`, `timeout`, `not_started`, `exit_<n>`, the console's reason (`no-runtime`, `admission_disk`) or the update's failure code (letters, digits, `_.-`, at most 60) | `src/electron/main.ts`, `src/electron/console.ts`, `src/electron/updater.ts` |

**Never sent:** an agent's name, key, origin or repository, a folder or file path, an e-mail address, a token, what an
agent printed or said, a console's input or output, an error's message or stack. `cleanProps` keeps numbers, booleans
and a fixed list of kinds; any other string is dropped (*a crash is counted once per launch … anything that could name
something is dropped*).

## The shared installation id

All PassionCode apps share one file: `~/Library/Application Support/PassionCode/installation.json` on macOS,
`%APPDATA%\PassionCode\installation.json` on Windows, `$XDG_CONFIG_HOME/PassionCode/installation.json` (else
`~/.config/…`) on Linux. Whichever app starts first creates it once (a temporary file hard-linked into place, so two
apps starting at the same moment end with one id); a file that does not parse is never repaired, and the events then go
without an id. It is read only while this product's switch is on.

## Delivery

Batches of at most 25 to `POST /api/v0/events` with the `App-Key` header, through Node's `fetch` in the main process.
Transport errors, `429` and `5xx` keep the batch; the next try waits 60 s, then 10 min. `400` and `404` drop it. At most
200 events wait, in memory only; an event older than 23 hours is dropped (the server refuses a day-old one). Each send
is one `analytics.flush` line in `main.log` with its outcome and count, never a value.

## Which builds send

Only a release build: `scripts/analytics-bundle.mjs` writes `analytics.json` (`appKey`, `host`, `debug`) into the app's
resources when `FABRIC_DASHBOARDS_ANALYTICS_APP_KEY` and `FABRIC_DASHBOARDS_ANALYTICS_HOST` are set. The release
workflow sets them only for a `v*` tag, from the secret `FABRIC_DASHBOARDS_ANALYTICS_APP_KEY` and the variable
`FABRIC_DASHBOARDS_ANALYTICS_HOST` (set 2026-11-04 to the organization's server, `https://analytics.passioncode.ai`, as for Fabric, Fabric Inbox and Switchboard, PLAT-132); the source names no host. Source builds, `npm start`, the tests and a rehearsal
carry no key and send nothing, and Settings says so. The App Key comes from the organization's vault slot (`passioncode-platform/prod`)
`APTABASE_APP_KEY_FABRIC_DASHBOARDS`, put into the repository's secret with Observatory's `use_secret.py run`, never
printed.

**Registered 2026-11-04:** the Aptabase app *Fabric Dashboards* on the organization's server (created with the
platform's `app.sh`, a Debug probe answered 200), its key in the repository secret `FABRIC_DASHBOARDS_ANALYTICS_APP_KEY`
(taken from `passioncode-platform/prod` through `use_secret.py`, never printed). 0.8.19 is the first release that
sends. growth registered `fabric-dashboards` but reads only the personal server, so its numbers stay empty until it
reads the organization's (growth's backlog); until then read the counts in the organization's Aptabase dashboard.
