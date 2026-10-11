// #region fabric-button — docs: docs/adr/0021-fabrics-button-in-the-host.md#decision
// FD-45 (contract DEC-0040, ADR-0021): Fabric's button on a service page. Pure and Node-free: what the
// button does for one service, and the `fabric_button` cookie the host sets on the page it embeds. The
// main process asks the OS whether anything handles `fabric://` and opens the link; nothing here starts
// a process, sends a message or spends money (FB-8) — the link only opens a view in Fabric.
import { AGENT_ID, buildFabricLink } from './fabric-links';

/** Where Fabric is to be had when it is not installed (FB-5): the only page the button links to. */
export const FABRIC_GET_URL = 'https://passioncode.ai/fabric';

/** What a press of the button does. */
export type FabricPress =
  /** Fabric is installed and there is one action: open the chat link at once (FB-4, no menu). */
  | { kind: 'direct'; url: string }
  /** Fabric is not installed: a menu with the one sentence and its link (FB-5). */
  | { kind: 'absent' }
  /** The service id is outside the hub's agent-id grammar: no button (a link would be refused). */
  | { kind: 'none' };

/**
 * The button for a service. The project is left to Fabric: it finds it from the service's own
 * descriptor (`source.repository`, its REQ-05 resolver) and asks inside the conversation when unsure, so
 * the chat link carries the service only and the session item of FB-4 is never offered by this host.
 */
export function fabricPress(serviceKey: string, fabricPresent: boolean): FabricPress {
  if (!AGENT_ID.test(serviceKey)) return { kind: 'none' };
  if (!fabricPresent) return { kind: 'absent' };
  return { kind: 'direct', url: buildFabricLink({ action: 'chat', service: serviceKey }) };
}

/** Whether a handler for `fabric://` is installed, from the name the OS gives for it ('' when none). */
export const fabricPresentFrom = (handlerName: string): boolean => handlerName.trim() !== '';

/**
 * FB-6: the cookie that tells an embedded page the host draws Fabric's button, so the page hides its
 * own. The attributes of the appearance carrier (ED-8): path `/`, `SameSite=Strict`, readable by the
 * page (not HttpOnly), `Secure` on https. It carries no secret and no identity.
 */
export function fabricButtonCookie(origin: string, o: { hostDraws: boolean; fabricPresent: boolean }): { url: string; name: 'fabric_button'; value: string; path: '/'; sameSite: 'strict'; httpOnly: false; secure: boolean } {
  const value = new URLSearchParams({ v: '1', owner: o.hostDraws ? 'host' : 'page', fabric: o.fabricPresent ? 'present' : 'absent' }).toString();
  return { url: new URL(origin).origin, name: 'fabric_button', value, path: '/', sameSite: 'strict', httpOnly: false, secure: new URL(origin).protocol === 'https:' };
}
// #endregion fabric-button
