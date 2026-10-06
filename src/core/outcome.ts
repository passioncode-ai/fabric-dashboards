// What a finished doctor/update command came to, as a reason the app, the activity log and the
// page all word the same way (P-4, T-6). No Node imports: the renderer uses it too.
import type { Reason } from './types';

export interface CommandResult { code: number | null; output: string; timedOut: boolean; started?: boolean; signal?: string | null }

/** `started: false` is the only "could not run"; a command ended by a signal says which one. */
export function commandReason(r: CommandResult, command: string): Reason {
  if (r.timedOut) return { code: 'result.commandTimeout', params: { command } };
  if (r.code !== null) return { code: 'result.command', params: { command, code: r.code } };
  if (r.signal) return { code: 'result.commandSignal', params: { command, signal: r.signal } };
  if (r.started === false || r.started === undefined) {
    return { code: 'result.commandFailed', params: { command, error: r.output.trim().split('\n').pop()?.slice(0, 200) ?? '' } };
  }
  return { code: 'result.commandSignal', params: { command, signal: '?' } };
}

/** Whether the command ran at all, so its output is worth showing. */
export const commandRan = (r: CommandResult): boolean => r.timedOut || r.code !== null || Boolean(r.signal) || r.started === true;
