#!/usr/bin/env node
import { config } from 'dotenv';
import { resolve } from 'node:path';
import {
  inferImageQualifiersFromPrice,
  refineImageSearchWithGemini,
} from '../apps/consumer/lib/mapProductImagePriceAwarePlan.js';

config({ path: resolve(process.cwd(), '.env.local') });

const cases = [
  { nome: 'Bolo de Abacaxi', preco: 12.9, unidade: 'un' },
  { nome: 'Bolo de Abacaxi', preco: 55.0, unidade: 'un' },
];

console.log('GEMINI_REFINE=', process.env.MAP_PRODUCT_IMAGE_GEMINI_REFINE);
console.log('MODEL=', process.env.MAP_PRODUCT_IMAGE_GEMINI_MODEL || 'default');

for (const c of cases) {
  console.log('\n--- R$', c.preco, '---');
  const heur = inferImageQualifiersFromPrice(c);
  console.log('heurística:', heur.sizeHint);
  const g = await refineImageSearchWithGemini({ ...c, storeName: 'Sonda — Pompéia' });
  if (!g) {
    console.log('Gemini: sem resposta (ver console.warn acima)');
    continue;
  }
  console.log('queries:', g.searchQueries);
  console.log('context:', g.visionContext);
}
