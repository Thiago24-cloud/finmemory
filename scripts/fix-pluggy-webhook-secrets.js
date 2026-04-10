/**
 * Corrige webhooks Pluggy que não enviam X-Pluggy-Webhook-Secret (401 em produção).
 * Lista GET /webhooks, para cada URL …/api/pluggy/webhook cujo header não coincide com PLUGGY_WEBHOOK_SECRET:
 * apaga e volta a criar com o mesmo evento e URL.
 *
 *   npm run pluggy:fix-webhook-secrets
 *
 * Requer: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_WEBHOOK_SECRET
 * e PLUGGY_WEBHOOK_URL ou NEXT_PUBLIC_APP_URL / NEXTAUTH_URL (como no register-pluggy-webhook.js).
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function normalizeUrl(u) {
  return String(u || '')
    .trim()
    .replace(/\/$/, '');
}

function resolveWebhookUrl() {
  const explicit = process.env.PLUGGY_WEBHOOK_URL?.trim();
  if (explicit) return normalizeUrl(explicit);
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    '';
  if (!base) return '';
  const root = normalizeUrl(base);
  if (root.includes('/api/pluggy/webhook')) return root;
  return `${root}/api/pluggy/webhook`;
}

function headerSecret(webhook) {
  const h = webhook.headers;
  if (!h || typeof h !== 'object') return '';
  const v =
    h['X-Pluggy-Webhook-Secret'] ||
    h['x-pluggy-webhook-secret'] ||
    '';
  return String(v).trim();
}

function isFinmemoryWebhookPath(url) {
  return /\/api\/pluggy\/webhook$/i.test(normalizeUrl(url));
}

async function main() {
  const { PluggyClient } = await import('pluggy-sdk');

  const clientId = process.env.PLUGGY_CLIENT_ID?.trim();
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim();
  const expectedSecret = process.env.PLUGGY_WEBHOOK_SECRET?.trim();
  const primaryUrl = resolveWebhookUrl();

  if (!clientId || !clientSecret) {
    console.error('Defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET.');
    process.exit(1);
  }
  if (!expectedSecret) {
    console.error('Defina PLUGGY_WEBHOOK_SECRET (tem de coincidir com Cloud Run e com o header nos webhooks).');
    process.exit(1);
  }

  const pluggy = new PluggyClient({ clientId, clientSecret });
  const resp = await pluggy.fetchWebhooks();
  const results = resp?.results ?? [];

  const toFix = results.filter((w) => {
    if (!w?.url || !w?.event) return false;
    if (!isFinmemoryWebhookPath(w.url)) return false;
    return headerSecret(w) !== expectedSecret;
  });

  if (!toFix.length) {
    console.log('Nenhum webhook FinMemory sem o segredo correto (ou lista vazia).', {
      total: results.length,
      primaryUrl: primaryUrl || '(defina PLUGGY_WEBHOOK_URL se quiser documentar)',
    });
    return;
  }

  console.log('A corrigir', toFix.length, 'webhook(s) (header em falha ou diferente do .env)…');

  for (const w of toFix) {
    const url = normalizeUrl(w.url);
    const event = w.event;
    const id = w.id;
    try {
      await pluggy.deleteWebhook(id);
      console.log('Removido', id, event, url);
    } catch (e) {
      console.error('Falha ao remover', id, e?.message || e);
      continue;
    }
    try {
      const created = await pluggy.createWebhook(event, url, {
        'X-Pluggy-Webhook-Secret': expectedSecret,
      });
      console.log('Recriado', created?.id, event, url);
    } catch (e) {
      console.error('Falha ao recriar', event, url, e?.message || e);
    }
  }

  console.log('Concluído. Volta a correr fetchWebhooks se quiseres confirmar os headers.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
