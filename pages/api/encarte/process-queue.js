/**
 * GET /api/encarte/process-queue
 * Chama POST /api/encarte/extract até MAX_BATCH vezes (Cloud Scheduler / cron).
 * Header: x-cron-secret = CRON_SECRET (obrigatório se CRON_SECRET estiver definido)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret =
    process.env.CRON_SECRET?.trim() || process.env.ENCARTE_EXTRACT_SECRET?.trim();
  if (secret) {
    const h = req.headers['x-cron-secret'] || req.headers['X-Cron-Secret'];
    if (h !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    ''
  ).replace(/\/$/, '');

  if (!baseUrl) {
    return res.status(500).json({ error: 'Defina NEXT_PUBLIC_APP_URL ou NEXTAUTH_URL para o cron chamar /api/encarte/extract' });
  }

  const MAX_BATCH = Math.min(20, Math.max(1, Number.parseInt(process.env.ENCARTE_QUEUE_BATCH || '5', 10) || 5));
  const results = [];

  const headers = { 'Content-Type': 'application/json' };
  if (secret) {
    headers['x-cron-secret'] = secret;
  }

  for (let i = 0; i < MAX_BATCH; i += 1) {
    try {
      const r = await fetch(`${baseUrl}/api/encarte/extract`, {
        method: 'POST',
        headers,
      });
      const data = await r.json().catch(() => ({}));
      if (data?.message === 'Nenhum encarte pendente') break;
      results.push({ status: r.status, ...data });
      if (!r.ok) break;
    } catch (e) {
      results.push({ error: e?.message || String(e) });
      break;
    }
  }

  return res.status(200).json({ processed: results.length, results });
}
