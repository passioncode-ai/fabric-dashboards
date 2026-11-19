// FD-348 (the operator's instruction of 2026-11-19, relayed by Fabric `b1df37b0`; the addresses from Fabric `e9de22da`):
// Settings → Help. Each link is fixed here, never taken from the page: support is the PassionCode support mailbox,
// with this app and its version in the subject so a reply finds its product; privacy is PassionCode's policy page.
// No terms link until passioncode.ai serves one (it answers 404 today); a support chat comes when PassionCode's support
// agent has a public door, and until then support is the mailbox.
// #region help-links — docs: docs/ux/scenarios.md#scn-024-settings-launch-at-login-notifications-quiet-hours
export type HelpLink = 'support' | 'privacy';

export const SUPPORT_MAIL = 'support@passioncode.ai';
export const PRIVACY_PAGE = 'https://passioncode.ai/privacy/';

/** The address a Help link opens, or null for anything else. */
export function helpUrl(kind: unknown, version: string): string | null {
  if (kind === 'support') return `mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent(`Fabric Dashboards ${version}`)}`;
  if (kind === 'privacy') return PRIVACY_PAGE;
  return null;
}
// #endregion help-links
