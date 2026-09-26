#!/usr/bin/env node
/**
 * Casa unidades Sonda com CEPs do site (match por label + rua) e regrava o manifest.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { chromium } from 'playwright';
import { fetchSondaPhysicalStoresFromSite } from '../apps/consumer/lib/sondaScraper/scraperSondaCore.js';

config({ path: resolve(process.cwd(), '.env.local') });
config();

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const manifestPath = resolve(process.cwd(), 'scripts/sonda-unidades-mapa-sp-2026-07.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const physical = await fetchSondaPhysicalStoresFromSite(page);
await browser.close();
console.log('physical', physical.length);
for (const p of physical) {
  console.log('-', p.cep, '|', p.addressLine);
}

const units = [];
for (const u of manifest.units) {
  const labelN = norm(u.label);
  const addrN = norm(u.address);
  let best = null;
  for (const st of physical) {
    const hay = norm(st.addressLine);
    let score = 0;
    for (const t of labelN.split(' ').filter((x) => x.length > 3)) {
      if (hay.includes(t)) score += 3;
    }
    for (const t of addrN.split(' ').filter((x) => x.length > 4)) {
      if (hay.includes(t)) score += 1;
    }
    const num = String(u.address).match(/\b(\d{2,5})\b/);
    if (num && hay.includes(num[1])) score += 2;
    if (!best || score > best.score) best = { score, st };
  }
  if (best && best.score >= 3) {
    units.push({
      ...u,
      siteCep: best.st.cep,
      siteAddressNote: best.st.addressLine,
      matchQuality: best.score >= 6 ? 'exact' : 'proximate',
      matchScore: best.score,
    });
    console.log('✓', u.label, '→', best.st.cep, best.st.addressLine, 'score', best.score);
  } else {
    units.push({ ...u, pinOnly: true, pinOnlyReason: 'Sem match CEP no site Sonda', matchScore: best?.score || 0 });
    console.log('~', u.label, 'pin only best', best?.score, best?.st?.addressLine);
  }
}

writeFileSync(manifestPath, JSON.stringify({ ...manifest, units }, null, 2), 'utf8');
console.log('Wrote', manifestPath);
