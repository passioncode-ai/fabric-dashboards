// Scenario walk 2026-11-11 (SCN-068): one service's bad answer must not blank the whole window. React unmounts the
// whole tree on a render error with no boundary; this one keeps the error inside the tab that threw, says so in the
// person's language, and tries again when the service's snapshot or the tab changes.
import { Component, type ReactNode } from 'react';
import { useT } from '../lib';

interface Props {
  /** The agent's name, for the message. */
  name: string;
  /** A changed value (the next snapshot, another tab or agent) clears a caught error and renders the children again;
   *  compared item by item, so no remount and no new key. */
  reset: readonly unknown[];
  children: ReactNode;
}

interface State { error: Error | null }

export class PaneBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && changed(prev.reset, this.props.reset)) this.setState({ error: null });
  }

  render(): ReactNode {
    if (this.state.error) return <PaneError name={this.props.name} error={this.state.error.message} />;
    return this.props.children;
  }
}

export function changed(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length !== b.length || a.some((x, i) => x !== b[i]);
}

export function PaneError({ name, error }: { name: string; error: string }) {
  const { t } = useT();
  return <div className="pane"><p className="notice error" role="alert">{t('view.paneError', { name, error })}</p></div>;
}
