// #region agent-names — docs: docs/ux/scenarios.md#scn-090-rename-an-agent
// FD-135 (SCN-090): the row menu's Rename. The name goes to the agent's own GitHub repository (ADR-0026),
// so the dialog says where before anything is saved, and waits for GitHub's answer before it closes.
import { useEffect, useRef, useState } from 'react';
import type { ServiceSnapshot } from '../../core/types';
import { api, nameOf, Spinner, useT } from '../lib';

/** The same limit the main process holds (`NAME_MAX`, src/core/agent-names.ts: a descriptor's own `name`). */
const NAME_MAX = 80;

/** `owner/repo` of a GitHub address, for the sentence that says where the name goes; null for any other host. */
export function githubSlug(repository: string | undefined): string | null {
  const m = /github\.com[/:]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/i.exec(repository?.trim() ?? '');
  return m ? `${m[1]}/${m[2]}` : null;
}

export function RenameDialog({ s, onClose }: { s: ServiceSnapshot; onClose: () => void }) {
  const { t } = useT();
  const own = s.agentName ?? null;
  const shown = s.descriptor?.name ?? nameOf(s);
  const [value, setValue] = useState(shown);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const repository = s.descriptor?.source?.repository;
  const slug = githubSlug(repository);
  const blocked = !repository ? t('rename.noRepo') : !slug ? t('rename.notGithub', { repo: repository }) : null;
  const clean = value.replace(/\s+/g, ' ').trim();
  const tooLong = [...clean].length > NAME_MAX;
  useEffect(() => { field.current?.select(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saving, onClose]);
  const save = async (name: string | null) => {
    setSaving(true);
    setError(null);
    const res = await api().renameAgent(s.key, name);
    setSaving(false);
    if (res.ok) { onClose(); return; }
    setError(res.refused === 'no-gh' ? t('rename.noGh') : res.refused === 'no-repository' ? t('rename.noRepo') : res.refused === 'not-github' ? t('rename.notGithub', { repo: repository ?? '' }) : t('rename.failed', { error: res.error }));
  };
  const canSave = !blocked && !saving && clean.length > 0 && !tooLong && clean !== shown;
  return (
    <div className="scrim" role="presentation">
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title" aria-describedby="rename-where"
        onSubmit={(e) => { e.preventDefault(); if (canSave) void save(own !== null && clean === own ? null : clean); }}>
        <h2 id="rename-title">{t('rename.title')}</h2>
        <label className="rename-field">
          <span>{t('rename.label')}</span>
          <input type="text" ref={field} autoFocus spellCheck={false} value={value} disabled={Boolean(blocked) || saving} maxLength={NAME_MAX * 2} aria-invalid={tooLong || undefined}
            onChange={(e) => setValue(e.target.value)} />
        </label>
        {tooLong && <p className="notice error" role="alert">{t('rename.tooLong', { max: NAME_MAX })}</p>}
        <p id="rename-where" className="meta">{blocked ?? t('rename.where', { repo: slug ?? '' })}</p>
        {own !== null && !blocked && (
          <p className="meta row rename-own">
            <span>{t('rename.own', { name: own })}</span>
            <button type="button" className="btn btn-link" disabled={saving} onClick={() => void save(null)}>{t('rename.reset')}</button>
          </p>
        )}
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="row">
          {saving && <span className="meta row"><Spinner /> {t('rename.saving')}</span>}
          <button type="button" className="btn" disabled={saving} onClick={onClose}>{t('action.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={!canSave}>{t('rename.save')}</button>
        </div>
      </form>
    </div>
  );
}
// #endregion agent-names
