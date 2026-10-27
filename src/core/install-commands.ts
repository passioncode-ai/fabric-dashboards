// #region install-commands — docs: docs/ux/scenarios.md#scn-058-first-session-my-coding-agent-sets-the-system-up
/** UX-13 (FD-113, SCN-058 alt path): the vendors' own install commands for the coding agents the Setup console can
 *  start, shown on the setup card when none is installed. Sources: Claude Code, code.claude.com/docs (the native
 *  installer); Codex, github.com/openai/codex README (npm). The app only shows them; the person runs them. */
export interface InstallCommand { id: string; name: string; command: string }

export function installCommands(platform: 'mac' | 'windows' | 'other'): InstallCommand[] {
  return [
    { id: 'claude', name: 'Claude Code', command: platform === 'windows' ? 'irm https://claude.ai/install.ps1 | iex' : 'curl -fsSL https://claude.ai/install.sh | bash' },
    { id: 'codex', name: 'Codex', command: 'npm install -g @openai/codex' },
  ];
}
// #endregion install-commands
