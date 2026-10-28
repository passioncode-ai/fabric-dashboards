# FD-117 brief: the agent fallback chain in Settings

Run: `fd-117-fallback` · started 2026-10-28 · task-pipeline 1.99.1, full flow (user-facing, more than five files) ·
model: the session's (Opus 5.5), every stage · branch `feat/fd-117-fallback` · surface_class: `product`.

## Objective

The operator, 2026-10-25 (FD-117, `docs/backlog.md`): «нужно сделать понятную в интерфейсе настройку ... фоллбека, с
какого агента на какой агент пробрасывается, какие там модели включаются в каком агенте ... дефолтный этот, фоллбек ...
уровень один этот, два этот ... два уровня фоллбека и выбор моделей. Продолжение следует». A clear Settings screen
for which agent works first, which agents take over in order when its accounts run out, and which model each runs on.
The continuation was not received by 2026-10-28; the coordinator (fabric-workspace-7f, relaying the operator 2026-10-28:
«выпустить максимально качественные версии ... остальное по плану») put the board's open P1 rows next. Decision: build
version 1 from the 2026-10-25 words; the continuation amends it.

## Source ledger

| Source | Read | What it says |
|---|---|---|
| `docs/backlog.md` FD-117 | 2026-10-28 | operator words; Switchboard's chain is the source of truth, this app shows and edits it |
| fabric-switchboard `docs/CLI.md` §Fallback chains, §Installed agents and the default agent, §Hermes, §OpenRouter (`40efec3`) | 2026-10-28 | chain per machine, group (pool) or workflow; narrowest applies; none applies until set; at most 8 executors; `agent@ACCOUNT` and `agent#vault/NAME` pins; default agent is Auto or one of the five that take over work |
| `switchboard 0.6.83 --json chain list`, `agents status`, `agents openrouter list`, `agents hermes` on this Mac | 2026-10-28 | shapes below; `agents hermes` may answer `configured: false` with an error |
| `src/core/switchboard.ts`, `src/electron/console.ts` (`readHandoversSwitch`), `Settings.tsx` (Sessions) | 2026-10-28 | the CLI runner, the IPC pattern and the Sessions section to sit beside |
| `docs/evidence/retro.md` (8,544 bytes, read in full) | 2026-10-28 | rule 8: typecheck before a commit |
| Fabric board, transcripts (`фоллбек`, `продолжение`) | 2026-10-28 | no continuation found |

Contradictions: the operator says «два уровня»; Switchboard allows up to 8 and this Mac's machine chain has 3
(claude-code, kimi-code, hermes). Resolution: show every level the chain has and let levels be added up to
Switchboard's 8, so a third level is never lost; the first two are what the operator named.

## Decisions (autonomy sweep; the operator's standing «act, then report»)

- D1 Place: a new Settings section «Fallback» (Запасные агенты) right after Sessions, in the index.
- D2 Default agent = Switchboard's default agent (`agents default <id>|auto`); levels = the machine chain in order.
  They are separate in Switchboard and stay separate here, each with one sentence saying what it decides.
- D3 Model per level: Claude Code, Codex, Kimi Code run on their accounts' models (read-only text); OpenCode on the
  OpenRouter key's default model; Hermes on its own model when it runs on OpenRouter, else the key's default. The
  OpenRouter default model and Hermes's model are editable from a list (`agents status` recommended models plus the
  current id); the screen says the choice applies to every use of that agent on this Mac.
- D4 Scope of version 1: the machine chain. Groups and workflows with their own chain are listed read-only
  («NG Business has its own order»); editing them is a later row.
- D5 Pins: shown read-only next to the agent; kept when the level's agent is unchanged, dropped when it changes.
- D6 Offered agents: installed, enabled, and able to take over work (`switchable`). A saved level whose agent is no
  longer offered stays shown with why.
- D7 Writes: `switchboard --json chain set <agent…>`, `chain clear --scope machine` (no levels), `agents default`,
  `agents openrouter model`, `agents hermes set --provider openrouter --model`. One write per change, the screen
  re-reads after each; a refused write shows Switchboard's own sentence.
- D8 No Switchboard, or one without `chain`: the section says what it needs and links nothing to install.
- D9 Dashboard parity: Switchboard's MCP already has `switchboard_chain_set`, `switchboard_agent_set`,
  `switchboard_openrouter_model`, `switchboard_hermes_set`; this app adds no MCP twin (recorded in the scenario).

## REQ

| ID | Requirement | Check |
|---|---|---|
| REQ-1 | Settings shows the default agent and every level of the machine chain in order, with each level's model | unit test of the model; e2e with a fake `switchboard` |
| REQ-2 | Choosing the default agent writes `agents default` and the screen shows the new value | unit (argv) + e2e |
| REQ-3 | Changing, adding (up to 8) and removing a level writes `chain set` (or `chain clear` for none) in the shown order, keeping pins of unchanged agents | unit (argv) + e2e |
| REQ-4 | The OpenRouter default model and Hermes's model can be chosen; the screen says it applies to the agent everywhere | unit (argv) + e2e |
| REQ-5 | Groups and workflows with their own chain are listed read-only | unit |
| REQ-6 | No Switchboard, an old one, a refused write or a Hermes that does not answer each read as a sentence, never a blank | unit + e2e |
| REQ-7 | Every string in English and Russian, copy-checked; scenario, terminology, CHANGELOG, backlog in the same change | `npm run check` (parity, lint), copy check report ids |

## Finish line

Exit checks on the artefact the operator uses: `npm run check` green; the new e2e file green alone on this Mac;
the screen read in a screenshot in both languages; released in the next version and seen on the installed copy.
Budget: this session. Base: `main` at `7ec46e0` or later.
