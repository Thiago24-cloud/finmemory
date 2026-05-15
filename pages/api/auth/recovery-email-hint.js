import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';
import { normalizeBrazilCpf, normalizeBrazilPhoneDigits, maskEmail } from '../../../lib/recoveryIdentifiers';
import { issuePasswordResetForNormalizedEmail } from '../../../lib/passwordResetIssuance';

/**
 * POST /api/auth/recovery-email-hint
 * Body: { phone?: string, document?: string, requestPasswordReset?: boolean }
 * Telefone (BR) ou CPF; devolve email mascarado se existir conta com senha local.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  const ip = getRequestIp(req);
  const rl = checkRateLimit({ bucket: 'recovery-email-hint-ip', key: ip, limit: 8, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Muitas tentativas. Tente mais tarde.' });
  }

  /** Pequeno atraso para dificultar enumeração. */
  await new Promise((r) => setTimeout(r, 180 + Math.floor(Math.random() * 280)));

  const { phone, document, requestPasswordReset } = req.body || {};
  const phoneDig = normalizeBrazilPhoneDigits(phone);
  const cpfDig = normalizeBrazilCpf(document);

  const genericOk = () =>
    res.status(200).json({
      ok: true,
      found: false,
      message: 'Se houver conta com esse dado e senha criada pelo app, o email aparece mascarado abaixo.',
    });

  if (!phoneDig && !cpfDig) {
    return res.status(400).json({
      error: 'Informe um celular válido ou um CPF válido.',
    });
  }
  if (phoneDig && cpfDig) {
    return res.status(400).json({
      error: 'Use só o celular ou só o CPF nesta busca (não os dois ao mesmo tempo).',
    });
  }

  let q = supabase.from('users').select('id,email').limit(1);
  if (phoneDig) {
    q = q.eq('recovery_phone_digits', phoneDig);
  } else {
    q = q.eq('recovery_document_digits', cpfDig);
  }

  const { data: row, error: qErr } = await q.maybeSingle();
  if (qErr) {
    console.warn('[recovery-email-hint]', qErr.message);
    return genericOk();
  }
  if (!row?.id || !row?.email) return genericOk();

  const { data: loc } = await supabase
    .from('auth_local_users')
    .select('email')
    .eq('user_id', row.id)
    .maybeSingle();
  if (!loc?.email) return genericOk();

  const masked = maskEmail(loc.email);

  if (requestPasswordReset) {
    await issuePasswordResetForNormalizedEmail(supabase, loc.email.trim().toLowerCase());
    return res.status(200).json({
      ok: true,
      found: true,
      maskedEmail: masked,
      resetEmailSent: true,
      message: 'Se esse cadastro existir, enviamos um link de redefinição de senha.',
    });
  }

  return res.status(200).json({
    ok: true,
    found: true,
    maskedEmail: masked,
    message: 'Lembre qual email corresponde ao valor acima e use em “Entrar” ou “Esqueci a senha”.',
  });
}
