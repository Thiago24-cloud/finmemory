import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { geocodePartnerStoreAddress } from '../../../lib/geocode';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';
import { isValidCpfOrCnpj, normalizeTaxIdDigits } from '../../../lib/validateTaxId';
import { createPartnerStoreForUser } from '../../../lib/partners/createPartnerStoreForUser';
import { documentTaxIdReuseHttpResponse } from '../../../lib/partners/documentTaxIdReuseResponse';
import { getPrivateBetaAllowlistFromEnv, isEmailAllowedInPrivateBeta } from '../../../lib/privateBetaAllowlist';
import { normalizeEmail } from '../../../lib/securityPolicy';

/**
 * POST /api/partners/complete-store
 * Utilizador já logado (sem loja) conclui cadastro da loja sem criar nova conta.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  const email = session?.user?.email;
  if (!userId || !email) {
    return res.status(401).json({ error: 'Faça login para cadastrar sua loja.' });
  }

  const betaAllowlist = getPrivateBetaAllowlistFromEnv();
  if (!isEmailAllowedInPrivateBeta(normalizeEmail(email), betaAllowlist)) {
    return res.status(403).json({ error: 'Cadastro não disponível neste momento.' });
  }

  const ip = getRequestIp(req);
  const ipRate = checkRateLimit({
    bucket: 'partner-complete-store-ip',
    key: ip,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!ipRate.allowed) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Serviço indisponível' });

  const body = req.body || {};
  const responsibleName = String(body.responsibleName || session.user.name || '').trim().slice(0, 120);
  const businessName = String(body.businessName || '').trim().slice(0, 200);
  const documentTaxId = normalizeTaxIdDigits(body.documentTaxId);
  const address = String(body.address || '').trim().slice(0, 500);
  const addressComplement = String(body.addressComplement || '').trim().slice(0, 120);
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

  const result = await createPartnerStoreForUser(supabase, {
    userId,
    responsibleName,
    businessName,
    documentTaxId,
    address,
    addressComplement,
    lat: coords.lat,
    lng: coords.lng,
    confirmReusedDocumentTaxId,
  });

  if (!result.ok) {
    if (result.needsDocumentConfirmation) {
      return documentTaxIdReuseHttpResponse(res, { message: result.error });
    }
    return res.status(result.status || 500).json({ error: result.error });
  }

  return res.status(201).json({
    success: true,
    storeId: result.storeId,
    redirectUrl: '/parceiros/painel',
    message: 'Loja cadastrada. Você já pode publicar ofertas.',
  });
}
