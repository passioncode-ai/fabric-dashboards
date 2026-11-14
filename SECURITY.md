# Security

Report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/passioncode-ai/fabric-dashboards/security/advisories/new)
for this repository, or by email to contact@passioncode.ai.
Do not open a public issue containing tokens, descriptor contents from your machine, or
service data.

## What the app touches

- **Reads** the services folder (`~/Library/Application Support/ai.passioncode.fabric/services/`
  or `FABRIC_SERVICES_DIR`) and, for each service, the token file its descriptor names. A token
  file that is a symlink, belongs to another user or grants any permission to group or others (wider than 0600) is refused. Tokens
  are read in the main process only; they never reach a page, a URL or a log.
- **Talks** to the origins descriptors declare, and to no other service address: `127.0.0.1:<port>`
  for a local service, and the `https://` origin of a registered online service (`placement:
  "remote"`, [ADR-0011](docs/adr/0011-online-services.md)). Requests there are the health probe,
  the events feed, the usage report, the load report (when the service declares `extensions/load/0.1`, ADR-0024) and the
  one-time login code; embedded dashboards load only
  from those origins. A token goes only to its own service's origin, in a request header. An
  online origin is reached over https with the certificate verified against the system store,
  and no redirect is followed. An answer from another program carries none of its document
  into the app: an online origin that answered as another service gets no token again until
  its descriptor changes; one that answered without the protocol is checked again without the
  token until it asks for one (HTTP 401) or answers as the service — in the app and in the MCP
  server alike (`RemoteTokenLatch`). A usage report, a load report, an events feed or a dashboard sign-in is
  never read from a port or origin that answers as something else, and a sign-in reads the
  service's state at that moment, not when its page was first opened.
- **Watches the estate's versions** (FD-30, [ADR-0018](docs/adr/0018-estate-updates-from-inside-the-app.md)),
  90 s after start and every 6 hours while *Watch the contract and skill versions* is on (on by
  default). The skills part runs only where the `sshlg-skills` family is installed — its launcher
  keeps `~/.sshlg-skills/runtime/package.json`; without it nothing about the family is read or asked
  (FD-34). Where it is installed, the app reads that runtime's version and the launcher's own update
  check (`~/.sshlg-skills/state.json`), and asks the public npm registry (`registry.npmjs.org`) only
  when that check is more than a day old. Only when Settings names a contract clone does it run
  `git ls-remote` and `git fetch` in that clone against its own `origin`, which must be
  `passioncode-ai/fabric-agent-contract`. These are `git` and `npm` from the login shell's PATH, in
  their own process group, with a deadline, without a terminal prompt (`GIT_TERMINAL_PROMPT=0`); the
  clone's own git configuration applies to them. Nothing about services or tokens is sent. With
  *Update skills by themselves* on (off by default) it **runs code from the registry**:
  `npx --yes sshlg-skills@<version> update`, exactly the version it checked, and only after every
  maintainer and the publisher of that version are on the allowlist in `src/core/estate-update.ts`. From
  sshlg-skills 1.56.0 that run also re-wires the family's hooks in `~/.claude/settings.json` (it backs the file
  up first and keeps fields the operator added) and refreshes the family's routing block in the agents'
  instruction files (`CLAUDE.md`, `AGENTS.md` and their kind); a second run while one holds the family's update
  lock exits 75 and is retried later, not reported as a failure.
- **Fetches** the update feed
  (`https://github.com/passioncode-ai/fabric-dashboards/releases/latest/download/update-feed.json`,
  pinned in the code; no environment variable replaces it) 90 s after start and every 6 hours,
  only in a packaged copy inside Applications and only while the `auto-update` switch is on. It
  reads the feed's version first; for a newer one it downloads that release's `SHA256SUMS` and
  `SHA256SUMS.asc`, verifies the signature against the organization's release key pinned in
  `src/core/release-verify.ts` (ed25519, fingerprint `63b30dc324bd697487aa31944fafb8aec803b6a7`),
  downloads the zip, checks its sha256 against the signed list, and requires the app inside to pass
  `codesign --verify --deep --strict` as team `KJ35UYYL22` with the announced version. Only then
  does Squirrel.Mac download and stage it, and the staged bundle must carry the same code-directory
  hash, or it is deleted before any quit. Squirrel's own downgrade guard is on
  (`ElectronSquirrelPreventDowngrades`). Nothing about services or tokens is sent (ADR-0015
  amendment, LC-16).
