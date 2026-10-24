// A ServiceSnapshot for tests of the attention queue and the screens that read it (W2).
import type { ServiceSnapshot, ServiceState, WellKnown } from '../src/core/types';

export function snap(key: string, state: ServiceState, extra: Partial<ServiceSnapshot> & { update?: string; tile?: boolean; online?: boolean; managed?: boolean } = {}): ServiceSnapshot {
  const [id, instance] = key.split('.') as [string, string];
  const { update, tile, online, managed = true, ...rest } = extra;
  const answers = ['ready', 'degraded', 'duplicate'].includes(state);
  const wellKnown: WellKnown | null = answers || update || tile ? {
    protocol: 'fabric-service/0.1',
    service: { id, instance, name: id, version: '1.0.0', build: { commit: 'abcdef0' } },
    process: { pid: 42, startedAt: '2026-10-24T08:00:00Z' },
    status: state === 'degraded' ? 'degraded' : 'ready',
    degraded: state === 'degraded' ? [{ source: 'disk', reason: 'full' }] : [],
    summary: tile ? [{ label: 'Queue', value: 9, attention: true }] : [],
    surfaces: { dashboard: { path: '/', login: false }, events: { path: '/fabric/v1/events' } },
    update: { available: update ?? null },
  } : null;
  return {
    key, descriptorPath: `/svc/${key}.json`,
    descriptor: {
      protocol: 'fabric-service/0.1', id, instance, name: id[0]!.toUpperCase() + id.slice(1), origin: online ? `https://${id}.example.com` : 'http://127.0.0.1:47100',
      placement: online ? 'remote' : 'local', auth: { tokenFile: '/t' }, lifecycle: { manager: 'launchd', label: `x.${id}` },
      paths: { data: '/d', logs: ['/l.log'] }, commands: update ? { update: ['up'] } : {}, installedAt: '2026-10-01T00:00:00Z', installedBy: 'test',
    },
    problems: [], state, reasons: state === 'down' ? [{ code: 'reason.down', params: { since: '2026-10-24T09:00:00Z' } }] : [],
    wellKnown, dashboardMinWidth: null,
    launchd: { managed, loaded: true, pid: 1, disabled: state === 'stopped' },
    firstUnansweredAt: null, lastAnswerAt: null, busy: null, lastAction: null, latestEvent: null, feedError: null,
    ...rest,
  } as ServiceSnapshot;
}
