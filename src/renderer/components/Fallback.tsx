// #region fallback-settings — docs: docs/ux/scenarios.md#scn-088-choose-the-default-and-fallback-coding-agents
// FD-117: Settings → Coding agents. Switchboard's default agent and machine fallback order, with the model each level
// works on. Every change is one write through Switchboard's CLI (the main process); the section then shows what
// Switchboard holds, so a refused write never leaves the screen showing a choice that was not saved.
import { useEffect, useState } from 'react';
import { MAX_LEVELS, modelOf, type FallbackChange, type FallbackRead, type FallbackState, type FbLevel } from '../../core/fallback-types';
import { api, Spinner, useT } from '../lib';

type Read = FallbackRead | { kind: 'absent' };

export function Fallback() {
  const { t } = useT();
  const [state, setState] = useState<Read | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    void api().fallback().then(setState).catch((e: unknown) => setState({ kind: 'error', detail: String((e as Error)?.message ?? e) }));
  }, []);

  const change = async (c: FallbackChange) => {
    setBusy(true);
    setError('');
    try {
      const r = await api().setFallback(c);
      setState(r.state);
      if (!r.ok) setError(t('fallback.refused', { reason: r.detail ?? '' }));
    } catch (e) {
      setError(t('fallback.refused', { reason: String((e as Error)?.message ?? e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="group" aria-labelledby="g-fallback" aria-busy={busy || !state}>
      <h2 id="g-fallback">{t('fallback.title')}</h2>
      <p className="meta">{t('fallback.body')}</p>
      {!state && <p className="row muted" role="status"><Spinner /> {t('app.loading')}</p>}
      {state?.kind === 'absent' && <p className="meta" role="status">{t('fallback.absent')}</p>}
      {state?.kind === 'old' && <p className="meta" role="status">{t('fallback.old')}</p>}
      {state?.kind === 'error' && <p className="notice error" role="alert">{t('fallback.error', { reason: state.detail })}</p>}
      {state?.kind === 'ok' && <Chain s={state} busy={busy} onChange={(c) => void change(c)} />}
      {busy && <p className="meta" role="status"><Spinner /> {t('fallback.saving')}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
    </section>
  );
}

function Chain({ s, busy, onChange }: { s: FallbackState; busy: boolean; onChange: (c: FallbackChange) => void }) {
  const { t } = useT();
  const offered = s.agents.filter((a) => a.offered);
  const nameOf = (id: string) => s.agents.find((a) => a.id === id)?.name ?? id;
  const setLevels = (levels: FbLevel[]) => onChange({ levels: levels.map(({ accountLabel: _l, ...l }) => l) });
  const replace = (i: number, agent: string) => setLevels(s.levels.map((l, j) => (j === i ? (l.agent === agent ? l : { agent }) : l)));
  const move = (i: number, by: -1 | 1) => { const ls = [...s.levels]; [ls[i], ls[i + by]] = [ls[i + by]!, ls[i]!]; setLevels(ls); };
  const add = () => { const next = offered.find((a) => !s.levels.some((l) => l.agent === a.id)) ?? offered[0]; if (next) setLevels([...s.levels, { agent: next.id }]); };
  const full = s.levels.length >= MAX_LEVELS;
  const usesOpenRouter = s.levels.some((l) => modelOf(l.agent, s).kind !== 'account') || offered.some((a) => a.id === 'opencode' || a.id === 'hermes');

  return (
    <>
      <label className="setting">{t('fallback.default')}
        <select value={s.default ?? ''} disabled={busy} onChange={(e) => onChange({ default: e.target.value || null })}>
          <option value="">{t('fallback.auto')}</option>
          {offered.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          {s.default && !offered.some((a) => a.id === s.default) && <option value={s.default}>{nameOf(s.default)}</option>}
        </select>
      </label>
      <p className="meta">{t('fallback.default.body')}</p>

      <h3 className="fallback-heading" id="fallback-order">{t('fallback.order')}</h3>
      <p className="meta">{t('fallback.order.body')}</p>
      {s.levels.length === 0 && <p className="meta" role="status">{t('fallback.none')}</p>}
      <ol className="fallback-levels" aria-labelledby="fallback-order">
        {s.levels.map((l, i) => {
          const model = modelOf(l.agent, s);
          const isOffered = offered.some((a) => a.id === l.agent);
          return (
            <li key={`${i}-${l.agent}`} className="fallback-level">
              <label className="setting">{t('fallback.level', { n: i + 1 })}
                <select value={l.agent} disabled={busy} onChange={(e) => replace(i, e.target.value)}>
                  {!isOffered && <option value={l.agent}>{nameOf(l.agent)}</option>}
                  {offered.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <p className="meta">
                {model.kind === 'account' ? t('fallback.model.account') : model.kind === 'openrouter' ? t('fallback.model.openrouter', { model: model.model }) : t('fallback.model.unknown')}
                {l.account && <> · {t('fallback.pin.account', { name: l.accountLabel ?? l.account })}</>}
                {l.key && <> · {t('fallback.pin.key', { name: l.key })}</>}
              </p>
              {!isOffered && <p className="meta" role="note">{t('fallback.notOffered', { name: nameOf(l.agent) })}</p>}
              <div className="fallback-actions" role="group" aria-label={t('fallback.level', { n: i + 1 })}>
                <button type="button" className="btn btn-sm" disabled={busy || i === 0} aria-label={t('fallback.up', { n: i + 1 })} title={t('fallback.up', { n: i + 1 })} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="btn btn-sm" disabled={busy || i === s.levels.length - 1} aria-label={t('fallback.down', { n: i + 1 })} title={t('fallback.down', { n: i + 1 })} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="btn btn-sm" disabled={busy} aria-label={t('fallback.remove', { n: i + 1 })} title={t('fallback.remove', { n: i + 1 })} onClick={() => setLevels(s.levels.filter((_, j) => j !== i))}>×</button>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className="btn btn-sm fallback-add" disabled={busy || full || !offered.length} aria-describedby={full ? 'fallback-max' : undefined} onClick={add}>{t('fallback.add')}</button>
      {full && <p className="meta" id="fallback-max">{t('fallback.max', { n: MAX_LEVELS })}</p>}

      {usesOpenRouter && <>
        <label className="setting">{t('fallback.openrouter')}
          <ModelSelect value={s.openrouter.model} models={s.openrouter.models} disabled={busy || !s.openrouter.model} onPick={(m) => onChange({ openrouterModel: m })} />
        </label>
        <p className="meta">{s.openrouter.model ? t('fallback.openrouter.body') : t('fallback.openrouter.none')}</p>
      </>}
      {s.hermes && <>
        <label className="setting">{t('fallback.hermes')}
          <ModelSelect value={s.hermes.model} models={s.openrouter.models} disabled={busy || Boolean(s.hermes.error)} onPick={(m) => onChange({ hermesModel: m })} />
        </label>
        <p className="meta">{s.hermes.error ? t('fallback.hermes.silent', { reason: s.hermes.error }) : t('fallback.hermes.body')}</p>
      </>}

      {s.others.length > 0 && <>
        <h3 className="fallback-heading">{t('fallback.others')}</h3>
        <ul className="fallback-others">
          {s.others.map((o) => <li key={o.name}>{t('fallback.others.row', { name: o.name, agents: o.agents.join(' → ') })}</li>)}
        </ul>
      </>}
      {s.workflows > 0 && <p className="meta">{t('fallback.workflows', { n: s.workflows })}</p>}
    </>
  );
}

/** The recommended models, with the current one first when it is not among them. */
function ModelSelect({ value, models, disabled, onPick }: { value: string | null; models: { id: string; name: string }[]; disabled: boolean; onPick: (id: string) => void }) {
  const list = value && !models.some((m) => m.id === value) ? [{ id: value, name: value }, ...models] : models;
  return (
    <select value={value ?? ''} disabled={disabled} onChange={(e) => e.target.value && onPick(e.target.value)}>
      {!value && <option value="" />}
      {list.map((m) => <option key={m.id} value={m.id}>{m.name === m.id ? m.id : `${m.name} (${m.id})`}</option>)}
    </select>
  );
}
// #endregion fallback-settings
