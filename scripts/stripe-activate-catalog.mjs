#!/usr/bin/env node
/**
 * Ativa produtos + preços Stripe configurados no .env (todos os planos pagos).
 * Uso: node -r dotenv/config scripts/stripe-activate-catalog.mjs
 * Requer STRIPE_SECRET_KEY no .env ou .env.local
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import Stripe from 'stripe';
import { stripePriceIdsFromEnv } from '../lib/stripePlanPrice.js';
import { ensureStripePricePurchasable } from '../lib/stripe/ensurePricePurchasable.js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) {
  console.error('Defina STRIPE_SECRET_KEY no .env.local');
  process.exit(1);
}

const stripe = new Stripe(key);
const prices = stripePriceIdsFromEnv();

for (const [plan, priceId] of Object.entries(prices)) {
  if (!priceId) {
    console.warn(`[skip] ${plan}: sem STRIPE_*_PRICE_ID`);
    continue;
  }
  try {
    const p = await ensureStripePricePurchasable(stripe, priceId);
    const prod = typeof p.product === 'object' ? p.product : null;
    console.log(`[ok] ${plan}: ${priceId} → produto "${prod?.name || '?'}" ativo`);
  } catch (e) {
    console.error(`[erro] ${plan} ${priceId}:`, e?.message || e);
    process.exitCode = 1;
  }
}

console.log('\nConcluído. Teste Assinar Pro no app.');
