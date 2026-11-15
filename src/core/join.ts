// #region org-join — docs: docs/ux/scenarios.md#scn-115-join-an-organization
// FD-248 (step 7): Join an organization. Membership belongs to the organization's own service; this app only opens its
// page in the browser, and only on its host (design 2026-11-15, decision 7). Nothing is stored here: the organization
// arrives at the next read of the organizations map.

/** The organizations service's host until the contract names others. */
export const JOIN_HOST = 'org.passioncode.ai';
export const JOIN_URL = `https://${JOIN_HOST}/`;

/** The page Join opens: the pasted invite link when it is `https` on JOIN_HOST, the service's own page when none is
 *  given; anything else is refused before it reaches a browser. */
export function joinLink(raw?: string | null): { ok: true; url: string } | { ok: false; why: 'host' } {
  const text = (raw ?? '').trim();
  if (!text) return { ok: true, url: JOIN_URL };
  if (text.length > 2048) return { ok: false, why: 'host' };
  let u: URL;
  try { u = new URL(text); } catch { return { ok: false, why: 'host' }; }
  if (u.protocol !== 'https:' || u.hostname.toLowerCase() !== JOIN_HOST || u.username || u.password || (u.port && u.port !== '443')) return { ok: false, why: 'host' };
  return { ok: true, url: u.toString() };
}
// #endregion org-join
