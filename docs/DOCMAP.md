# Doc map: Fabric Dashboards

The four questions of task-pipeline's documentation doctrine, answered for this repository: where settled things
live, what each fact's single home is, what a change obliges, and what proves it. Seeded 2026-10-24 (it was the one
setup gap the routing block named). Where another file already says a thing, this one holds a pointer, not a copy.

## Regime

`governed`, established 2026-10-24. Decisions are ADRs; the decision that set this map is recorded in the backlog
row that seeded it (FD-99).

## Registers

| Register | File | ID scheme | Append-only? | Guarded? |
|---|---|---|---|---|
| Decisions | `docs/adr/NNNN-<slug>.md` | `ADR-NNNN` (amendments dated inside the ADR) | yes: a change is an amendment | lease (`docs/adr/*.md`, [AGENT_SYNC.md](AGENT_SYNC.md)) |
| Tasks | [backlog.md](backlog.md) | `FD-NN` | yes: closed rows stay with their receipt | lease |
| User-facing behaviour | [ux/scenarios.md](ux/scenarios.md) | `SCN-NNN` | rows retire, never vanish | none |
| Handoff | [HANDOFF.md](HANDOFF.md) | dated sections, newest first | yes | lease |
| Releases | [../CHANGELOG.md](../CHANGELOG.md) | `## <version> - <date>` | yes | lease |
| Retrospective | [evidence/retro.md](evidence/retro.md) | standing instructions, run stamps | yes | none |

## Single source of truth

| Fact | Home | Everything else |
|---|---|---|
| A settled decision | `docs/adr/` | cites `ADR-NNNN` |
| The terms | [../CONTEXT.md](../CONTEXT.md) | uses the term as defined there |
| What a person can do and see | [ux/scenarios.md](ux/scenarios.md) | cites `SCN-NNN` |
| The version | `package.json` `version` | CHANGELOG section, AGENTS.md "current version" |
| What runs, when, and the idle budget | [../AGENTS.md](../AGENTS.md) §Lifecycle | `test/lifecycle.test.ts` names the rule ids |
| Token rules | [../SECURITY.md](../SECURITY.md) and AGENTS.md §Local rules | the code fences them in regions |
| How a release is made and re-run | [RUNBOOK.md](RUNBOOK.md) §Release | `.github/workflows/release.yml` |
| The state order shared with Fabric | `packages/service-host/test-vectors/state-precedence.json` | ADR-0006 |
| Contract fixtures and where they come from | `test/fixtures/contract/SOURCE.txt` | never edited here |
| Brand files | `src/renderer/brand/`, pinned in [brand-source.json](brand-source.json) | never edited here |
| A cross-repository fact (a product, version, plan row) | fabric-workspace `knowledge/` | this repository links to it |

## Propagation matrix

| Change type | Update these | Checked by |
|---|---|---|
| **A new document or rule** | AGENTS.md §Where things live (or this map), and the index a reader opens | review: an index is read, not parsed |
| User-facing behaviour | `docs/ux/scenarios.md` in the same change (CONTRIBUTING.md) | `python3 docs/ux/lint.py` (in `npm run check`) |
| An interface string | `src/core/i18n.ts`, English and Russian | `test/parts.test.ts` *every interface string exists in English and Russian*, *no interface string carries an em dash* |
| A feature, module or special condition in code | a `// #region <slug> — docs: <path>#<anchor>` fence | `node scripts/check-regions.mjs` (in `npm run check`) |
| The state order | `test-vectors/state-precedence.json` in the same change | `packages/service-host/test/state.test.ts` (the shared vectors) |
| A process, timer or file the app writes | AGENTS.md §Lifecycle table | `test/lifecycle.test.ts` |
| A release | `package.json` version, CHANGELOG section, AGENTS.md current version, HANDOFF, backlog rows; then fabric-workspace `knowledge/products.md` and `roadmap.md` | `release.yml` job `version` (tag = version, CHANGELOG section); fabric-workspace `npm run check:releases` |
| A contract fixture copied in | the file byte-identical, a line in `test/fixtures/contract/SOURCE.txt` | review: byte identity is checked by `cmp` at copy time |
| A brand file | the canonical file on the website first, then the copy and its pin | `node scripts/check-brand.mjs` (in `npm run check`) |
| A role, dependency or test command of this repository | its row in org-index `repositories.json` | review: lives in another repository |

## Gates

| Gate | Command | When | Blocking? |
|---|---|---|---|
| The gate | `npm run check` (typecheck, unit and integration tests, brand pins, code regions, UX lint) | before every commit that lands | yes |
| End to end | `npm run test:e2e` | before a release, and a change to a shared screen runs the whole suite | yes; refuses on a locked screen or a loaded machine (load above 150, under 5 GB free), runs one file at a time ([CONTRIBUTING](../CONTRIBUTING.md#end-to-end-tests)) |
| Five systems | `gh workflow run validate.yml --ref <branch> -f os=all` | before a release (and nightly) | yes |

`npm run check` does not cover a real window (the e2e), Windows or Linux (validate.yml), or the signed bundle
(release.yml's receipts). It does not check that prose is true: that is review against the code.

## Ratchets

None declared yet.

## Terms

[../CONTEXT.md](../CONTEXT.md) is the only glossary; terms from the Fabric Agent Contract keep their meaning there.
