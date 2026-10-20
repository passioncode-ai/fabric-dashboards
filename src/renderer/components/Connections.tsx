// #region connections-tab — docs: docs/ux/scenarios.md#scn-073-see-what-an-agent-is-connected-to
// FD-78: who uses this agent, what it offers, and what it uses, with the chain through the agents it reaches.
// Three columns read left to right; each connection says its state in a word and a shape, never by colour alone.
import { useEffect, useState } from 'react';
import { buildGraph, chainState, stateOfService, worstOf, type ConnectionNode, type ModelUse, type NodeKind } from '../../core/connections';
import type { ServiceSnapshot } from '../../core/types';
import { api, useT } from '../lib';

const ORDER: NodeKind[] = ['service', 'model', 'runner', 'connector', 'store', 'channel', 'part'];
const MARK = { ok: '●', degraded: '▲', down: '■', unknown: '○' } as const;

export function Connections({ s, all, open }: { s: ServiceSnapshot; all: ServiceSnapshot[]; open: (key: string) => void }) {
  const { t, time, reason } = useT();
  const [models, setModels] = useState<ModelUse[] | null>(null);
  useEffect(() => {
    let live = true;
    setModels(null);
    if (!s.wellKnown?.surfaces.usage) { setModels([]); return; }
    // ADR-0013: the usage report is read in the main process with the token; only its sums come here.
    void api().spend(false).then((r) => {
      const e = r.entries.find((x) => x.key === s.key);
      if (live) setModels(e && e.kind === 'report' ? e.summary.models.map((m) => ({ provider: m.provider, model: m.model, calls: m.calls })) : []);
    }).catch(() => { if (live) setModels([]); });
    return () => { live = false; };
  }, [s.key, Boolean(s.wellKnown?.surfaces.usage)]);
  const g = buildGraph(s, all, models ?? []);
  const groups = ORDER.map((k) => [k, g.uses.filter((n) => n.kind === k)] as const).filter(([, list]) => list.length > 0);
  const total = g.uses.length;
  // The agent's own state counts first: an agent that does not answer never reads "Works" for want of connections.
  const self = stateOfService(s.state);
  const worst = worstOf(self, chainState(g.uses));
  const trouble = (nodes: readonly ConnectionNode[]): number => nodes.reduce((n, x) => n + (x.state === 'down' || x.state === 'degraded' ? 1 : 0) + trouble(x.children), 0);

  return (
    <section className="conn" aria-labelledby="conn-title">
      <h2 id="conn-title" className="visually-hidden">{t('tab.connections')}</h2>
      <p className="meta conn-summary">
        <span className={`conn-state conn-${worst}`}><span aria-hidden="true">{MARK[worst]}</span> {t(`conn.state.${worst}`)}</span>
        {' · '}{t('conn.count', { count: total })}{trouble(g.uses) > 0 && <> · {t('conn.trouble', { count: trouble(g.uses) })}</>}
        {models === null && <> · {t('conn.readingUsage')}</>}
      </p>
      {g.errors.length > 0 && <p className="notice error" role="alert">{t('conn.invalid', { errors: g.errors.slice(0, 3).join('; ') })}</p>}
      {!g.declared && g.errors.length === 0 && <p className="meta">{t('conn.undeclared')}</p>}
      <div className="conn-flow">
        <div className="conn-col">
          <h3>{t('conn.usedBy')}</h3>
          {g.usedBy.length === 0 ? <p className="meta">{t('conn.usedBy.none')}</p> : (
            <ul className="conn-list">
              {g.usedBy.map((u) => (
                <li key={u.key}>
                  <button className={`conn-node conn-${u.state}`} onClick={() => open(u.key)}>
                    <span className="conn-mark" aria-hidden="true">{MARK[u.state]}</span>
                    <span className="conn-label">{u.name}</span>
                    {u.capability && <span className="conn-sub mono">{u.capability}</span>}
                    <span className="visually-hidden">{t(`conn.state.${u.state}`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="conn-col conn-center">
          <div className={`conn-self conn-${self}`}>
            <div className="conn-self-name">{s.descriptor?.name ?? s.key}</div>
            <div className="meta mono">{s.key}</div>
            <div className={`conn-state conn-${self}`}><span aria-hidden="true">{MARK[self]}</span> {t(`state.${s.state}`)}</div>
            {g.offers.surfaces.length > 0 && <div className="conn-chips">{g.offers.surfaces.map((x) => <span key={x} className="chip">{t(`conn.surface.${x}`)}</span>)}</div>}
            {g.offers.capabilities.length > 0 && (
              <>
                <div className="meta">{t('conn.offers')}</div>
                <div className="conn-chips">{g.offers.capabilities.map((c) => <span key={c} className="chip mono">{c}</span>)}</div>
              </>
            )}
          </div>
        </div>
        <div className="conn-col">
          <h3>{t('conn.uses')}</h3>
          {groups.length === 0 ? <p className="meta">{t('conn.uses.none')}</p> : groups.map(([kind, list]) => (
            <div key={kind} className="conn-group">
              <h4>{t(`conn.kind.${kind}`)} <span className="count">{list.length}</span></h4>
              <Tree nodes={list} open={open} time={time} t={t} reason={reason} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Tree({ nodes, open, time, t, reason }: { nodes: readonly ConnectionNode[]; open: (key: string) => void; time: (iso: string) => string; t: (k: string, p?: Record<string, string | number>) => string; reason: (r: NonNullable<ConnectionNode['agentReason']>) => string }) {
  return (
    <ul className="conn-list conn-tree">
      {nodes.map((n) => {
        const body = (
          <>
            <span className="conn-mark" aria-hidden="true">{MARK[n.state]}</span>
            <span className="conn-label">{n.label}</span>
            {n.target && <span className="conn-sub mono">{n.target}</span>}
            {n.capability && <span className="conn-sub mono">{n.capability}</span>}
            {typeof n.calls === 'number' && <span className="conn-sub">{t('conn.calls', { count: n.calls })}</span>}
            <span className="visually-hidden">{t(`conn.state.${n.state}`)}</span>
            {(n.reason || n.agentReason || n.purpose || n.lastAt) && (
              <span className="conn-why">{[n.reason, n.agentReason ? reason(n.agentReason) : '', n.purpose, n.lastAt ? t('conn.lastAt', { when: time(n.lastAt) }) : ''].filter(Boolean).join(' · ')}</span>
            )}
          </>
        );
        return (
          <li key={n.id}>
            {n.serviceKey
              ? <button className={`conn-node conn-${n.state}`} title={t('conn.open', { name: n.label })} onClick={() => open(n.serviceKey!)}>{body}</button>
              : <div className={`conn-node conn-${n.state}`}>{body}</div>}
            {n.repeated && <p className="meta conn-repeated">{t('conn.repeated')}</p>}
            {n.children.length > 0 && <Tree nodes={n.children} open={open} time={time} t={t} reason={reason} />}
          </li>
        );
      })}
    </ul>
  );
}
// #endregion connections-tab
