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
  const taken = useRef<number | null>(null);
  useEffect(() => {
    document.documentElement.classList.add('drawer-page');
    void api().locale().then((l) => { setLang(langFor(l)); document.documentElement.lang = langFor(l); });
    void api().settings().then((s) => applyTheme(s.theme));
    return api().onDrawer(setPush);
  }, []);
  if (!push?.key) return null;
  const maxHeight = push.areaHeight > 0 ? Math.max(CONSOLE_HEIGHT.min, Math.floor(push.areaHeight - CONSOLE_HEIGHT.reveal)) : CONSOLE_HEIGHT.max;
  const clamp = (h: number) => Math.max(CONSOLE_HEIGHT.min, Math.min(maxHeight, Math.round(h)));
  const height = dragHeight ?? push.height;
  const task = push.task && push.task.nonce !== taken.current ? push.task : null;
  return (
    <LangContext.Provider value={lang}>
      <ConsolePanel
        serviceKey={push.key}
        height={height}
        maxHeight={maxHeight}
        onHeight={(h, commit) => {
          if (commit) { setDragHeight(null); api().drawerChange({ kind: 'height', height: clamp(h) }); } else setDragHeight(clamp(h));
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
