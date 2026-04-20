/**
 * Remove fundo “caixa” claro ligado aos cantos do PNG (flood-fill por tolerância),
 * preservando o interior do ícone (cifrão branco não toca o canto da imagem).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const input = path.join(root, 'public', 'logo.png');
const output = path.join(root, 'public', 'logo.png');

const TOL = 38;

function similar(r, g, b, br, bg, bb) {
  return Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) <= TOL;
}

async function main() {
  const buf = fs.readFileSync(input);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const stride = 4;
  const pix = (x, y) => (y * w + x) * stride;

  const br = data[pix(0, 0)];
  const bg = data[pix(0, 0) + 1];
  const bb = data[pix(0, 0) + 2];

  const visited = new Uint8Array(w * h);
  const q = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (visited[i]) return;
    const p = pix(x, y);
    if (!similar(data[p], data[p + 1], data[p + 2], br, bg, bb)) return;
    visited[i] = 1;
    q.push(x, y);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  let qi = 0;
  while (qi < q.length) {
    const x = q[qi++];
    const y = q[qi++];
    const p = pix(x, y);
    data[p + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(output);

  console.log('strip-logo-corner-bg: wrote', output);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
