// #region sessions-notice — docs: docs/ux/scenarios.md#scn-085-a-taken-hand-over-tells-me-once-and-the-tray-counts-sessions
// FD-103 (SCN-085, decision 9 of 2026-10-24): the one system notification a taken hand-over or an automatic continue
// after a limit reset sends. Main-process side (the notification policy reads files); pure given its inputs.
import { t, type Lang } from './i18n';
import { shouldNotify } from './notify';
import type { SessionNotice } from './sessions';
import { agentName } from './sessions-view';
import type { Settings } from './types';

/** The notification's words, or null when notifications are off, paused or in quiet hours (SCN-023, SCN-024). */
export function sessionNotification(lang: Lang, n: SessionNotice, settings: Settings, now: Date): { title: string; body: string } | null {
  if (!shouldNotify(settings, { kind: 'down', serviceKey: 'sessions' }, now)) return null;
  const params = { project: n.project, agent: agentName(n.agent) };
  return { title: t(lang, 'sessions.notice.title'), body: t(lang, n.kind === 'resume' ? 'sessions.notice.resume' : 'sessions.notice.handover', params) };
}
// #endregion sessions-notice
