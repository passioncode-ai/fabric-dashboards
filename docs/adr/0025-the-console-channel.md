# ADR-0025: The console channel, the one way into the running app

Status: accepted, 2026-10-26; built after this record (FD-120: `src/core/console-channel.ts`, `src/electron/console-channel.ts`, the MCP tools `console_new` and `console_fix`, `test/console-channel.test.ts`). Decided by fabric-workspace under the
operator's mandate, MD-12 (board thread `ee3326f5`, message `bc7a8fd6`): option (a), "first the security decision, then
the code". Amends the "listens on no port" promise of ADR-0002's consequences and `SECURITY.md` without breaking it.

## Context

Contract DEC-0121 AP-1: every button a person has, the person's agent has. FD-110 gave the app's own buttons that act
on services (Start, Stop, Restart, Update, Self-check, Open) their twins on the `fabric-dashboards` MCP surface, because
those effects need no running app: the MCP server runs the same `launchctl` verbs and descriptor commands itself. Two
buttons of the agent console cannot be done that way: **New session** and **Fix with coding agent** start a runtime on a
pseudo-terminal that lives in the running app's main process (ADR-0017, ADR-0020). The MCP server is a separate process
started by an agent, and the app listens on nothing: no TCP port (`SECURITY.md`), and its only inbound path is a
`fabric-dashboards://` link, which any web page or local process can fire without proof of who sent it.

The Sessions buttons (Continue, Continue now, Do not continue, Remove) get no twin: the Sessions mode is frozen for fixes
only (Q-08) and moves to Fabric (FD-105), so MD-12 closes them as not needed.

## Decision

1. **A per-user local channel, never a network port.** On macOS and Linux a Unix domain socket `console.sock` in the
   app's data folder (`~/Library/Application Support/Fabric Dashboards/`, PL-06 places elsewhere), the folder 0700 and
   the socket 0600, made by the main process at start and removed at quit. A socket file left by a killed run is
   removed at start only when a connect to it is refused (nobody listens). On Windows a named pipe
   `\\.\pipe\fabric-dashboards-console-<16 hex>` named for the account (its name and profile, hashed), created as the
   first instance (a second server is refused, so no
   process can sit on the name first and catch the client's requests).
2. **A secret on every request.** At start the main process writes 32 random bytes, hex, to `console.key` in the same
   folder (0600 on POSIX; on Windows inside the user's profile, whose ACL keeps it private, as the token rule of
   DEC-0032 reads it). Every request carries it and is refused on a mismatch with a constant-time comparison. The key is
   rewritten at every start, so a key read from an earlier run opens nothing. It is never logged, never in a URL and
   never returned. This is the guard on Windows, where Node cannot set a pipe's DACL and the default lets other
   accounts on the machine open it for reading; on POSIX it backs the file modes.
3. **The only client is the app's own MCP server.** It reads `console.key` from the app's data folder of the same
   install. No other program is told the channel exists; it is not part of any contract.
4. **Two operations, nothing else.** `console.new` (`{key: service key, folder?}`) and `console.fix` (`{key, task}`, the
   auditor's findings as text): the same code path as the buttons, with the same admission (LC-17: free disk, swap,
   at most six sessions), the same folder rules and Switchboard routing. No output of the console is sent back: the
   answer is `{ok, consoleKey}` or a refusal with its code. Requests are one JSON line, at most 64 KB, one per
   connection, read within 5 s; at most 10 a minute, more answer `busy`.
5. **Gate `relayed`, as MD-10.** Both start a program in the person's folder on their account: the MCP tools declare
   them `relayed`, record a valid `_meta.decision` as the operator's in `decisions.jsonl` and refuse an invalid one
   before anything is sent on the channel. A call without a decision runs as the caller's act until the app asks the
   person itself or the hub relays the decision (MD-10, note `acc45a98`).
6. **The app not running is an answer, not a start.** The MCP tool answers `app-not-running` and never starts the app
   (ADR-0002's spirit: the app is the person's).

## Threat model

| Who | Reach today | Through this channel |
|---|---|---|
| A web page in any browser | `fabric-dashboards://` links (only open a page, refused otherwise) | none: a page cannot open a Unix socket or a named pipe |
| Another account on the Mac | none | none on POSIX (0700 folder, 0600 socket); on Windows it may open the pipe for reading but holds no key, so every request is refused |
| A process of the same user | the token files, `~/.claude.json`, the console itself | the same as today: it can read `console.key` as it can read every token file; `SECURITY.md` already defends against pages and mistakes, not against hostile code running as the operator |
| A stale key from an earlier run | none | refused: the key is rewritten at each start |
| A flood of requests | none | 10 a minute, one request per connection, 64 KB, 5 s, then refused |

## Rejected

- **A TCP port on 127.0.0.1.** A web page can send requests to it (simple requests need no CORS answer; DNS rebinding
  reaches it by name), which is why the app listens on none.
- **Actions through `fabric-dashboards://` links** (MD-12 option b). Any page or process could fire them.
- **A request file the app watches.** Ordering, partial writes and who wrote it are all harder to prove than on a socket
  with a key.

## Consequences

- `SECURITY.md` keeps "Listens on no port" and, once the code lands, names the socket or pipe, its key and the two
  operations; AGENTS.md's lifecycle table gains its row (made at start, removed at quit). Until then the app has no
  channel.
- FD-120: the Sessions part is closed as not needed (MD-12); the console part is built, with tests for a wrong key, a
  socket a killed run left, a live channel never taken over, a new key per run, the size and rate limits, and the MCP
  tools with the app closed. A socket path longer than macOS allows (104 bytes) leaves the channel closed, logged.
