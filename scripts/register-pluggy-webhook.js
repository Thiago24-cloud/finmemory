/**
 * Regista webhooks na Pluggy (POST /webhooks). Um pedido por evento — a API não aceita `event: 'all'`
 * em todas as contas; o campo `events: []` num único body também não faz parte do SDK oficial.
 *
 * Uso:
 *   npm run pluggy:register-webhook
 *   node -r dotenv/config scripts/register-pluggy-webhook.js
 *
 * SDK: createWebhook(event, url, headers) — ver pluggy-sdk dist/client.js
 *
 * Env:
 *   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET (obrigatórios)
 *   PLUGGY_WEBHOOK_URL ou NEXT_PUBLIC_APP_URL / NEXTAUTH_URL
 *   PLUGGY_WEBHOOK_SECRET — opcional (header X-Pluggy-Webhook-Secret)
 *   PLUGGY_WEBHOOK_EVENT — opcional: lista separada por vírgulas, ou omitir / "all" para o pacote predefinido
 *
 * @see https://docs.pluggy.ai/reference/webhooks-create
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/** Eventos que o FinMemory trata em pages/api/pluggy/webhook.js */
const DEFAULT_EVENTS = [
  'item/created',
  'item/updated',
  'item/error',
  'item/deleted',
  'item/waiting_user_input',
  'item/login_succeeded',
  'transactions/created',
  'transactions/updated',
  'transactions/deleted',
];

function resolveWebhookUrl() {
  const explicit = process.env.PLUGGY_WEBHOOK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    '';
  if (!base) return '';
  const root = base.replace(/\/$/, '');
  if (root.includes('/api/pluggy/webhook')) return root;
  return `${root}/api/pluggy/webhook`;
}

function resolveEventsList() {
  const raw = process.env.PLUGGY_WEBHOOK_EVENT?.trim();
  if (!raw || raw.toLowerCase() === 'all' || raw === '*') {
    return [...DEFAULT_EVENTS];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function errMessage(err) {
  if (err && typeof err === 'object') {
    if (typeof err.message === 'string') return err.message;
    return JSON.stringify(err);
  }
  return String(err);
}

function isAlreadyExists(err) {
  const m = errMessage(err).toLowerCase();
  return (
    m.includes('already exists') ||
    m.includes('já existe') ||
    m.includes('already created') ||
    m.includes('duplicate')
  );
}

async function main() {
  const { PluggyClient } = await import('pluggy-sdk');

  const clientId = process.env.PLUGGY_CLIENT_ID?.trim();
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim();
  const webhookSecret = process.env.PLUGGY_WEBHOOK_SECRET?.trim();
  const url = resolveWebhookUrl();
  const events = resolveEventsList();

  const headers = webhookSecret ? { 'X-Pluggy-Webhook-Secret': webhookSecret } : undefined;

  if (!clientId || !clientSecret) {
    console.error('Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no .env.local ou .env');
    process.exit(1);
  }
  if (!url || !/^https:\/\//i.test(url)) {
    console.error(
      'Defina PLUGGY_WEBHOOK_URL (https://...) ou NEXT_PUBLIC_APP_URL / NEXTAUTH_URL para montar /api/pluggy/webhook'
    );
    process.exit(1);
  }

  const pluggy = new PluggyClient({ clientId, clientSecret });
  console.log('A registar', events.length, 'webhook(s) em', url, { comHeaderSegredo: Boolean(webhookSecret) });

  const created = [];
  const skipped = [];
  const failed = [];

  for (const event of events) {
    try {
      const webhook = await pluggy.createWebhook(event, url, headers);
      created.push({ event, id: webhook?.id, webhook });
      console.log('OK', event, webhook?.id ?? webhook);
    } catch (e) {
      if (isAlreadyExists(e)) {
        skipped.push({ event, reason: errMessage(e) });
        console.warn('Já existia (ignorado):', event);
        continue;
      }
      failed.push({ event, error: errMessage(e) });
      console.error('Falha:', event, errMessage(e));
    }
  }

  console.log('\n--- Resumo ---');
  console.log('Criados:', created.length, skipped.length ? `| Ignorados (duplicado): ${skipped.length}` : '', failed.length ? `| Falhas: ${failed.length}` : '');
  if (created.length) console.log(JSON.stringify(created.map((c) => ({ event: c.event, id: c.id })), null, 2));
  if (failed.length) {
    console.error(JSON.stringify(failed, null, 2));
    process.exit(1);
  }
}

main();
