/**
 * GET  — se falta telefone/CPF após primeiro onboarding de nome.
 * POST — grava telefone e/ou CPF (ao menos um) em public.users.
 *        Se já existir em outra conta: body opcional claim_email + claim_password
 *        da conta que possui o dado — transfere para a sessão atual.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { normalizeBrazilCpf, normalizeBrazilPhoneDigits } from '../../../lib/recoveryIdentifiers';
import {
  findRecoveryIdentifierConflict,
  releaseRecoveryIdentifiersFromUser,
  verifyOwnerCredentials,
} from '../../../lib/claimRecoveryIdentifier';

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
  const claimEmail = body.claim_email || body.claimEmail;
  const claimPassword = body.claim_password || body.claimPassword;

  if (!phoneDig && !cpfDig) {
    return res.status(400).json({
      error: 'Informe ao menos um: celular (com DDD) ou CPF válido.',
    });
  }

  const conflict = await findRecoveryIdentifierConflict(supabase, userId, phoneDig, cpfDig);

  if (conflict) {
    if (!claimEmail || !claimPassword) {
      const label = conflict.field === 'phone' ? 'telefone' : 'CPF';
      return res.status(409).json({
        error: `Este ${label} já está em uso em outra conta.`,
        needs_claim: true,
        conflict_field: conflict.field,
      });
    }

    const verified = await verifyOwnerCredentials(
      supabase,
      conflict.ownerId,
      claimEmail,
      claimPassword
    );
    if (!verified.ok) {
      return res.status(401).json({ error: verified.error });
    }

    await releaseRecoveryIdentifiersFromUser(supabase, conflict.ownerId, {
      clearPhone: Boolean(phoneDig),
      clearDocument: Boolean(cpfDig),
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
        needs_claim: true,
      });
    }
    console.error('[recovery-identifiers POST]', upErr.message);
    return res.status(500).json({ error: 'Não foi possível salvar.' });
  }

  return res.status(200).json({ ok: true, transferred: Boolean(conflict) });
}
