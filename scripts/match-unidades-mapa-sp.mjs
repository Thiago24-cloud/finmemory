#!/usr/bin/env node
/**
 * Cruza scripts/unidades-mapa-sp-2026-07.json com catálogos oficiais DIA/Atacadão.
 * Uso: node scripts/match-unidades-mapa-sp.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { fetchDiaScraperStoresFromOfficial } from '../apps/consumer/lib/diaScraper/fetchDiaCatalogStores.js';
import { fetchAtacadaoScraperStoresFromOfficial } from '../apps/consumer/lib/atacadaoScraper/fetchAtacadaoCatalogStores.js';

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

function streetTokens(address) {
  const n = norm(address);
  const stop = new Set([
    'rua',
    'av',
    'avenida',
    'alameda',
    'estrada',
    'rodovia',
    'sao',
    'paulo',
    'sp',
    'de',
    'da',
    'do',
    'dos',
    'das',
    'e',
    'x',
    'km',
  ]);
  return n
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !stop.has(t) && !/^\d+$/.test(t));
}

function scoreMatch(unit, haystack) {
  const tokens = streetTokens(unit.address + ' ' + unit.label);
  const hay = norm(haystack);
  if (!tokens.length || !hay) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  const number = String(unit.address).match(/\b(\d{2,5})\b/);
  if (number && hay.includes(number[1])) hits += 2;
  return hits / (tokens.length + 2);
}

function bestMatch(unit, candidates, pickHay) {
  let best = null;
  for (const c of candidates) {
    const hay = pickHay(c);
    const score = scoreMatch(unit, hay);
    if (!best || score > best.score) best = { score, candidate: c, hay };
  }
  return best;
}

const list = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/unidades-mapa-sp-2026-07.json'), 'utf8'));

console.log('Buscando catálogo DIA…');
const diaStores = await fetchDiaScraperStoresFromOfficial();
console.log(`DIA: ${diaStores.length} lojas`);

console.log('Buscando catálogo Atacadão…');
const atacadaoStores = await fetchAtacadaoScraperStoresFromOfficial();
console.log(`Atacadão: ${atacadaoStores.length} lojas`);

const diaMatched = [];
const diaUnmatched = [];
for (const unit of list.chains.dia) {
  const best = bestMatch(
    unit,
    diaStores,
    (s) => `${s.storeName} ${s.addressForGeocode} ${s.id} ${s.slug || ''}`
  );
  if (best && best.score >= 0.35) {
    diaMatched.push({
      ...unit,
      score: Number(best.score.toFixed(3)),
      storeId: best.candidate.id,
      storeUrl: best.candidate.storeUrl,
      storeName: best.candidate.storeName,
      lat: best.candidate.lat,
      lng: best.candidate.lng,
    });
  } else {
    diaUnmatched.push({
      ...unit,
      bestScore: best ? Number(best.score.toFixed(3)) : 0,
      bestId: best?.candidate?.id || null,
      bestName: best?.candidate?.storeName || null,
    });
  }
}

const atacMatched = [];
const atacUnmatched = [];
for (const unit of list.chains.atacadao) {
  const best = bestMatch(
    unit,
    atacadaoStores,
    (s) => `${s.storeName} ${s.address || ''} ${s.city || ''} ${s.id} ${s.sellerId || ''}`
  );
  if (best && best.score >= 0.28) {
    atacMatched.push({
      ...unit,
      score: Number(best.score.toFixed(3)),
      storeId: best.candidate.id,
      sellerId: best.candidate.sellerId || best.candidate.id,
      storeName: best.candidate.storeName,
      cep: best.candidate.cep || null,
      lat: best.candidate.lat ?? null,
      lng: best.candidate.lng ?? null,
    });
  } else {
    atacUnmatched.push({
      ...unit,
      bestScore: best ? Number(best.score.toFixed(3)) : 0,
      bestId: best?.candidate?.id || null,
      bestName: best?.candidate?.storeName || null,
    });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  dia: { matched: diaMatched, unmatched: diaUnmatched },
  atacadao: { matched: atacMatched, unmatched: atacUnmatched },
  mambo: list.chains.mambo,
  sonda: list.chains.sonda,
  assai: list.chains.assai,
};

const outPath = resolve(process.cwd(), 'scripts/unidades-mapa-sp-2026-07.matched.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

console.log('\n=== DIA ===');
console.log(`matched ${diaMatched.length}/${list.chains.dia.length}`);
for (const m of diaMatched) console.log(`  ✓ ${m.label} → ${m.storeId} (${m.score})`);
for (const u of diaUnmatched) console.log(`  ✗ ${u.label} best=${u.bestId} (${u.bestScore})`);

console.log('\n=== ATACADÃO ===');
console.log(`matched ${atacMatched.length}/${list.chains.atacadao.length}`);
for (const m of atacMatched) console.log(`  ✓ ${m.label} → seller ${m.sellerId} / ${m.storeId} (${m.score})`);
for (const u of atacUnmatched) console.log(`  ✗ ${u.label} best=${u.bestId} (${u.bestScore})`);

console.log('\nWrote', outPath);
