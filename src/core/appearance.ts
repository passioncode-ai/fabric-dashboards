// #region appearance-carrier — docs: docs/ux/scenarios.md#scn-067-dashboards-take-my-scheme-and-theme
// FD-42, FD-56 (contract DEC-0036 ED-8/ED-10, amended by DEC-0059): the operator's colour scheme and
// theme reach each dashboard as the cookie `fabric_appearance`, in that service's own partition
// (`persist:svc-<key>`), so here it is per service. A page applies only the fields it declares; one
// that declares none reads no cookie, so a change is written and nothing is reloaded. Pure.
import type { HostView } from '@passioncode-ai/fabric-service-host';

/** ED-10's reference themes, `graphite` the default. */
export const REFERENCE_THEMES = ['graphite', 'fabric', 'paper', 'forest', 'ocean', 'ember', 'contrast'] as const;
export const DEFAULT_PAGE_THEME = 'graphite';

export type Scheme = 'system' | 'light' | 'dark';

/**
 * The cookie's value. `system` carries no `scheme`: the page then follows `prefers-color-scheme`, which
 * this host keeps in agreement through `nativeTheme` (ED-8). A theme the page declares it does not ship
 * (its `themes` list) is not sent, so the page keeps its own default rather than an id it cannot show.
 */
export function appearanceValue(choice: { scheme: Scheme; theme: string }, view: Pick<HostView, 'themes'> | null): string {
  const q = new URLSearchParams({ v: '1' });
  if (choice.scheme !== 'system') q.set('scheme', choice.scheme);
  if (/^[a-z][a-z0-9-]{0,31}$/.test(choice.theme) && (!view?.themes || view.themes.includes(choice.theme))) q.set('theme', choice.theme);
  return q.toString();
}

/** ED-8's cookie: path `/`, `SameSite=Strict`, readable by the page's script, `Secure` on https. */
export function appearanceCookie(origin: string, value: string): { url: string; name: 'fabric_appearance'; value: string; path: '/'; sameSite: 'strict'; httpOnly: false; secure: boolean } {
  const u = new URL(origin);
  return { url: u.origin, name: 'fabric_appearance', value, path: '/', sameSite: 'strict', httpOnly: false, secure: u.protocol === 'https:' };
}

/** The dashboard view's own background before the page paints: the brand's --pc-bg of the scheme in force. */
export function viewBackground(scheme: Scheme, systemDark: boolean): string {
  const dark = scheme === 'dark' || (scheme === 'system' && systemDark);
  return dark ? '#0a070d' : '#ffffff';
}

/** FD-221: the background once the page has loaded. A page that does not declare a dark colour scheme (CSS
 *  `color-scheme` on its root, or `<meta name="color-scheme">`) draws its default text black on a canvas a browser
 *  paints white; the app's dark background behind it would leave that text unreadable. Only a page that declares dark
 *  keeps the dark one, and only while the scheme in force is dark. `declared` is both declarations joined, `null`
 *  when they could not be read (the page's own background stays as it was). */
export function loadedBackground(scheme: Scheme, systemDark: boolean, declared: string | null): string | null {
  if (declared === null) return null;
  return /(^|\s)dark(\s|$)/.test(declared.toLowerCase()) ? viewBackground(scheme, systemDark) : '#ffffff';
}

/** FD-221: read in an isolated world, so the page's own script cannot answer for it; reads only, writes nothing. */
export const PAGE_SCHEME_SCRIPT = "(() => { const m = document.querySelector('meta[name=\"color-scheme\"]'); return [getComputedStyle(document.documentElement).colorScheme || '', m ? m.getAttribute('content') || '' : ''].join(' '); })()";
// #endregion appearance-carrier
