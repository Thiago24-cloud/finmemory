import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { canAccess } from '../../../lib/access-server';
import {
  hasFinmemoryAdminAllowlist,
  isFinmemoryAdminEmail,
} from '../../../lib/adminAccess';
import { getMapQuickAddSupabase, resolveQuickAddAuth } from '../../../lib/mapQuickAddCore';

/**
 * POST /api/admin/map-curated-opt-out
 * add | remove entrada em map_curated_pin_opt_out (Pomar/Sacolão sem bypass “sempre visível”).
 *
 * Body: { action: 'add' | 'remove', store_id: uuid, confirm: true, note?: string }
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getMapQuickAddSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta' });
  }

  const session = await getServerSession(req, res, authOptions);
  const auth = resolveQuickAddAuth(req, session);
  if (auth?.error === 'invalid_secret') {
    return res.status(403).json({ error: 'x-map-quick-add-secret inválido.' });
  }
  if (auth?.error === 'secret_not_configured') {
    return res.status(503).json({ error: 'MAP_QUICK_ADD_SECRET não configurado no servidor.' });
  }
  if (auth?.error === 'bot_user_missing') {
    return res.status(503).json({ error: 'Configure MAP_QUICK_ADD_BOT_USER_ID para uso com segredo.' });
  }
  if (!auth?.userId) {
    return res.status(401).json({ error: 'Faça login ou envie x-map-quick-add-secret válido.' });
  }

  if (auth.via === 'session' && session?.user?.email) {
    if (hasFinmemoryAdminAllowlist()) {
      if (!isFinmemoryAdminEmail(session.user.email)) {
        return res.status(403).json({ error: 'Acesso restrito ao painel operacional.' });
      }
    } else {
      const allowed = await canAccess(session.user.email);
      if (!allowed) {
        return res.status(403).json({ error: 'Sem permissão.' });
      }
    }
  }

  const body = req.body || {};
  const action = body.action === 'remove' ? 'remove' : 'add';
  const storeId = typeof body.store_id === 'string' ? body.store_id.trim() : '';
  const confirm = body.confirm === true;
  const note =
    typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null;

  if (!UUID_RE.test(storeId)) {
    return res.status(400).json({ error: 'store_id deve ser um UUID válido.' });
  }
  if (!confirm) {
    return res.status(400).json({ error: 'Envie confirm: true.' });
  }

  const { data: st, error: stErr } = await supabase.from('stores').select('id').eq('id', storeId).maybeSingle();
  if (stErr) {
    console.warn('map-curated-opt-out stores:', stErr.message);
    return res.status(500).json({ error: stErr.message });
  }
  if (!st?.id) {
    return res.status(404).json({ error: 'Loja não encontrada em public.stores.' });
  }

  if (action === 'remove') {
    const { error: delErr } = await supabase.from('map_curated_pin_opt_out').delete().eq('store_id', storeId);
    if (delErr) {
      if (/relation|does not exist|map_curated_pin_opt_out/i.test(delErr.message || '')) {
        return res.status(503).json({ error: 'Migração map_curated_pin_opt_out não aplicada no Supabase.' });
      }
      console.warn('map-curated-opt-out delete:', delErr.message);
      return res.status(500).json({ error: delErr.message });
    }
    return res.status(200).json({ ok: true, action: 'remove', store_id: storeId });
  }

  const { error: upErr } = await supabase
    .from('map_curated_pin_opt_out')
    .upsert({ store_id: storeId, note: note || null }, { onConflict: 'store_id' });
  if (upErr) {
    if (/relation|does not exist|map_curated_pin_opt_out/i.test(upErr.message || '')) {
      return res.status(503).json({ error: 'Migração map_curated_pin_opt_out não aplicada no Supabase.' });
    }
    console.warn('map-curated-opt-out upsert:', upErr.message);
    return res.status(500).json({ error: upErr.message });
  }

  return res.status(200).json({ ok: true, action: 'add', store_id: storeId });
}
