import { requireMerchantApi } from '../../../lib/merchant/requireMerchantApi';
import { requireFeature } from '../../../lib/merchant/requireFeature';
import { ensureStorePublicQr, buildQrImageUrl } from '../../../lib/merchant/storePublicQr';

/**
 * GET /api/merchant/qr-code — QR + link público da loja (ensure slug).
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;
  if (!(await requireFeature(auth, res, 'qr_code'))) return;

  const { supabase, store } = auth;

  const { data: fullStore, error } = await supabase
    .from('stores')
    .select('id, name, address, public_slug, phone')
    .eq('id', store.id)
    .maybeSingle();

  if (error) {
    if (/public_slug/i.test(error.message || '')) {
      return res.status(503).json({
        code: 'MISSING_SCHEMA',
        error: 'Execute a migration 20260723120000_store_public_qr.sql no Supabase.',
      });
    }
    return res.status(500).json({ error: error.message });
  }

  if (!fullStore) {
    return res.status(404).json({ error: 'Loja não encontrada.' });
  }

  const qr = await ensureStorePublicQr(supabase, fullStore);
  if (!qr) {
    return res.status(500).json({ error: 'Não foi possível gerar o QR da loja.' });
  }
  if (qr.schemaMissing) {
    return res.status(503).json({
      code: 'MISSING_SCHEMA',
      error: 'Execute a migration 20260723120000_store_public_qr.sql no Supabase.',
    });
  }

  return res.status(200).json({
    store: {
      id: fullStore.id,
      name: fullStore.name,
      address: fullStore.address || null,
      slug: qr.slug,
    },
    code: qr.code,
    target_path: qr.targetPath,
    public_url: qr.publicUrl,
    qr_image_url: buildQrImageUrl(qr.publicUrl, 280),
    print_hint: 'Escaneie para ver o cardápio e falar com a loja no FinMemory.',
  });
}
