// #region usage-analytics — docs: docs/ux/scenarios.md#scn-091-learn-that-anonymous-usage-and-error-data-is-shared
// FD-136 (SCN-091): the notice shown once, the first time the window comes up in a build that can send: what is
// shared, what never is, and where it is turned off. OK keeps it on; Turn off turns it off for this product alone.
import { useEffect, useState } from 'react';
import { api, useT } from '../lib';

export function AnalyticsNotice({ available, onOpen, earlierNo = false }: { available: boolean; onOpen: (open: boolean) => void; /** DEC-0157 UD-2: a shared earlier no keeps it off. */ earlierNo?: boolean }) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!available) return;
    void api().settings().then((s) => { if (!s.analyticsNoticeSeen) setShow(true); }).catch(() => undefined);
  }, [available]);
  useEffect(() => { onOpen(show); }, [show]);
  if (!show) return null;
  const answer = (on: boolean) => {
    setShow(false);
    void api().updateSettings(on ? { analyticsNoticeSeen: true } : { analyticsNoticeSeen: true, analytics: false }).catch(() => undefined);
  };
  return (
    <div className="scrim" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="analytics-title" aria-describedby="analytics-body">
        {/* DEC-0157 UD-2: an earlier no for the PassionCode apps here keeps it off; the notice says so and where to turn it on. */}
        <h2 id="analytics-title">{t(earlierNo ? 'analytics.notice.offTitle' : 'analytics.notice.title')}</h2>
        <p id="analytics-body">{t(earlierNo ? 'analytics.notice.offBody' : 'analytics.notice.body')}</p>
        {!earlierNo && <p className="meta">{t('analytics.notice.never')}</p>}
        <div className="row">
          {!earlierNo && <button type="button" className="btn" onClick={() => answer(false)}>{t('analytics.notice.off')}</button>}
          <button type="button" className="btn btn-primary" autoFocus onClick={() => answer(true)}>{t('analytics.notice.ok')}</button>
        </div>
      </div>
    </div>
  );
}
// #endregion usage-analytics
