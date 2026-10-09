// Renders the vendored Dashboards mark into build/icon.icns on the macOS icon
// grid (an 824 px body on a 1024 px canvas, as Fabric Inbox does), build/icon.ico
// (Windows) and build/icon.png (Linux), and draws the tray images: macOS templates
// and the Windows/Linux colour set (FD-37) — calm, degraded, problem.
// Run: npm run icon
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'src/renderer/brand/dashboards-mark.svg'));
const dir = mkdtempSync(path.join(tmpdir(), 'fd-icon-'));
const iconset = path.join(dir, 'icon.iconset');
mkdirSync(iconset);
/** The mark on the icon grid at `px` pixels. */
async function gridIcon(px) {
  const body = Math.round((px * 824) / 1024);
  const art = await sharp(svg, { density: Math.max(72, Math.ceil((72 * body) / 256)) }).resize(body, body).png().toBuffer();
  const offset = Math.round((px - body) / 2);
  return sharp({ create: { width: px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: art, left: offset, top: offset }]).png().toBuffer();
}

/** An ICO file whose entries are PNG images (Windows Vista and later read PNG entries). */
export function icoFromPngs(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const entries = []; let offset = 6 + 16 * pngs.length;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
    entries.push(e); offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((x) => x.data)]);
}

try {
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const px = size * scale;
      const body = Math.round((px * 824) / 1024);
      const art = await sharp(svg, { density: Math.max(72, Math.ceil((72 * body) / 256)) }).resize(body, body).png().toBuffer();
      const offset = Math.round((px - body) / 2);
      await sharp({ create: { width: px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: art, left: offset, top: offset }]).png()
        .toFile(path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`));
    }
  }
  // iconutil exists only on macOS; build/icon.icns is committed, so other systems keep it as it is.
  if (process.platform === 'darwin') execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(root, 'build/icon.icns')]);
  const ico = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256]) ico.push({ size, data: await gridIcon(size) });
  writeFileSync(path.join(root, 'build/icon.ico'), icoFromPngs(ico));
  writeFileSync(path.join(root, 'build/icon.png'), await gridIcon(512));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// Menu bar: black shapes on transparent, marked as template images so macOS
// tints them for light and dark bars. The state is the SHAPE, not a colour:
// calm = four panels; degraded = one panel replaced by a triangle; problem = a filled dot.
const panel = (x, y, filled) => `<rect x="${x}" y="${y}" width="6" height="6" rx="1.5" ${filled ? 'fill="#000"' : 'fill="none" stroke="#000" stroke-width="1.6"'}/>`;
const variants = {
  tray: panel(2, 2, false) + panel(10, 2, true) + panel(2, 10, false) + panel(10, 10, false),
  trayDegraded: panel(2, 2, false) + panel(10, 2, true) + panel(2, 10, false) + '<path d="M13 9.5 L16.5 16 H9.5 Z" fill="#000"/>',
  trayProblem: panel(2, 2, false) + panel(10, 2, true) + panel(2, 10, false) + '<circle cx="13" cy="13" r="3.6" fill="#000"/>',
};
// macOS picks the 2x tray image by this suffix.
const RETINA = '@2x';
for (const [name, body] of Object.entries(variants)) {
  const doc = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">${body}</svg>`);
  await sharp(doc, { density: 72 }).resize(18, 18).png().toFile(path.join(root, `build/assets/${name}Template.png`));
  await sharp(doc, { density: 144 }).resize(36, 36).png().toFile(path.join(root, `build/assets/${name}Template${RETINA}.png`));
}
// FD-37 — Windows and Linux panels: the same shapes, white with a dark outline so they read on a light
// or dark taskbar, and the state also as a colour (amber triangle, red dot). Windows picks @2x at 200 %.
const outline = 'stroke="#1b1720" stroke-width="1.2" paint-order="stroke"';
const colourPanel = (x, y, filled) => `<rect x="${x}" y="${y}" width="6" height="6" rx="1.5" fill="${filled ? '#ffffff' : '#ffffff55'}" ${outline}/>`;
const base = colourPanel(1, 1, false) + colourPanel(9, 1, true) + colourPanel(1, 9, false);
const colour = {
  'tray-ok': base + colourPanel(9, 9, false),
  'tray-degraded': base + `<path d="M12 8.5 L15.5 15 H8.5 Z" fill="#f5b72a" ${outline}/>`,
  'tray-problem': base + `<circle cx="12" cy="12" r="3.6" fill="#ef4444" ${outline}/>`,
};
for (const [name, body] of Object.entries(colour)) {
  const doc = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${body}</svg>`);
  await sharp(doc, { density: 72 }).resize(16, 16).png().toFile(path.join(root, `build/assets/${name}.png`));
  await sharp(doc, { density: 144 }).resize(32, 32).png().toFile(path.join(root, `build/assets/${name}${RETINA}.png`));
}
console.log('build/icon.icns, build/icon.ico, build/icon.png, build/assets/tray*Template.png, build/assets/tray-*.png');
