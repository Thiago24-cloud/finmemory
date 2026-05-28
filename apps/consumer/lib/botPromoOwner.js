function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

export async function findUserIdByEmail(supabase, email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalized)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

export async function isUserIdPresent(supabase, userId) {
  if (!isUuid(userId)) return false;
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  return !error && Boolean(data?.id);
}

/** Conta técnica em public.users — ver scripts/ensure-bot-promo-owner.mjs */
export const BOT_PROMO_OWNER_EMAIL = 'scraper-auto@finmemory.local';

async function resolveEnvOwnerCandidate(supabase, name, value) {
  if (!value) {
    console.log('[botPromoOwner] env var ausente:', name);
    return null;
  }
  if (isUuid(value)) {
    const found = await isUserIdPresent(supabase, value);
    if (found) {
      console.log('[botPromoOwner] user_id resolvido via env var:', name);
      return value;
    }
    console.log('[botPromoOwner] env var presente mas UUID não encontrado em users:', name);
    return null;
  }
  if (value.includes('@')) {
    const id = await findUserIdByEmail(supabase, value);
    if (id) {
      console.warn(
        '[botPromoOwner]',
        name,
        'está como e-mail; use UUID (npm run promo:ensure-bot-owner). user_id=',
        id
      );
      return id;
    }
    console.log('[botPromoOwner] env var é e-mail mas não existe em users:', name);
  } else {
    console.log('[botPromoOwner] env var inválida (nem UUID nem e-mail):', name);
  }
  return null;
}

export async function resolveOwnerUserId(supabase, reviewerEmail) {
  const envCandidateNames = [
    'BOT_PROMO_OWNER_USER_ID',
    'MAP_QUICK_ADD_BOT_USER_ID',
    'DIA_BOT_USER_ID',
  ];

  for (const name of envCandidateNames) {
    const value = String(process.env[name] || '').trim();
    // eslint-disable-next-line no-await-in-loop
    const id = await resolveEnvOwnerCandidate(supabase, name, value);
    if (id) return id;
  }

  const dedicatedBotId = await findUserIdByEmail(supabase, BOT_PROMO_OWNER_EMAIL);
  if (dedicatedBotId) {
    console.log('[botPromoOwner] user_id resolvido via conta técnica', BOT_PROMO_OWNER_EMAIL);
    return dedicatedBotId;
  }

  const reviewerId = await findUserIdByEmail(supabase, reviewerEmail);
  if (reviewerId) {
    console.log('[botPromoOwner] user_id resolvido via email do revisor');
    return reviewerId;
  }
  console.log('[botPromoOwner] email do revisor não encontrado em users');

  const finmemoryAdminEmailsEnv = 'FINMEMORY_ADMIN_EMAILS';
  const rawAdminEmails = String(process.env[finmemoryAdminEmailsEnv] || '');
  const fallbackAdminEmails = rawAdminEmails
    .split(/[,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (fallbackAdminEmails.length === 0) {
    console.log('[botPromoOwner] env var ausente ou vazia:', finmemoryAdminEmailsEnv);
  }

  for (const email of fallbackAdminEmails) {
    // eslint-disable-next-line no-await-in-loop
    const id = await findUserIdByEmail(supabase, email);
    if (id) {
      console.log('[botPromoOwner] user_id resolvido via', finmemoryAdminEmailsEnv);
      return id;
    }
    console.log('[botPromoOwner] email de fallback admin não encontrado em users (índice omitido)');
  }

  console.log('[botPromoOwner] nenhum candidate resolveu user_id — retornando null');
  return null;
}
