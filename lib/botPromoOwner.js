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

export async function resolveOwnerUserId(supabase, reviewerEmail) {
  const envCandidateNames = ['BOT_PROMO_OWNER_USER_ID', 'MAP_QUICK_ADD_BOT_USER_ID'];
  const envCandidates = envCandidateNames.map((name) => ({
    name,
    value: String(process.env[name] || '').trim(),
  }));

  for (const c of envCandidates) {
    if (!c.value) {
      console.log('[botPromoOwner] env var ausente:', c.name);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const found = await isUserIdPresent(supabase, c.value);
    if (found) {
      console.log('[botPromoOwner] user_id resolvido via env var:', c.name);
      return c.value;
    }
    console.log('[botPromoOwner] env var presente mas user_id não encontrado em users:', c.name);
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
