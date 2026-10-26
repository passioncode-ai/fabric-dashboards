// #region connections-map — docs: docs/ux/scenarios.md#scn-074-see-how-agents-are-wired-and-what-the-auditor-found
// FD-81: the Connections page. The auditor's summary first (one line, worst first), then the map of how agents are
// wired (left calls right), then the findings grouped by the agent to fix, each with "Fix with coding agent" in the coding
// agent the person picks. Honest state (ADR-0023): an agent that declares nothing has no line, and the page says how
// many declare; the auditor proposes, a person starts the session.
import { useEffect, useMemo, useState } from 'react';
import type { LimitView } from '@passioncode-ai/fabric-service-host/usage';
import { audit, auditBrief, byAgent, type Finding } from '../../core/audit';
import { estateMap, type MapNode } from '../../core/estate-map';
import type { ConsoleTask, ConsoleInfo } from '../../core/api';
import type { AppStatus } from '../../core/types';
import { api, CONN_MARK as MARK, nameOf, SEV_MARK, useT } from '../lib';

const COL_W = 196, COL_GAP = 72, NODE_H = 40, ROW_GAP = 14, PAD = 8;

export function ConnectionsMap({ status, open, onAgent }: { status: AppStatus; open: (key: string) => void; onAgent: (key: string, task: ConsoleTask) => void }) {
  const { t, reason } = useT();
  const [limits, setLimits] = useState<Record<string, LimitView[]>>({});
  useEffect(() => {
    let live = true;
    // ADR-0013: the usage reports are read in the main process; only the ranked limits come here.
    void api().spend(false).then((r) => { if (live) setLimits(Object.fromEntries(r.entries.flatMap((e) => (e.kind === 'report' ? [[e.key, e.summary.limits]] : [])))); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const services = status.services;
  const a = useMemo(() => audit(services, limits), [services, limits]);
  const map = useMemo(() => estateMap(services), [services]);
  const byKey = new Map(services.map((s) => [s.key, s]));
  const name = (key: string) => (byKey.get(key) ? nameOf(byKey.get(key)!) : key);
  const text = (f: Finding) => reason(f.reason);
  const groups = byAgent(a.findings);

  return (
    <div className="cmap">
      <p className="cmap-summary" role="status">
        {a.findings.length === 0 ? <span className="sev sev-ok"><span aria-hidden="true">{SEV_MARK.ok}</span> {t('map.allWell')}</span>
          : (['error', 'warn', 'setup', 'info'] as const).filter((k) => a.counts[k] > 0).map((k) => (
            <span key={k} className={`sev sev-${k}`}><span aria-hidden="true">{SEV_MARK[k]}</span> {t(`map.severity.${k}`)}: <b className="mono">{a.counts[k]}</b></span>
          ))}
      </p>
      <p className="meta" title={t('map.coverageHelp')}>{t('map.coverage', { declaring: a.coverage.declaring, agents: a.coverage.agents })}</p>

      <section className="cmap-section" aria-labelledby="cmap-graph">
        <h2 id="cmap-graph">{t('map.graph')}</h2>
        {map.edges.length === 0 ? <p className="meta">{t('map.noEdges')} {t('map.coverageHelp')}</p> : <Graph nodes={map.nodes} edges={map.edges} columns={map.columns} rows={map.rows} open={open} t={t} />}
        {map.loose.length > 0 && (
          <div className="cmap-loose">
            <h3>{t('map.loose')} <span className="count">{map.loose.length}</span></h3>
            <ul>
              {map.loose.map((n) => (
                <li key={n.id}><button className={`chip cmap-chip conn-${n.state}`} onClick={() => n.key && open(n.key)}><span aria-hidden="true">{MARK[n.state]}</span> {n.name}<span className="visually-hidden"> {t(`conn.state.${n.state}`)}</span></button></li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {groups.length > 0 && (
        <section className="cmap-section" aria-labelledby="cmap-findings">
          <h2 id="cmap-findings">{t('map.findings')} <span className="count">{a.findings.length}</span></h2>
          <ul className="audit-list">
            {groups.map((g) => (
              <AuditGroup key={g.key} serviceKey={g.key} name={name(g.key)} findings={g.findings} text={text} open={open} onAgent={onAgent} />
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}


function AuditGroup({ serviceKey, name, findings, text, open, onAgent }: { serviceKey: string; name: string; findings: Finding[]; text: (f: Finding) => string; open: (key: string) => void; onAgent: (key: string, task: ConsoleTask) => void }) {
  const { t } = useT();
  const [info, setInfo] = useState<ConsoleInfo | null>(null);
  const [runtime, setRuntime] = useState<string>('');
  useEffect(() => {
    let live = true;
    void api().consoleInfo(serviceKey).then((i) => { if (!live) return; setInfo(i); setRuntime(i.runtime ?? i.runtimes[0]?.id ?? ''); }).catch(() => undefined);
    return () => { live = false; };
  }, [serviceKey]);
  // A chain finding belongs to the agent reached (it has its own finding); an update is worth knowing. Neither alone
  // starts a session here: the fix goes where the cause is.
  const fixable = findings.some((f) => f.severity !== 'info' && f.kind !== 'chain');
  const start = async () => {
    if (info && runtime && runtime !== info.runtime) await api().consoleChoose(serviceKey, { runtime });
    onAgent(serviceKey, { kind: 'audit', output: auditBrief(name, serviceKey, findings.map(text)) });
  };
  const worst = findings[0]!.severity;
  return (
    <li className={`audit-group sev-edge-${worst}`}>
      <div className="audit-head">
        <button className="linkish audit-name" onClick={() => open(serviceKey)}>{name}</button>
        <span className="meta mono">{serviceKey}</span>
        <span className="spacer" />
        {fixable && info && info.runtimes.length > 0 && (
          <>
            <label className="meta" htmlFor={`rt-${serviceKey}`}>{t('map.fixIn')}</label>
            <select id={`rt-${serviceKey}`} className="select-sm" value={runtime} onChange={(e) => setRuntime(e.target.value)}>
              {info.runtimes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button className="btn btn-sm" onClick={() => void start()}>{t('map.fix')}</button>
          </>
        )}
        {fixable && info && info.runtimes.length === 0 && <span className="meta">{t('map.noRuntime')}</span>}
      </div>
      <ul className="audit-findings">
        {findings.map((f) => (
          <li key={f.id} className={`sev sev-${f.severity}`}>
            <span aria-hidden="true">{SEV_MARK[f.severity]}</span>
            <span className="visually-hidden">{t(`map.severity.${f.severity}`)}: </span>
            <span className="audit-text">{text(f)}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The layered map: agents as boxes, calls as curves left to right, the colour and the shape both saying the state. */
function Graph({ nodes, edges, columns, rows, open, t }: { nodes: MapNode[]; edges: { from: string; to: string; state: string; capability?: string }[]; columns: number; rows: number; open: (key: string) => void; t: (k: string, p?: Record<string, string | number>) => string }) {
  const at = new Map(nodes.map((n) => [n.id, { x: PAD + n.column * (COL_W + COL_GAP), y: PAD + n.row * (NODE_H + ROW_GAP) }]));
  const width = PAD * 2 + columns * COL_W + Math.max(0, columns - 1) * COL_GAP;
  const height = PAD * 2 + rows * NODE_H + Math.max(0, rows - 1) * ROW_GAP;
  return (
    <div className="cmap-graph">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t('map.graph')}>{/* VIS-07: not role=img, whose children would lose their names */}
        <defs>
          {(['ok', 'degraded', 'down', 'unknown'] as const).map((s) => (
            <marker key={s} id={`arrow-${s}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8z" className={`edge-head edge-${s}`} /></marker>
          ))}
        </defs>
        {edges.map((e) => {
          const a = at.get(e.from), b = at.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + COL_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
          const bend = Math.max(24, (x2 - x1) / 2);
          return (
            <path key={`${e.from}>${e.to}`} className={`edge edge-${e.state}`} d={`M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`} markerEnd={`url(#arrow-${e.state})`}>
              <title>{e.capability ? `${e.capability}: ${t(`conn.state.${e.state}`)}` : t(`conn.state.${e.state}`)}</title>
            </path>
          );
        })}
        {nodes.map((n) => {
          const p = at.get(n.id)!;
          return (
            <g key={n.id} className={`node conn-${n.state}${n.missing ? ' node-missing' : ''}`} transform={`translate(${p.x} ${p.y})`}
              role={n.key ? 'button' : undefined} tabIndex={n.key ? 0 : undefined} aria-label={`${n.name}: ${n.missing ? t('map.missing') : t(`conn.state.${n.state}`)}`}
              onClick={() => n.key && open(n.key)} onKeyDown={(e) => { if (n.key && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(n.key); } }}>
              <title>{n.name}</title>{/* VIS-07: the full name of a box whose label is cut at 22 characters */}
              <rect width={COL_W} height={NODE_H} rx="6" className="node-box" />
              <rect width="3" height={NODE_H} className="node-edge" />
              {!n.missing && <text x="12" y={NODE_H / 2 + 4} className="node-mark" aria-hidden="true">{MARK[n.state]}</text>}
              <text x={n.missing ? 14 : 28} y={n.missing ? 17 : NODE_H / 2 + 4} className="node-label">{n.name.length > 22 ? `${n.name.slice(0, 21)}…` : n.name}</text>
              {n.missing && <text x="14" y="31" className="node-sub">{t('map.missing')}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
// #endregion connections-map
