# ADR-0021 — Fabric's button in the host: a header button, a native menu, the host's cookie

Status: accepted · 2026-10-11. Board row FD-45. Normative source: Fabric Agent Contract DEC-0040,
[`docs/specification/fabric-button.md`](https://github.com/passioncode-ai/fabric-agent-contract/blob/8e49fbd/docs/specification/fabric-button.md)
(FB-1…FB-8, FL-1…FL-7; merged as `8e49fbd`). Requested by the operator on 2026-10-11 as Fabric 0.4.0 REQ-42. The
Fabric owner's answers (2026-10-11) are recorded below under Decision 3 and Decision 6.

## Context

DEC-0040 lets a product's dashboard show **Fabric's button**. It opens Fabric, the manager agent, on that
product: a conversation about the service (`fabric://chat?service=…&project=…`) or a coding-agent session in the
project (`fabric://session/new?project=…`). The spec names Fabric Dashboards as the first host. The host draws
the button over the service page it shows, and sets the cookie `fabric_button` with `owner=host` so the page
hides its own (FB-1, FB-6).

Fabric Dashboards shows a service's dashboard in a native `WebContentsView`, which always paints above the
app's own DOM (`src/electron/views.ts`). A button or a menu drawn by the renderer at the bottom-right corner of
the page (FB-2) would sit under the page, never on it. The app's existing overlays hide the page while they
are open (`overlayOpen`, `src/renderer/App.tsx`).

## Decision

1. **The button sits in the service page's one-line header**, beside the console button (ADR-0017), on every
   tab. It shows the Fabric mark and the word **Fabric**, and its accessible name is **Open Fabric** (FB-3).
   This is a declared deviation from FB-2's bottom-right placement. FB-2 places a *page's* button in its own
   viewport. A host's chrome is never part of the page, so the header button never covers page content, which
   is what FB-2 protects. The page keeps its whole viewport.
   Its target is 44 × 44 CSS px (FB-3). It reaches up into the bar's top padding, so the one-line header
   keeps its 44 px (ADR-0017).
2. **Its menu is a native menu** (`Menu.popup`), anchored under the button. A native menu paints above the
   dashboard view, takes the keyboard (arrows, Return, Escape) and is read by VoiceOver, Narrator and Orca
   without an app-drawn focus trap (FB-4's keyboard rules, given by the OS). The page is never hidden to show it.
   Because the OS draws and closes the menu, the button carries `aria-haspopup="menu"` when it opens one and no
   `aria-expanded`.
3. **The project is Fabric's to find.** Fabric resolves a service's project itself: it reads the service's
   descriptor from its agent registry, matches `source.repository` against its projects' admitted
   repositories (its REQ-05 resolver), and asks inside the conversation when there is no match or more than
   one. The Fabric owner said so on 2026-10-11. The button therefore sends
   `fabric://chat?service=<id>.<instance>` with no project. This host never offers the session item of FB-4,
   and with one action the button opens the link at once, without `aria-haspopup` (FB-4's last sentence).
4. **Fabric's presence is asked of the OS, not guessed.** The main process asks
   `app.getApplicationNameForProtocol('fabric://chat')`; a non-empty name means a handler is installed. With
   none, a press opens the menu with exactly *Fabric is not installed — get it at passioncode.ai/fabric*
   (FB-5); choosing it opens `https://passioncode.ai/fabric` in the browser. In Russian the app shows the same
   sentence translated («Fabric не установлен — скачайте его на passioncode.ai/fabric»), as every string here
   follows the interface language (AGENTS.md, localization L10N). FB-5's "exactly" fixes the English words;
   the address stays verbatim in both languages. A handler that is named but fails
   to open the link gets the same menu, so the 1,500 ms test of FB-5 is not needed in a host that is told.
   Nothing is downloaded, and nothing retries.
5. **The cookie.** Before every show of a dashboard and before its Reload and Home, the host sets `fabric_button=v=1&owner=host&fabric=present|absent`
   on the page's origin in that service's partition: path `/`, `SameSite=Strict`, not HttpOnly, `Secure` on
   https (FB-6, the ED-8 attributes). It carries no secret and no identity. For a service whose id falls outside
   the hub's agent-id grammar, the host draws no button, and the cookie says `owner=page`.
6. **The mark.** Fabric's mark is the PassionCode.ai mark, the exact vector its app icon centres on a tile
   (fabric `assets/brand/app-icon/fabric-icon.svg`, ADR-0100 D5: its five paths are those of the website's
   `assets/passioncode-mark.svg`, compared 2026-10-11). The Fabric owner agreed that this glyph is the mark.
   It is vendored from the website and pinned like the other brand files (`docs/brand-source.json`).
7. **Links are built by the contract's code.** `src/core/fabric-links.ts` is a copy of the contract's
   `src/fabric-links.ts`, re-pinned to `7931c1dbb6e6` (DEC-0041: a credential word must be a whole word of a
   parameter name, so `themeCode` and `sortKey` pass and `authToken` is refused). `buildFabricLink` refuses any link the grammar refuses, and the contract's
   `fabric-link` fixtures are checked against it (`test/fabric-button.test.ts`). A press opens a view in Fabric
   and nothing more (FB-8): no message, no process, no spend.

## Consequences

- When Fabric is installed, one click opens Fabric's conversation about the service. The project is chosen
  in Fabric, never in this app.
- A dashboard that ships its own Fabric button (FB-7, the kit) hides it inside this app and shows it in a
  browser.
- A service without a dashboard still gets the button: the conversation is about the service, not its page.
- The way back (FL-7, `fabric-dashboards://service/<id>.<instance>?path=…`) already exists (ADR-0016) and is
  unchanged.
- Re-copy `fabric-links.ts` and its fixtures when the contract changes them.
