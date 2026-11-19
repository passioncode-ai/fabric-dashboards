// #region rating-ask — docs: docs/ux/scenarios.md#scn-122-asked-once-for-a-review-after-the-first-finished-session
// FD-348 (SCN-122): asked once, after the first agent session ends, never beside the setup card. Write a review opens an
// email to support (the app ships from GitHub releases, so there is no store sheet); either button answers it for good.
import { useEffect, useState } from 'react';
import { showRatingAsk } from '../../core/help';
import type { Settings } from '../../core/types';
import { api, useT } from '../lib';

export function RatingAsk({ agents, setupShown }: { agents: number; setupShown: boolean }) {
  const { t } = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    const read = () => void api().settings().then(setSettings).catch(() => undefined);
    read();
    // The main process marks it due when a session ends; read again then, not on a timer.
    return api().onConsoleEvent((e) => { if (e.kind === 'exit') read(); });
  }, []);
  if (!settings || !showRatingAsk(settings, agents, setupShown)) return null;
  const answer = (write: boolean) => {
    if (write) void api().openHelp('review').catch(() => undefined);
    void api().updateSettings({ ratingAsked: true }).then((r) => setSettings(r.settings)).catch(() => undefined);
  };
  return (
    <section className="notice info rating-ask" aria-labelledby="rating-title">
      <h2 id="rating-title">{t('rating.title')}</h2>
      <p>{t('rating.body')}</p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => answer(true)}>{t('rating.write')}</button>
        <button type="button" className="btn" onClick={() => answer(false)}>{t('rating.no')}</button>
      </div>
    </section>
  );
}
// #endregion rating-ask
