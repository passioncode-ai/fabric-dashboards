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

// #region template-copy — docs: docs/ux/scenarios.md#scn-025-run-doctor-and-read-logs
/** FD-336 (the agents base's `patterns/template-update`, decision D-71): the extension an organization's copy writes about
 *  its template, in its well-known (preferred) or its descriptor. */
export const TEMPLATE_EXTENSION = 'https://fabric.passioncode.ai/agents-database/extensions/template/0.1';

export interface TemplateWords { code: string; params: Record<string, string> }

/** «Template X, version V, etalon E» for an agent built from an etalon, or null when it names no template. */
export function templateWords(...sources: unknown[]): TemplateWords | null {
  const raw = sources.map((s) => (s as { extensions?: Record<string, unknown> } | null | undefined)?.extensions?.[TEMPLATE_EXTENSION]).find((v) => v && typeof v === 'object') as Record<string, unknown> | undefined;
  if (!raw) return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : '');
  const template = str(raw.template);
  if (!template) return null;
  const version = str(raw.version);
  const etalon = raw.etalon && typeof raw.etalon === 'object' ? str((raw.etalon as Record<string, unknown>).version) : '';
  const state = ['behind', 'current', 'ahead', 'unknown', 'no-receipt'].includes(String(raw.state)) ? String(raw.state) : 'unknown';
  return { code: `template.${state}`, params: { template, version: version || '?', etalon: etalon || '?' } };
}
// #endregion template-copy
