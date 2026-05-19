import { hashPassword, verifyPassword, isScryptPasswordHash } from '../../../lib/passwordAuth';
import { createPartnerStoreForUser } from '../../../lib/partners/createPartnerStoreForUser';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { geocodeAddress } from '../../../lib/geocode';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';
import { sendSecurityEmail } from '../../../lib/securityEmail';
import { isValidEmail, normalizeEmail, validatePasswordStrength } from '../../../lib/securityPolicy';
import { isValidCpfOrCnpj, normalizeTaxIdDigits } from '../../../lib/validateTaxId';
import { ACCOUNT_TYPE_VAREJISTA } from '../../../lib/userType';
import { syncMerchantStoreBindings } from '../../../lib/merchant/syncMerchantStoreBindings';
import { getPrivateBetaAllowlistFromEnv, isEmailAllowedInPrivateBeta } from '../../../lib/privateBetaAllowlist';

/**
 * POST /api/partners/signup
 * Onboarding lojista: user (varejista) + store + merchant_store_profiles.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getRequestIp(req);
  const ipRate = checkRateLimit({
    bucket: 'partner-signup-ip',
    key: ip,
    limit: 6,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipRate.allowed) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const body = req.body || {};
  const responsibleName = String(body.responsibleName || '').trim().slice(0, 120);
  const businessName = String(body.businessName || '').trim().slice(0, 200);
  const documentTaxId = normalizeTaxIdDigits(body.documentTaxId);
  const address = String(body.address || '').trim().slice(0, 500);
  const addressComplement = String(body.addressComplement || '').trim().slice(0, 120);
  const email = body.email;
  const password = body.password;

  if (!responsibleName || responsibleName.length < 3) {
    return res.status(400).json({ error: 'Informe o nome do responsável.' });
  }
  if (!businessName || businessName.length < 2) {
    return res.status(400).json({ error: 'Informe o nome comercial da loja.' });
  }
  if (!isValidCpfOrCnpj(documentTaxId)) {
    return res.status(400).json({ error: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.' });
  }
  if (!address || address.length < 8) {
    return res.status(400).json({ error: 'Informe o endereço completo do estabelecimento.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  const normalizedEmail = normalizeEmail(email);
  const betaAllowlist = getPrivateBetaAllowlistFromEnv();
  if (!isEmailAllowedInPrivateBeta(normalizedEmail, betaAllowlist)) {
    return res.status(403).json({ error: 'Cadastro não disponível neste momento.' });
  }
  const pwdCheck = validatePasswordStrength(password);
  if (!pwdCheck.ok) {
    return res.status(400).json({ error: pwdCheck.message });
  }
  const emailRate = checkRateLimit({
    bucket: 'partner-signup-email',
    key: normalizedEmail,
    limit: 4,
    windowMs: 60 * 60 * 1000,
  });
  if (!emailRate.allowed) {
    return res.status(429).json({ error: 'Muitas tentativas para este e-mail.' });
  }

  const fullAddress = addressComplement ? `${address}, ${addressComplement}, Brasil` : `${address}, Brasil`;
  const coords = await geocodeAddress(fullAddress);
  if (!coords?.lat || !coords?.lng) {
    return res.status(400).json({
      error: 'Não localizamos este endereço no mapa. Confira rua, número, bairro e cidade.',
    });
  }

  const { data: existingAuth } = await supabase
    .from('auth_local_users')
    .select('user_id, email, password_hash')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existingAuth?.email) {
    const { data: existingProfile } = await supabase
      .from('merchant_store_profiles')
      .select('id')
      .eq('user_id', existingAuth.user_id)
      .maybeSingle();

    if (existingProfile?.id) {
      return res.status(409).json({
        error: 'Este e-mail já possui uma loja. Faça login e acesse o painel.',
        loginUrl: '/login?callbackUrl=%2Fparceiros%2Fpainel',
      });
    }

    if (!isScryptPasswordHash(existingAuth.password_hash) || !verifyPassword(password, existingAuth.password_hash)) {
      return res.status(401).json({
        error: 'E-mail já cadastrado. Use a mesma senha da sua conta ou faça login em /login.',
      });
    }

    const completed = await createPartnerStoreForUser(supabase, {
      userId: existingAuth.user_id,
      responsibleName,
      businessName,
      documentTaxId,
      address,
      addressComplement,
      lat: coords.lat,
      lng: coords.lng,
    });

    if (!completed.ok) {
      return res.status(completed.status || 500).json({ error: completed.error });
    }

    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || 'https://finmemory.com.br';
    const painelPath = '/parceiros/painel';
    return res.status(201).json({
      success: true,
      userId: existingAuth.user_id,
      storeId: completed.storeId,
      completedExistingAccount: true,
      loginUrl: `${appUrl}/login?callbackUrl=${encodeURIComponent(painelPath)}`,
      message: 'Loja vinculada à sua conta. Faça login para acessar o painel.',
    });
  }

  const { data: existingDoc } = await supabase
    .from('merchant_store_profiles')
    .select('id')
    .eq('document_tax_id', documentTaxId)
    .maybeSingle();
  if (existingDoc?.id) {
    return res.status(409).json({ error: 'Este CPF/CNPJ já está vinculado a uma loja parceira.' });
  }

  const { data: existingCnpjStore } = await supabase
    .from('stores')
    .select('id')
    .eq('cnpj', documentTaxId)
    .maybeSingle();
  if (existingCnpjStore?.id) {
    return res.status(409).json({ error: 'Este CPF/CNPJ já está cadastrado em outra loja no mapa.' });
  }

  const passwordHash = hashPassword(password);
  const nowIso = new Date().toISOString();
  let userId = null;

  try {
    const signupNow = new Date().toISOString();
    const userInsert = {
      email: normalizedEmail,
      name: responsibleName,
      google_id: null,
      account_type: ACCOUNT_TYPE_VAREJISTA,
      account_type_selected_at: signupNow,
      account_type_chosen_explicitly: true,
      access_token: null,
      refresh_token: null,
      token_expiry: null,
      last_sync: new Date(),
    };
    let { data: userRow, error: userErr } = await supabase.from('users').insert(userInsert).select('id').single();
    if (userErr?.message?.includes('account_type_chosen_explicitly')) {
      const { account_type_chosen_explicitly: _a, account_type_selected_at: _b, ...legacyInsert } = userInsert;
      ({ data: userRow, error: userErr } = await supabase.from('users').insert(legacyInsert).select('id').single());
    }

    if (userErr || !userRow?.id) {
      if (userErr?.code === '23505') {
        return res.status(409).json({ error: 'E-mail já cadastrado.' });
      }
      console.error('[partners/signup] users:', userErr);
      return res.status(500).json({ error: 'Erro ao criar conta.' });
    }
    userId = userRow.id;

    const { error: authErr } = await supabase.from('auth_local_users').insert({
      email: normalizedEmail,
      user_id: userId,
      password_hash: passwordHash,
      email_verified_at: nowIso,
      email_verify_token_hash: null,
      email_verify_expires_at: null,
      email_verify_token_hashes: [],
      updated_at: nowIso,
    });
    if (authErr) {
      console.error('[partners/signup] auth:', authErr);
      await supabase.from('users').delete().eq('id', userId);
      return res.status(500).json({ error: 'Erro ao guardar credenciais.' });
    }

    const { data: storeRow, error: storeErr } = await supabase
      .from('stores')
      .insert({
        name: businessName,
        type: 'restaurant',
        address: addressComplement ? `${address} — ${addressComplement}` : address,
        lat: coords.lat,
        lng: coords.lng,
        cnpj: documentTaxId,
        active: true,
        needs_review: true,
        owner_user_id: userId,
      })
      .select('id')
      .single();

    if (storeErr || !storeRow?.id) {
      console.error('[partners/signup] store:', storeErr);
      await supabase.from('auth_local_users').delete().eq('user_id', userId);
      await supabase.from('users').delete().eq('id', userId);
      return res.status(500).json({ error: 'Erro ao registrar loja no mapa.' });
    }

    const { error: profileErr } = await supabase.from('merchant_store_profiles').insert({
      user_id: userId,
      store_id: storeRow.id,
      responsible_name: responsibleName,
      business_name: businessName,
      document_tax_id: documentTaxId,
      onboarding_status: 'pending_review',
      pickup_enabled: true,
    });

    if (profileErr) {
      console.error('[partners/signup] profile:', profileErr);
      await supabase.from('stores').delete().eq('id', storeRow.id);
      await supabase.from('auth_local_users').delete().eq('user_id', userId);
      await supabase.from('users').delete().eq('id', userId);
      return res.status(500).json({ error: 'Erro ao finalizar cadastro da loja.' });
    }

    await syncMerchantStoreBindings(supabase, userId, storeRow.id);

    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || 'https://finmemory.com.br';
    const painelPath = '/parceiros/painel';
    await sendSecurityEmail({
      to: normalizedEmail,
      subject: 'Sua loja foi cadastrada no FinMemory Parceiros',
      html: `<p>Olá, ${responsibleName}!</p>
        <p><strong>${businessName}</strong> está no mapa FinMemory (revisão rápida da equipe).</p>
        <p><a href="${appUrl}/login?callbackUrl=${encodeURIComponent(painelPath)}">Entrar no painel da loja</a></p>`,
      fallbackLog: `partner_signup=${normalizedEmail}`,
    });

    return res.status(201).json({
      success: true,
      userId,
      storeId: storeRow.id,
      loginUrl: `${appUrl}/login?callbackUrl=${encodeURIComponent(painelPath)}`,
      message: 'Loja cadastrada com sucesso.',
    });
  } catch (e) {
    console.error('[partners/signup]', e);
    if (userId) {
      await supabase.from('merchant_store_profiles').delete().eq('user_id', userId);
      await supabase.from('stores').delete().eq('owner_user_id', userId);
      await supabase.from('auth_local_users').delete().eq('user_id', userId);
      await supabase.from('users').delete().eq('id', userId);
    }
    return res.status(500).json({ error: 'Erro inesperado ao cadastrar.' });
  }
}
