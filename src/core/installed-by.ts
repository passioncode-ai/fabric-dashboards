// FD-161: who installed an agent (the descriptor's installedBy, contract DEC-0061), in words a person reads on its Health
// tab. The object form names a role, never a person: a person who uses this machine (the operator) or an organization's
// administrator, Project Observatory's node from the person's estate record, or the node from an organization's listing.
// The older form is the installer's own name and stays as the service wrote it.
// #region installed-by — docs: docs/ux/scenarios.md#scn-025-run-doctor-and-read-logs
import type { Descriptor } from '@passioncode-ai/fabric-service-host';

export interface InstalledByWords { code: string; params: Record<string, string> }

/** The words for a descriptor's installedBy, or null when it names none. */
export function installedByWords(d: Pick<Descriptor, 'installedBy'> | null | undefined): InstalledByWords | null {
  const v = d?.installedBy as unknown;
  if (typeof v === 'string') return v.trim() ? { code: 'installedBy.tool', params: { tool: v.trim() } } : null;
  if (!v || typeof v !== 'object') return null;
  const o = v as { by?: unknown; role?: unknown; tool?: unknown };
  const tool = typeof o.tool === 'string' ? o.tool.trim() : '';
  const by = o.by === 'person' ? (o.role === 'administrator' ? 'administrator' : o.role === 'operator' ? 'operator' : 'person')
    : o.by === 'node' ? 'node' : o.by === 'organization' ? 'organization' : null;
  if (!by) return tool ? { code: 'installedBy.tool', params: { tool } } : null;
  return { code: `installedBy.${by}`, params: { tool } };
}
// #endregion installed-by
