import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccess } from '../../../lib/access-server';
import { canAccessAdminRoutes } from '../../../lib/adminAccess';

function safeFilenameFromUrl(rawUrl, fallback = 'encarte') {
  try {
    const u = new URL(rawUrl);
    const last = u.pathname.split('/').filter(Boolean).pop() || fallback;
    const cleaned = last.replace(/[^a-zA-Z0-9._-]/g, '_');
    return cleaned.length > 80 ? cleaned.slice(0, 80) : cleaned;
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  const allowed = await canAccessAdminRoutes(session.user.email, () =>
    canAccess(session.user.email)
  );
  if (!allowed) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  const rawUrl = String(req.query?.url || '').trim();
  if (!rawUrl) return res.status(400).json({ error: 'url obrigatória' });

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: 'URL inválida' });
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return res.status(400).json({ error: 'Apenas URLs http/https' });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'User-Agent': 'FinMemory-AdminArtifactDownloader/1.0',
      },
    });
    if (!upstream.ok) {
      return res.status(502).json({ error: `Falha ao baixar artefato (${upstream.status})` });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const filename = safeFilenameFromUrl(parsed.toString());
    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Erro ao baixar artefato' });
  }
}

