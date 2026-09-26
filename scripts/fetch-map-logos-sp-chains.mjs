#!/usr/bin/env node
/**
 * Baixa logos (Google favicon 128) para /public/map-logos.
 */
import { writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../apps/consumer/public/map-logos');
mkdirSync(outDir, { recursive: true });

const brands = [
  { file: 'dia.png', host: 'dia.com.br' },
  { file: 'assai.png', host: 'assai.com.br' },
  { file: 'mambo.png', host: 'mambo.com.br' },
  { file: 'sonda.png', host: 'sonda.com.br' },
  { file: 'atacadao.png', host: 'atacadao.com.br' },
];

for (const b of brands) {
  const dest = resolve(outDir, b.file);
  if (existsSync(dest) && statSync(dest).size > 200) {
    console.log('exists', b.file);
    continue;
  }
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(b.host)}&sz=128`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FinMemoryMapLogos/1.0', Accept: 'image/*' },
  });
  if (!res.ok) {
    console.error('FAIL', b.host, res.status);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  console.log('saved', b.file, buf.length, 'bytes');
}