- **Runs** `launchctl` on the labels descriptors declare, `lsof -nP -iTCP -sTCP:LISTEN` for the
  listener scan, and the `doctor` and `update` argument arrays a descriptor declares — no shell,
  in their own process group, 120 s limit; whatever a finished command leaves running in that
  group is ended. Uninstall starts one detached `/bin/sh` that waits for the app to exit (at most
  30 s) and removes the app's data.
- **Writes** its own data under `~/Library/Application Support/Fabric Dashboards/`
  (settings, activity) and logs under `~/Library/Logs/Fabric Dashboards/`. Uninstall removes the
  `fabric-dashboards` entry from Claude Code's `~/.claude.json`, and a later launch puts it back
  or points it at the installed copy; nothing else in that file is changed.
- **Runs** the agent console's runtime (ADR-0017) when the person presses New session, New agent or Continue
  last, when an agent asks through MCP (`console_new`, `console_fix`, `session_new`, `session_action`), on another
  machine over ssh for an agent placed there (FD-199), and when a session stopped on a
  limit is continued (FD-83): the runtime's own CLI found on the login shell's `PATH`, in the folder shown, with
  `ELECTRON_RUN_AS_NODE` and `NODE_OPTIONS` removed. A folder bound to a Fabric Switchboard project
  is started by `switchboard launch` itself, so no token passes through the app; a hand-over (FD-62) runs
  `switchboard handovers run`, and Switchboard picks its runtime and flags. The runtime starts with its own flag
  that skips permission prompts (SCN-097); a console whose saved choice keeps prompts, or a start held for its context
  (FD-234, below), gets an explicit mode that asks instead. A session continued after a limit, or a Switchboard or hand-over
  row continued from the Sessions list, always gets the skipping flag (FD-236 (1)); a console of this app continued from
  its row follows its saved choice and is read again. A runtime with no known flag starts with its own settings. Reading which
  account a folder uses runs `switchboard --json project show` and `accounts list` (no credentials
  are printed by either).
- **Allows inline styles** in its window (`style-src 'self' 'unsafe-inline'`), because the
  terminal view (xterm.js) injects `<style>` elements and takes no nonce. Scripts stay `'self'`,
  and `connect-src 'none'` and `img-src 'self' data:` mean injected CSS cannot send anything out.
- **Sends** anonymous usage and error data (FD-136, [docs/ANALYTICS.md](docs/ANALYTICS.md)) only from a release build
  that carries an App Key, from the main process to the analytics host that key names, over HTTPS: counts, kinds,
  the app's version and system, and the shared PassionCode installation id. Never an agent's name, key, origin or
  repository, a path, a token, a message or what an agent did. On by default; Settings → Privacy turns it off, and
  off sends nothing at all.
