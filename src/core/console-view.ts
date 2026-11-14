// #region console-runtime-row — docs: docs/ux/scenarios.md#scn-048-open-an-agents-console-over-its-dashboard
// FD-239: the console's head row offers the coding agents as buttons, the chosen one pressed, so New session is one
// press away; the rest of the installed ones stay in a compact «More» list. Pure, for the renderer and its tests.

/** The agents shown as buttons: Claude Code and Codex when installed, then the chosen one if it is neither; at most
 *  `max`. Every other installed agent goes to `more`, in the order given. */
export function runtimeRow<T extends { id: string }>(runtimes: T[], chosen: string | null, max = 3): { inline: T[]; more: T[] } {
  const ids = ['claude-code', 'codex'];
  const inline = runtimes.filter((r) => ids.includes(r.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const picked = runtimes.find((r) => r.id === chosen);
  if (picked && !inline.includes(picked)) inline.push(picked);
  for (const r of runtimes) if (inline.length < Math.min(max, 2) && !inline.includes(r)) inline.push(r);
  const shown = inline.slice(0, max);
  return { inline: shown, more: runtimes.filter((r) => !shown.includes(r)) };
}
// #endregion console-runtime-row
