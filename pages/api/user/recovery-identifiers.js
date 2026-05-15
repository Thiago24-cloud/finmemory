/**
 * GET  — se falta telefone/CPF após primeiro onboarding de nome.
 * POST — grava telefone e/ou CPF (ao menos um) em public.users.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { normalizeBrazilCpf, normalizeBrazilPhoneDigits } from '../../../lib/recoveryIdentifiers';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('users')
      .select('profile_first_login_completed_at, recovery_identifier_collected_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[recovery-identifiers GET]', error.message);
      return res.status(500).json({ error: 'Não foi possível ler o perfil.' });
    }

    const profileDone = Boolean(data?.profile_first_login_completed_at);
    const recoveryDone = Boolean(data?.recovery_identifier_collected_at);
    const needsRecovery = profileDone && !recoveryDone;

    return res.status(200).json({
      needsRecovery,
      collected: recoveryDone,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const phoneDig = normalizeBrazilPhoneDigits(body.phone);
  const cpfDig = normalizeBrazilCpf(body.document);

  if (!phoneDig && !cpfDig) {
    return res.status(400).json({
      error: 'Informe ao menos um: celular (com DDD) ou CPF válido.',
    });
  }

  const now = new Date().toISOString();
  const patch = {
    recovery_identifier_collected_at: now,
  };
  if (phoneDig) patch.recovery_phone_digits = phoneDig;
  if (cpfDig) patch.recovery_document_digits = cpfDig;

  const { error: upErr } = await supabase.from('users').update(patch).eq('id', userId);

  if (upErr) {
    const dup =
      typeof upErr.message === 'string' &&
      (upErr.message.includes('duplicate') || upErr.code === '23505');
    if (dup) {
      return res.status(409).json({
        error: 'Este telefone ou CPF já está em uso em outra conta.',
      });
    }
    console.error('[recovery-identifiers POST]', upErr.message);
    return res.status(500).json({ error: 'Não foi possível salvar.' });
  }

  return res.status(200).json({ ok: true });
}
