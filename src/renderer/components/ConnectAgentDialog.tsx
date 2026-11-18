// #region connect-agent — docs: docs/ux/scenarios.md#scn-121-register-an-organizations-agents-from-a-link
// FD-331: «Подключить агента»: one place to connect an organization's agents, from the invitation link an organization
// sends. The app checks the link, the person confirms in the native dialog the registration opens (FD-193), and the
// agents appear on Overview. The same act for an agent is MCP `agent_connect`.
import { useState } from 'react';
import { api, Spinner, useT } from '../lib';

export function ConnectAgentDialog({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const submit = () => {
    if (!link.trim()) return;
    setBusy(true); setWhy(null);
    void api().connectAgent(link).then((r) => { if (r.ok) onClose(); else setWhy(r.reason); }).finally(() => setBusy(false));
  };
  return (
    <div className="scrim" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="connect-title" aria-describedby="connect-body">
        <h2 id="connect-title">{t('connect.title')}</h2>
        <p id="connect-body" className="muted">{t('connect.body')}</p>
        <input className="input mono" autoFocus value={link} placeholder="fabric-dashboards://register?origin=…&invite=…" aria-label={t('connect.field')}
          onChange={(e) => setLink(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }} />
        {why && <p className="error" role="alert">{t('connect.failed', { reason: why })}</p>}
        <div className="row">
          <button className="btn" onClick={onClose}>{t('action.cancel')}</button>
          <button className="btn btn-primary" disabled={busy || !link.trim()} onClick={submit}>{busy ? <><Spinner /> {t('connect.running')}</> : t('connect.submit')}</button>
        </div>
      </div>
    </div>
  );
}
// #endregion connect-agent
