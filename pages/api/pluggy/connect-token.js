import { PluggyClient } from 'pluggy-sdk';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

/** @param {string | undefined} raw */
function parseConnectorIdFromEnv(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * ID do conector sandbox "Pluggy Bank" (trial/demo). Opcional: PLUGGY_SANDBOX_CONNECTOR_ID.
 * Caso contrário, lista conectores com sandbox=true e encontra por nome.
 */
async function resolvePluggyBankSandboxConnectorId(pluggy) {
  const fromEnv = parseConnectorIdFromEnv(process.env.PLUGGY_SANDBOX_CONNECTOR_ID);
  if (fromEnv != null) return fromEnv;

  const tryNames = ['Pluggy Bank', 'Pluggy'];
  for (const name of tryNames) {
    const resp = await pluggy.fetchConnectors({ sandbox: true, name });
    const results = resp?.results ?? [];
    const match = results.find(
      (c) => typeof c?.name === 'string' && /pluggy\s*bank/i.test(c.name.trim())
    );
    if (match?.id) return match.id;
  }

  const allSandbox = await pluggy.fetchConnectors({ sandbox: true });
  const list = allSandbox?.results ?? [];
  const fallback = list.find(
    (c) => typeof c?.name === 'string' && /pluggy\s*bank/i.test(c.name.trim())
  );
  return fallback?.id ?? null;
}

/**
 * POST /api/pluggy/connect-token
 * Gera accessToken (connect token) para abrir o widget Pluggy Connect.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  /** Mesmo id nos webhooks item/* (clientUserId) — preferir UUID Supabase. */
  const pluggyClientUserId = session.user.supabaseId || session.user.email;

  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: 'Pluggy não configurado (defina PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET)',
    });
  }

  try {
    const pluggy = new PluggyClient({ clientId, clientSecret });
    const { accessToken } = await pluggy.createConnectToken(undefined, {
      clientUserId: pluggyClientUserId,
    });

    /** Em trial, só conectores sandbox (ex.: Pluggy Bank). Produção com bancos reais: defina PLUGGY_WIDGET_SANDBOX_CONNECTOR_ONLY=false */
    const useSandboxConnectorOnly = process.env.PLUGGY_WIDGET_SANDBOX_CONNECTOR_ONLY !== 'false';
    let sandboxConnectorId = null;
    if (useSandboxConnectorOnly) {
      try {
        sandboxConnectorId = await resolvePluggyBankSandboxConnectorId(pluggy);
      } catch (e) {
        console.warn('[pluggy/connect-token] não foi possível resolver Pluggy Bank:', e?.message || e);
      }
    }

    return res.status(200).json({
      accessToken,
      useSandboxConnectorOnly,
      sandboxConnectorId,
    });
  } catch (err) {
    console.error('[pluggy/connect-token]', err);
    return res.status(500).json({
      error: err?.message || 'Falha ao criar connect token',
    });
  }
}