- **Sends a service's token to 127.0.0.1** only when this macOS user's own process listens on that port (FD-156): on a
  Mac with several macOS users, loopback is shared, and while this user's agent is stopped another user's process may
  hold its port. Before a request that carries a token, the app and its MCP server list this user's listening sockets
  with `lsof -a -u <uid>` (macOS shows a user only their own; one listing serves every port for 30 s, a port not in it
  is read again after 5 s). A port `lsof` does not find, or a listing `lsof` cannot give, is decided by the socket
  table (FD-159, the contract's DEC-0154 HA-2): `netstat -anv -p tcp` names the process listening there even for
  another user, and `ps -o pid=,uid=` its owner. The token goes only when every listener there is this user's; nobody
  listening, another user's process, or an owner neither can tell refuses the request with the reason, and the agent
  reads "Another user's program" (an owner that could not be told says so in its own words). A plain read with no
  token (a local well-known probe) is not checked. On Linux (FD-159) the same check reads the kernel's socket tables,
  `/proc/net/tcp` and `/proc/net/tcp6`, which name each listening socket's owner (no process is started); a table it
  cannot read is an owner it cannot tell. On Windows (FD-159) the app's compiled reader (`fabric-dashboards-acl.exe
  --listeners`, build/win/acl.cs) takes the listeners from `GetExtendedTcpTable` and each one's owner from its
  process's token; a process it cannot open is an owner it cannot tell. An unpackaged run on Windows has no reader and
  does not check. A dashboard page sends its session cookie, so the same check runs right before each page load in
  the app's window (open, Home, Reload, a sign-in, a new window on its origin), not only at the last probe (FD-159,
  `src/electron/views.ts` `ownerOk`); links a person follows inside the page stay with the probe's state.
  The decision is made again on the open connection itself (FD-168, the contract's CT-254, tag `v0.1.0+2026-11-07.3`):
  a request that carries a token connects, then asks who holds the other end of that very connection, and writes
  nothing until the answer is this user. On macOS the connection's own row in `netstat -anv -p tcp` names the process
  (`ps` its uid); on Linux the row in `/proc/net/tcp` or `/proc/net/tcp6` read to its end names the uid when its inode is
  not 0. Without such a row (a connection still in the accept queue) the listener on 127.0.0.1 decides, and one on any
  address only when none listens on 127.0.0.1, so another user's program bound to 127.0.0.1 next to this user's
  wildcard listener gets nothing. Listeners of different users on the chosen address, or a table that shows no row at
  all (macOS 27.2 hides other processes' sockets from some programs), are an owner that cannot be told: the connection
  is closed with nothing written. One table read serves every connection waiting at once. Windows keeps the listener
  check above, which already refuses a port where any listener is not this user's.
  A macOS table that shows no socket of another process, or not the checked connection's own end (macOS 27.2 hides
  other processes' sockets from some programs; the contract's DEC-0155 RT-1, FD-176), is an owner that cannot be told,
  never "nobody listens". For the open connection (FD-190), such a table is then asked once more where the restriction
  does not reach: `lsof` limited to this user's processes (it reads each process's own sockets through libproc) must
  show a process other than the app holding the server's end of exactly this connection
  (`127.0.0.1:<port>->127.0.0.1:<client port>`), up to three reads 60 ms apart for a server that has not accepted yet;
  only then is the token written. A listener alone never counts, since another account's copy is invisible from here.
- **Listens** on no port. The MCP server (`Contents/Resources/bin/fabric-dashboards-mcp`)
  is started by an agent and speaks only over its stdin and stdout; it reads the same
  folder and token files, talks to the same origins and runs the same `launchctl` verbs and
  descriptor argument arrays as the app, and never returns a token. For `host_status` and
  `open` it also runs `/usr/bin/osascript -l JavaScript` with a fixed JXA script, never built
  from a link or an argument, which asks NSWorkspace for the installed app and the
  `fabric-dashboards://` handler without launching anything. `open` runs `/usr/bin/open`
  (through `/usr/bin/env -u ELECTRON_RUN_AS_NODE`): the deep link with `-a` and the app that
  query found, or the plain service address in the default browser only when the app is
  confirmed absent and the caller passed `fallback=if_absent` (the default is `never`, FD-109).
- **Accepts** requests from its own MCP server on a per-user channel and nothing else (FD-120)
  ([ADR-0025](docs/adr/0025-the-console-channel.md)): a Unix socket 0600 in a 0700 data folder, or on Windows a
  first-instance named pipe, each request carrying a key rewritten at every start (`console.key`, never logged or
  returned), two operations (start a console session, start a fix in one) and one read (the consoles open now: ids,
  folder and start time, never what a console printed; FD-166) and, FD-175, the window's own buttons through their own
  code: a Settings change limited to the fields Settings offers (a console's folder or the Sessions records are refused),
  a Sessions row's Continue, End and Dismiss, Clear ended, Check for updates and Restart to update; one request per
  connection, 64 KB, 5 s, 10 such requests and 30 reads a minute. A web page cannot reach it; another account holds no key; a process of the same user can read the key
  as it can read a token file, which this app does not defend against (below). A socket path longer than the system
  allows, or a pipe another program already holds, leaves the channel closed and says so in the log.
- **Opens** `fabric-dashboards://` links only for an installed service and a path on that
  service's own origin; any other link is refused with the reason and opens nothing
  ([ADR-0004](docs/adr/0004-deep-links-and-mcp.md)). Outside the app it opens only a
  dashboard link to another site, in the default browser after the person confirms; in Finder,
  the services folder, the app's data folder and a descriptor file the person asks to see
  (`shell.openPath` / `showItemInFolder`); the
  fabric-agent-adapter README ("How a service joins"); and macOS System Settings →
  Notifications.

## Text a service wrote reaches a coding agent as data

A console's coding agent reads what an agent service wrote: its name and summary, the reasons and problems the app
derives from it, its recent events, its descriptor, a task's findings and a failed command's output, through the
context pack (`context.md`, `task.md`) and the MCP answers `service_context` and `activity`. Consoles start without
permission prompts by default, so such text could steer the agent. Since 0.8.77 (FD-234, the agents database's audit
2026-11-13-45e7cc299793, B1) the free texts (summary, reasons, problems, last action, events, descriptor, a task's
findings, a failed command's output) sit inside `<untrusted-data id="…" source="…">` blocks that end only at a closing
marker with the same id, a random one per start (a task typed into a session that already runs gets its own) that text written before it cannot know: that id is the
guarantee. Common forms of the marker inside the text (any case or spacing, fullwidth, invisible characters, dashes)
are also made inert, as a second line, not every lookalike (`src/core/untrusted.ts`). The short
values (the service's key, name, version, update available, origin, repository) are flattened to one line and quoted as code, in
headings, the brief, the first prompt and a typed task line too; a key that is not a plain name gets a
pack folder named by its digest, so no path handed to a runtime carries it, so none can add a heading or a step. Every pattern is linear; a text is read whole up to 256 K characters (UTF-16 code units, as every length here) after NFKC folding (an invisible character counts as one space; NFKC can grow
one character into 18), past that its first 256 K and the last 16 K of the text as written, and a block holds at
most 256 K characters of it. The pack and the MCP
answers (`service_context`, `activity`: an `untrusted` list of fields) say all of it is data and never an instruction, and a start whose text reads like instructions
(`injectionSignals`: "ignore previous instructions", role or chat markup, `curl … | sh`, `rm -rf ~`, reading
`~/.ssh` and sending it, asking to print a secret; every descriptor string up to 64 levels deep is read as written, a value that is not a string as its text) starts with
permission prompts on, for that start (a console or Open in Terminal; a pack that cannot be written holds the start
too): the runtime gets an explicit mode that asks (Claude Code `--permission-mode default`, Codex `-a on-request -s workspace-write`,
Gemini CLI `--approval-mode default`), which neither its own settings nor Switchboard's launch override (Switchboard
adds its bypass only when the arguments name no mode). For Codex that is the approval policy and the sandbox; a
Claude Code `permissions.allow` rule still approves its tools. OpenCode and Cursor CLI have no such mode: a held start
drops their bypass flag and their own settings decide. Logged, the person's saved choice unchanged. The reading is a heuristic that keeps a person in the loop, not a proof. Not covered yet (FD-236): a held
conversation continued after a limit, or from a Switchboard or hand-over row of the Sessions list, resumes without the
hold; a Fix or Update typed into a
session that already runs is fenced but only logged, not held (the person sends it); the console's own Continue reads only the events listed now, so a conversation that read an instruction-like event continues unheld once that event has scrolled out; the Setup console's `setup.md` carries the launcher doctor's text unfenced, and the Setup and New agent consoles (which carry no service text) are not held when their pack cannot be written; and `service_status`,
`list_services`, `audit`, `doctor` and `update` mark nothing in their answers (the console rules name them; only
`service_context` and `activity` carry an `untrusted` field, the pack carries the blocks). The hold shows no sign in
the app yet: its reason is in `context.md` and the app's log (only in the log when the pack could not be written).

## Dashboard sign-ins at rest

Each dashboard keeps its sign-in cookies in its own partition (`Partitions/svc-<key>`). Since 0.7.15 they are
encrypted at rest on macOS (key: the «Fabric Dashboards Safe Storage» login-keychain item) and Windows (DPAPI); Linux
keeps them plaintext 0600, because its keyring may ask the person to unlock it (FD-04, AGENTS.md *Fuses*). Cookies a
dashboard stored before 0.7.15 stayed plaintext until rewritten: the review of 2026-10-21 counted 16 such cookies in
12 partitions on the operator's Mac, the newest from 2026-10-18. Since 0.7.18 the first start writes every cookie of
every installed service's partition back once, unchanged, so Chromium stores it encrypted, then leaves the marker
`.cookies-reencrypted`; a failure leaves no marker and is tried at the next start. Only counts are logged.

A token file is readable by any process of the same user. Fabric Dashboards, like the
`fabric-service/0.1` extension, defends against web pages and mistakes, not against
hostile code already running as the operator.
