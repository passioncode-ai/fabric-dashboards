// FD-103: SessionRow fixtures for the Sessions mode's screens (navigation.test.ts, sessions-ui.test.ts).
import { actionsFor, groupOf, type SessionRow } from '../src/core/sessions';

export const AT = Date.parse('2026-10-24T14:02:00Z');

export function srow(o: Partial<SessionRow> & Pick<SessionRow, 'id' | 'state'>): SessionRow {
  const folder = o.folder ?? `/work/${o.project ?? 'checkout'}`;
  const group = o.group ?? groupOf(o.state);
  return {
    key: null, folder, project: folder.split('/').pop()!, agent: 'claude-code', account: 'claude4', context: null, contextName: null,
    origin: 'handover', reason: null, openedInTerminal: false, startedAt: AT, endedAt: null, expectedAt: null, candidates: [], resumable: false, consoleEmpty: false, at: AT,
    actions: actionsFor(o.state, { continueNow: (o.candidates ?? []).length > 0 }),
    ...o, group,
  };
}

/** One row in each group: a failed resume, a running hand-over, a waiting stop, an idle-closed session. */
export function fourGroups(): SessionRow[] {
  return [
    srow({ id: 'c:handover.rs-000000000001:1', key: 'handover.rs-000000000001', state: 'needs-you-resume-failed', folder: '/work/billing-api', origin: 'resume' }),
    srow({ id: 'c:handover.ho-000000000002:2', key: 'handover.ho-000000000002', state: 'running-ours', folder: '/work/passioncode-platform' }),
    srow({ id: 'st:cc-1', state: 'waiting-reset', folder: '/work/fabric-switchboard', origin: 'limit', account: null, expectedAt: AT + 3600_000, candidates: [{ id: 'acc-2', label: 'claude5' }] }),
    srow({ id: 'c:handover.ho-000000000003:3', key: 'handover.ho-000000000003', state: 'idle-closed', folder: '/work/docs-site', endedAt: AT + 600_000, resumable: true }),
  ];
}
