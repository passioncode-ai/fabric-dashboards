// #region console-drawer — docs: docs/ux/scenarios.md#scn-048-open-an-agents-console-over-its-dashboard
// FD-92: the page of the console drawer's own view (src/electron/drawer.ts). The window's page decides
// which console shows and where; this page draws it, and reports a fold, a new height and a taken job back.
import { useEffect, useRef, useState } from 'react';
import { langFor, type Lang } from '../core/i18n';
import type { DrawerPush } from '../core/api';
import { CONSOLE_HEIGHT } from '../core/types';
import { ConsolePanel } from './components/ConsolePanel';
import { api, LangContext } from './lib';
import { applyTheme } from './App';

export function DrawerApp() {
  const [lang, setLang] = useState<Lang>('en');
  const [push, setPush] = useState<DrawerPush | null>(null);
  /** While dragging, the height the edge is at; null otherwise (the window's page owns the saved one). */
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  /** FD-102: the height last asked for, until the window's page pushes it back. Key presses come faster than that round
   *  trip under load, and each counted from the old height: three steps grew the console by one. */
  const [pending, setPending] = useState<number | null>(null);
  const taken = useRef<number | null>(null);
  useEffect(() => {
    document.documentElement.classList.add('drawer-page');
    void api().locale().then((l) => { setLang(langFor(l)); document.documentElement.lang = langFor(l); });
    void api().settings().then((s) => applyTheme(s.theme));
    return api().onDrawer(setPush);
  }, []);
  useEffect(() => { if (pending !== null && push?.height === pending) setPending(null); }, [push?.height, pending]);
  // VIS-06: the window's page says which scheme it paints; the terminal follows it at once (ConsolePanel watches it).
  useEffect(() => { if (push?.scheme) applyTheme(push.scheme); }, [push?.scheme]);
  // A height the window's page settles differently (its own clamp) never comes back as asked: stop waiting for it.
  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => setPending(null), 2_000);
    return () => clearTimeout(timer);
  }, [pending]);
  if (!push?.key) return null;
  const focusOut = (back: boolean) => api().drawerChange({ kind: 'focusOut', back });
  // FD-103 (SCN-080): a session's page: the console fills the page under its header.
  if (push.full) {
    return (
      <LangContext.Provider value={lang}>
        <ConsolePanel key="page" serviceKey={push.key} page height={push.areaHeight} maxHeight={push.areaHeight} onHeight={() => undefined} onDrag={() => undefined} onHide={() => undefined} onFocusOut={focusOut} />
      </LangContext.Provider>
    );
  }
  const maxHeight = push.areaHeight > 0 ? Math.max(CONSOLE_HEIGHT.min, Math.floor(push.areaHeight - CONSOLE_HEIGHT.reveal)) : CONSOLE_HEIGHT.max;
  const clamp = (h: number) => Math.max(CONSOLE_HEIGHT.min, Math.min(maxHeight, Math.round(h)));
  const height = dragHeight ?? pending ?? push.height;
  const task = push.task && push.task.nonce !== taken.current ? push.task : null;
  return (
    <LangContext.Provider value={lang}>
      <ConsolePanel
        key="drawer"
        serviceKey={push.key}
        onFocusOut={focusOut}
        height={height}
        maxHeight={maxHeight}
        onHeight={(h, commit) => {
          if (commit) { setDragHeight(null); setPending(clamp(h)); api().drawerChange({ kind: 'height', height: clamp(h) }); } else setDragHeight(clamp(h));
        }}
        onDrag={(active) => api().drawerDrag(active)}
        onHide={() => api().drawerChange({ kind: 'hide' })}
        task={task}
        onTaskTaken={() => { if (push.task) { taken.current = push.task.nonce; api().drawerChange({ kind: 'taskTaken', nonce: push.task.nonce }); } }}
      />
    </LangContext.Provider>
  );
}
// #endregion console-drawer
