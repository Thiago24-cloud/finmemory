/**
 * Autenticação por API Key para webhook de maquininha (WEBHOOK_API_KEY).
 * Em dev, sem chave configurada, libera com aviso no log.
 */
export function requireWebhookApiKey(req, res) {
  const configuredKey = process.env.WEBHOOK_API_KEY;

  if (!configuredKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[vendas/webhook] WEBHOOK_API_KEY não configurado — modo dev');
    }
    return true;
  }

  const authHeader = req.headers.authorization;
  const xApiKey = req.headers['x-api-key'];

  let provided;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    provided = authHeader.slice(7).trim();
  } else if (typeof xApiKey === 'string') {
    provided = xApiKey.trim();
  }

  if (!provided) {
    res.status(401).json({
      error: 'Não autorizado',
      hint: 'Envie Authorization: Bearer <WEBHOOK_API_KEY> ou X-Api-Key',
    });
    return false;
  }

  if (provided !== configuredKey) {
    res.status(403).json({ error: 'API Key inválida' });
    return false;
  }

  return true;
}

export function getWebhookKeyStatus() {
  const key = process.env.WEBHOOK_API_KEY;
  const configured = Boolean(key);
  return {
    key_configured: configured,
    key_prefix: configured ? `${key.slice(0, 7)}...` : null,
    message: configured
      ? 'Webhook protegido por API Key'
      : 'WEBHOOK_API_KEY não definido — modo desenvolvimento (sem autenticação)',
  };
}
