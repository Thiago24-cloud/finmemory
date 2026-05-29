import { hashPassword, verifyPassword, isScryptPasswordHash } from '../../../lib/passwordAuth';
import { createPartnerStoreForUser } from '../../../lib/partners/createPartnerStoreForUser';
import {
  evaluateDocumentTaxId,
  saveDocumentReuseAck,
} from '../../../lib/partners/documentTaxIdPolicy';
import { documentTaxIdReuseHttpResponse } from '../../../lib/partners/documentTaxIdReuseResponse';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { geocodePartnerStoreAddress } from '../../../lib/geocode';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';
import { sendSecurityEmail } from '../../../lib/securityEmail';
import { isValidEmail, normalizeEmail, validatePasswordStrength } from '../../../lib/securityPolicy';
import { isValidCpfOrCnpj, normalizeTaxIdDigits } from '../../../lib/validateTaxId';
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
  const confirmReusedDocumentTaxId = Boolean(body.confirmReusedDocumentTaxId);

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

  const coords = await geocodePartnerStoreAddress(address, addressComplement);
  if (!coords?.lat || !coords?.lng) {
    if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim()) {
      return res.status(503).json({
        error: 'Geocodificação indisponível no servidor. Tente novamente em alguns minutos.',
      });
    }
    return res.status(400).json({
      error:
        'Não localizamos este endereço no mapa. Inclua rua, número, bairro e cidade (ex.: …, Vila X, São Paulo — SP).',
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
      confirmReusedDocumentTaxId,
    });

    if (!completed.ok) {
      if (completed.needsDocumentConfirmation) {
        return documentTaxIdReuseHttpResponse(res, { message: completed.error });
      }
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

  const docPolicyNewUser = await evaluateDocumentTaxId(supabase, {
    documentTaxId,
    userId: null,
    confirmReuse: confirmReusedDocumentTaxId,
  });
  if (!docPolicyNewUser.allowed) {
    return documentTaxIdReuseHttpResponse(res, docPolicyNewUser);
  }
  const mustSaveDocAckAfterSignup =
    confirmReusedDocumentTaxId && Boolean(docPolicyNewUser.saveAckAfterUserId);

  const passwordHash = hashPassword(password);
  const nowIso = new Date().toISOString();
  let userId = null;

  try {
    const userInsert = {
      email: normalizedEmail,
      name: responsibleName,
      google_id: null,
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

    if (mustSaveDocAckAfterSignup) {
      await saveDocumentReuseAck(supabase, userId, documentTaxId);
    }

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
