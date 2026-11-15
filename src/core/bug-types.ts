// FD-263: the bug journal's types, without Node, so the window's code can name them.
export type BugWhere = 'main' | 'renderer' | 'view' | 'mcp' | 'process' | 'action';
export type BugKind = 'exception' | 'rejection' | 'crash' | 'failed';

export interface BugInput {
  where: BugWhere;
  kind: BugKind;
  /** The error's class (`TypeError`), a crash reason (`oom`) or a failed action's code. */
  name: string;
  message?: string;
  stack?: string;
  /** An action that failed: which one (`start`, `console`, ...). */
  action?: string;
}

export interface Bug {
  /** 12 hex: where, kind, name and the function names of our own top frames; never a message, a path or a value. */
  fp: string;
  where: BugWhere;
  kind: BugKind;
  name: string;
  action?: string;
  /** Scrubbed: home folder, user name, tokens and URLs' credentials removed; at most 500 characters. */
  message: string;
  /** Our own frames only (`src/core/x.ts:12 fn`), at most 8, scrubbed; a frame of a dependency or Node is left out. */
  frames: string[];
  count: number;
  firstSeen: string;
  lastSeen: string;
  versions: string[];
  /** The GitHub issue it was filed as, when it was. */
  issue?: string;
}

