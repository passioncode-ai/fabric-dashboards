# Agent map: three variants to choose from (FD-363 step 1)

Status: proposal, 2026-11-21. Nothing in the app changes with this folder. The owner picks a variant; step 2 builds it
as a new version of the page beside the present one.

## The order

The owner, 2026-11-21 about 02:50 Warsaw (Fabric's CEO window, session `53895bdc`, relayed in board request `d1f4d769`,
thread `ab0e101f`): «карту агент ов улучшить видуализаиб как у CRE», «как у CRE агента который за уязвимостями
следит», and at about 02:52 (message `a6892b0e`): «в целом можешь сам придумать как показать красиво и динамично».

He asked for variants, so this is a trial order: the most choice with pictures, then his pick (the FD-363 row in
[the backlog](../../backlog.md)).

## What is wrong today

The map (SCN-074 step 2, `src/renderer/components/ConnectionsMap.tsx`) lays agents out in columns and draws every
connection as a standing line (`src/core/estate-map.ts`). On the owner's screenshot (67 agents in 5 columns, 47
declaring connections) the lines cross the cards and each other and cannot be read.

## How to open

Open `index.html` of this folder from a checkout of the repository (the pages link the vendored brand tokens at
`src/renderer/brand/fabric-tokens.css` by a relative path, so they are opened in place, not copied out):

```sh
open -a Safari docs/design/2026-11-21-agent-map-variants/index.html
```

| File | What it is |
|---|---|
| `index.html` | the three variants side by side in words, with a comparison table, in Russian for the owner |
| `a-lanes.html` | variant A, lanes |
| `b-constellation.html` | variant B, constellation |
| `c-matrix.html` | variant C, matrix |
| `shared.js` | the invented estate (67 agents, 47 declaring, 86 connections, a fixed seed) and the frame the three share |
| `shared.css` | the frame's styles, brand token roles only |

The data is invented and the names are neutral. No page reads a real machine, loads anything from a network or needs
a build.

## The rubric, written before the variants

A variant is acceptable only if all of these hold on the 67-agent sample:

1. At rest no line crosses an agent.
2. What waits for the person and what does not work are on screen without any interaction, above or beside the map.
3. One agent's connections are readable after one hover or one keyboard focus, and the same facts are given in words.
4. Groups by organization are visible; the machine an agent runs on can be read.
5. An agent's state is a shape and a colour, never a colour alone (the app's glyphs: ● ◐ ✕ ○, ◆ for what waits).
6. A call is shown as a short pulse, not a standing line.
7. With reduced motion, or with the Motion switch off, the page is still and loses no fact.
8. The counts line, the coverage line and the organization filter (FD-162) stay; the Problems rows and Fix with coding
   agent stay under the map as they are.

## The three variants and how each differs

| | A. Lanes | B. Constellation | C. Matrix |
|---|---|---|---|
| Layout | a row per organization, a column per machine, an agent as a chip in its cell | a cloud per organization, an agent as its state glyph inside it | a row per calling agent, a column per called agent, organizations as blocks |
| Lines at rest | none; each chip carries its out and in counts | one trunk per pair of organizations with the number of calls that cross | none at all |
| Names at rest | every agent | only agents that wait for the person or do not work | every connected agent |
| All connections at once | no, one agent at a time | no, one agent at a time plus the trunks | yes |
| Machine | the column | a ring around the glyph | the side panel |
| A call | a dot runs from the caller to the called chip, which flashes | a dot runs along the connection | the cell's frame flashes |
| Closest to | today's map, no learning needed | the Memory brain view and Fabric's shared graph module | an audit table; holds at 200 agents |
| Weak point | no picture of the whole estate's wiring | most names need a hover | reads as a table, not a graph |

Shared by all three: the side panel "First this" (agents that wait for the person, then agents that do not work) and
"The agent's connections" in words; a click pins an agent; Tab reaches every agent.

## Design decisions

- **Visual system:** the product's own brand tokens (`--pc-*`), linked, not copied. No style pack of the design skill
  is layered on top: the app already has a locked system, and the skill's rule for product UI is the style half only
  (no scroll clock, no particle field, no cinematic motion).
- **Dials** (the design skill's shorthand): variance 4 (a tool page, one frame for all three so only the map differs),
  motion 3 (one kind of pulse, nothing else moves by itself), density 7 (67 agents on one screen is the point; closer
  to the app's Sessions list than to a landing page).
- **Motion** (the skill's motion doctrine): a pulse is state indication, an occasional event, 700 ms, ease-out, about
  one a second in the mockup. A pointer hover fades the rest in 120 ms (`--pc-duration-hover`); a keyboard focus
  changes the picture at once, with no transition. `prefers-reduced-motion: reduce` schedules no pulse and the tokens
  set the fade to 0 ms; the Motion switch does the same by hand.
- **Line meaning** stays today's: a line's colour is the worse state of the call and the agent reached; solid is
  "calls", dashed is "is called by".

## What was checked

`playwright-core` WebKit (an existing checkout's copy, no install), viewport 1440 by 900, each page with motion and
with reduced motion emulated:

- no page error and no failed request on any of the four pages;
- 67 agents on A and B; 0 lines at rest on all three (rubric 1);
- hovering the agent with the most connections (9) draws 9 lines on A and B and dims the rest; the side panel names
  its callers and callees (rubric 3);
- a keyboard focus sets the no-transition mode and fills the side panel (rubric 3);
- pulses seen in 3 s: 4 with motion, 0 with reduced motion, on each variant (rubrics 6 and 7);
- unticking the first organization leaves 43 of 67 agents on A and B (rubric 8).

Not checked: a screen reader, contrast as a computed WCAG row (NOT_RUN; the colours are the brand tokens' roles on the
brand's own surfaces), the light theme, the app's Electron window, a second model's judgement of the variants (the
owner picks here, so no pick was made for him).

Known limits of the mockups: variant C dims a filtered organization's names instead of removing its rows; variant B
places agents by a fixed spiral, not by the shared graph module's layout, which step 2 would use.

## What step 2 needs from the pick

- The variant (or a mix: for example A's lanes with C's matrix as a second view).
- Whether pulses should show real calls. The app does not see calls today: it reads health, events feeds and usage
  reports. A pulse can be drawn from an agent's events feed rows that name another agent; a per-call signal would be a
  contract question for `fabric-service/0.1`.
- SCN-074 gets a new step 2 in the same change as the build, the present page stays reachable beside the new one, and
  MCP `audit` and the map reads do not change.

## Still open from the order

The view of the CRE agent the owner pointed to was not seen: the agent is not on this Mac or the Studio (the brief in
Fabric's CEO inbox says so and asks the organization's PM agent). When Fabric's CEO relays where it is, its best parts
go into the picked variant.
