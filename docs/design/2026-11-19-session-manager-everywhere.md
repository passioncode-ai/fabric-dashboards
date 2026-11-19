# One session manager on every machine, whichever product is installed

Status: proposal, 2026-11-19 (FD-352). Owner of the engine: Fabric Switchboard. Hosts: Fabric Dashboards, Fabric.

## What the operator asked

The operator, 2026-11-19, in this repository's session (verbatim, the part this design answers):

> «В менеджер сессии это должно ставиться видимо в любой софт, который я ставлю. Допустим, в Fabric Dashboard я поставлю
> только и все. И у меня все равно менеджер сессии должен ставиться, хоть и свитчборда может не быть. … давай раскидаем
> сейчас такой сетап, типа что мы строим свитчборд еще прямо в дашборды, свитчборд вот этот сервер, типа внутрь
> фабрика, во все раскидаем, и что будет первое запускаться, то пусть запускается, чтобы оно не дублировалось, не
> конфликтовалось грамотно, но зато любой софт будет поднимать менеджер сейс и с ним можно будет работать и пусть просто
> устанавливается пакетом»

So: the session manager comes with any of our desktop products; the copies never run twice or conflict; whichever starts
first runs it; the standalone Switchboard and the copy inside a product are the same thing; one package installs it.

## What exists today (read 2026-11-19)

- The session manager is Switchboard's engine, one binary (`switchboard`, linked to `~/.local/bin/switchboard`, inside
  `Fabric Switchboard.app`). Its owner process holds the vault, the inference proxy and the CLI control listener: the
  app's window, or `switchboard serve` with no window (`switchboard --help`: "Own the vault, inference proxy and private
  CLI control listener"; `launch`, `login`, `dispatch` and `continue` need "a running desktop app or serve").
- A machine that runs only `serve` updates with `switchboard update`.
- Fabric Dashboards does not ship the engine: it finds an installed `switchboard` (`findSwitchboard`,
  `src/core/switchboard.ts`) and, where none is installed, starts coding agents on their own sign-in and lists sessions
  from its own consoles only. Fabric starts board runs with `switchboard dispatch`.
- A machine without an owner process or without an account for a folder's group cannot take a session. Measured the
  same day: a New session on Mac Studio ended at once with Switchboard's "Select an account for this provider first",
  because every group there except the default holds no account (FD-352).

## Proposal

1. **One engine, many carriers.** Dashboards and Fabric ship Switchboard's signed binary in their bundles
   (`Contents/Resources/bin/switchboard`, its version pinned in the bundle's manifest). The standalone app stays.
   Every carrier runs the same binary, so they are one thing.
2. **One owner, first come.** The owner is `switchboard serve` (or the Switchboard window, which is the same owner). At
   start, each product asks whether an owner answers (`switchboard --json status`); if one does, it uses it and starts
   nothing. If none does, it registers `serve` as a launchd job of this user (ADR-0002: launchd is the only supervisor)
   with the newest binary installed on the machine (the standalone app's when present, else the newest bundled copy).
   Switchboard's own owner lock in its data folder refuses a second owner, so two products starting at once still end
   with one.
3. **One data folder.** Every carrier uses Switchboard's data folder (`~/Library/Application Support/ai.passioncode.fabric-switchboard`),
   so accounts, groups and sessions are the same whichever product started the owner.
4. **Newest wins, never a downgrade.** A newer carrier finds an older owner running: it asks the owner to hand over at its
   next quiet moment (Switchboard's restart wave, which never ends a turn mid-way) and the launchd job is pointed at the
   newer binary. An older carrier never replaces a newer owner. Data migrations stay Switchboard's.
5. **One package.** The PassionCode launcher (`npx @passioncode-ai/passioncode setup`) installs Dashboards, Fabric and the
   engine in one step, and a product installed alone still brings the engine. Its doctor checks that exactly one owner
   runs and that every group with folders holds an account.
6. **Other machines.** A remote target needs an owner there and an account for the folder's group. Dashboards says so
   before it starts the session, from `switchboard remote status <machine>` (groups and their accounts), instead of
   starting a session that ends at once.

## Who does what

| Product | Work |
|---|---|
| Fabric Switchboard | A binary signed for embedding and its version manifest; `--json status` answering whether an owner runs and its version; the owner lock and the hand-over to a newer binary; attributing a process it did not launch by its config home (FD-352: 31 of 41 live sessions on this Mac had no account) |
| Fabric Dashboards | Bundle the binary; at start, find or register the owner (launchd job); refuse a remote start whose group there holds no account, naming it; show which carrier runs the owner (Settings, Setup) |
| Fabric | The same start rule as Dashboards; `dispatch` through the owner, whoever started it |
| PassionCode launcher | One setup step; the doctor's checks above |

## Open questions

- Signing and notarizing a binary inside another product's bundle (each carrier signs with its own team ID today).
- Update channel: each carrier's updater carries its bundled copy; the owner always runs the newest binary on the machine.
- Which account serves Mac Studio's groups is the operator's decision (FD-352); this design only makes the gap visible
  before a start.
