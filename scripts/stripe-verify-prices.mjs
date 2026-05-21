#!/usr/bin/env node
/**
 * Valida Price IDs Stripe (local .env.local).
 * Uso: node scripts/stripe-verify-prices.mjs
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import Stripe from 'stripe';
import { stripePriceIdsFromEnv } from '../lib/stripePlanPrice.js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const secret = process.env.STRIPE_SECRET_KEY?.trim();
if (!secret) {
  console.error('STRIPE_SECRET_KEY ausente');
  process.exit(1);
}

const stripe = new Stripe(secret);
const prices = stripePriceIdsFromEnv();
const mode = secret.startsWith('sk_live') ? 'live' : 'test';

console.log('Modo Stripe:', mode);
for (const [plan, priceId] of Object.entries(prices)) {
  if (!priceId) {
    console.log(`[${plan}] SEM PRICE ID`);
    continue;
  }
  try {
    const p = await stripe.prices.retrieve(priceId);
    const active = p.active ? 'ativo' : 'INATIVO';
    const cur = p.currency;
    const amt = p.unit_amount != null ? (p.unit_amount / 100).toFixed(2) : '?';
    console.log(`[${plan}] OK ${priceId} — ${active} ${cur} ${amt}`);
  } catch (e) {
    console.log(`[${plan}] ERRO ${priceId} —`, e.message);
  }
}
