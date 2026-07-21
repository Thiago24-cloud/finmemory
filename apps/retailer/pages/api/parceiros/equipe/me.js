import { serialize } from 'cookie';
import { EQUIPE_COOKIE } from '../../../../lib/merchant/equipe/equipeAuth';
import { requireEquipeApi } from '../../../../lib/merchant/equipe/requireEquipeApi';

/** GET /api/parceiros/equipe/me — sessão atual. POST logout. */
export default async function handler(req, res) {
  if (req.method === 'POST' && (req.body?.action === 'logout' || req.query?.action === 'logout')) {
    res.setHeader(
      'Set-Cookie',
      serialize(EQUIPE_COOKIE, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      })
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireEquipeApi(req, res);
  if (!auth) return;

  return res.status(200).json({
    membro: auth.membro,
    store: auth.store,
  });
}
