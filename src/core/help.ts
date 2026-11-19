import { SETUP_KEY } from './offers';

// FD-348 (the operator's instruction of 2026-11-19, relayed by Fabric `b1df37b0`; the addresses from Fabric `e9de22da`):
// Settings → Help. Each link is fixed here, never taken from the page: support is the PassionCode support mailbox,
// with this app and its version in the subject so a reply finds its product; privacy is PassionCode's policy page.
// No terms link until passioncode.ai serves one (it answers 404 today); a support chat comes when PassionCode's support
// agent has a public door, and until then support is the mailbox.
// #region help-links — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
export type HelpLink = 'support' | 'privacy' | 'review';

export const SUPPORT_MAIL = 'support@passioncode.ai';
export const PRIVACY_PAGE = 'https://passioncode.ai/privacy/';

/** The address a Help link opens, or null for anything else. */
export function helpUrl(kind: unknown, version: string): string | null {
  if (kind === 'support') return `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent(`Fabric Dashboards ${version}`)}`;
  if (kind === 'privacy') return PRIVACY_PAGE;
  // FD-348: the one-time review ask writes to the same mailbox; the app ships from GitHub releases, so there is no store sheet.
  if (kind === 'review') return `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent(`Fabric Dashboards ${version}: review`)}`;
  return null;
}
// #endregion help-links

// #region rating-ask — docs: docs/ux/scenarios.md#scn-122-asked-once-for-a-review-after-the-first-finished-session
// FD-348: the "aha" moment is an agent's console session ending; the Setup console's own end is not one. Asked once:
// Write a review or No thanks both answer it for good, and it never shows beside the setup card.
/** Whether a console session ending under `key` marks the review as due (written once, by the main process). */
export function ratingDueAfter(key: string, s: { ratingDue: boolean; ratingAsked: boolean }): boolean {
  return key !== SETUP_KEY && !s.ratingDue && !s.ratingAsked;
}

/** Whether Overview shows the review ask now: due, unanswered, at least one agent listed and no setup card on screen. */
export function showRatingAsk(s: { ratingDue: boolean; ratingAsked: boolean }, agents: number, setupShown: boolean): boolean {
  return s.ratingDue && !s.ratingAsked && agents > 0 && !setupShown;
}
// #endregion rating-ask
