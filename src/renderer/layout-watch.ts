// FD-274: the embedded dashboard is a native view laid over the page at the slot's rectangle. A ResizeObserver on the
// slot fires when the slot changes size, never when it only moves: when something above it grows (the task line, the
// opened details card, the instance switch, a state chip) the view stays where the slot was and covers that part of
// the page, so a click there reaches the agent's dashboard. Watching the size of everything above the slot catches it.

/** What a node needs here: the parent and the previous sibling, as the DOM gives them. */
export interface TreeNode { parentElement: TreeNode | null; previousElementSibling: TreeNode | null }

/** Every element whose size can move `el`: the previous siblings of `el` and of each of its ancestors, below `stop`
 *  (the document's body by default). At most `max` elements, nearest first. */
export function elementsAbove<T extends TreeNode>(el: T, stop: TreeNode | null = null, max = 64): T[] {
  const out: T[] = [];
  for (let node: TreeNode | null = el; node && node !== stop && out.length < max; node = node.parentElement) {
    for (let sib = node.previousElementSibling; sib && out.length < max; sib = sib.previousElementSibling) out.push(sib as T);
  }
  return out;
}
