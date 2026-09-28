// Renders the vendored Dashboards mark into build/icon.icns on the macOS icon
// grid (an 824 px body on a 1024 px canvas, as Fabric Inbox does), and draws
// the three menu-bar template images: calm, degraded, problem.
// Run: npm run icon
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(path.join(root, 'src/renderer/brand/dashboards-mark.svg'));
const dir = mkdtempSync(path.join(tmpdir(), 'fd-icon-'));
const iconset = path.join(dir, 'icon.iconset');
mkdirSync(iconset);
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
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(root, 'build/icon.icns')]);
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
for (const [name, body] of Object.entries(variants)) {
  const doc = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">${body}</svg>`);
  await sharp(doc, { density: 72 }).resize(18, 18).png().toFile(path.join(root, `build/assets/${name}Template.png`));
  await sharp(doc, { density: 144 }).resize(36, 36).png().toFile(path.join(root, `build/assets/${name}Template@2x.png`));
}
console.log('build/icon.icns, build/assets/tray*Template.png');
