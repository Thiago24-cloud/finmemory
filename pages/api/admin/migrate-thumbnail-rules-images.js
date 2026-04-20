import { requireMapQuickAddAdminForApi } from '../../../lib/requireMapQuickAddAdminApi';
import { invalidateThumbnailMatchRulesCache } from '../../../lib/mapThumbnailMatchRules';
import { resolveThumbnailRuleImageInput } from '../../../lib/mapThumbnailRuleImageUpload';

/**
 * POST — percorre regras com image_url ainda em data:image/…; envia ao Storage e atualiza para HTTPS público.
 * Body: { confirm: true }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const ctx = await requireMapQuickAddAdminForApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const body = req.body || {};
  if (body.confirm !== true) {
    return res.status(400).json({ error: 'Envia JSON { "confirm": true } para executar a migração.' });
  }

  const migrated = [];
  const failed = [];

  for (;;) {
    const { data: batch, error: selErr } = await supabase
      .from('map_thumbnail_match_rules')
      .select('id, image_url')
      .like('image_url', 'data:image%')
      .limit(50);

    if (selErr) {
      return res.status(500).json({ error: selErr.message });
    }
    if (!batch?.length) break;

    for (const row of batch) {
      const raw = row.image_url;
      if (typeof raw !== 'string' || !/^data:image\//i.test(raw.trim())) continue;
      try {
        const newUrl = await resolveThumbnailRuleImageInput(supabase, raw);
        const { error: upErr } = await supabase
          .from('map_thumbnail_match_rules')
          .update({ image_url: newUrl })
          .eq('id', row.id);
        if (upErr) {
          failed.push({ id: row.id, error: upErr.message });
        } else {
          migrated.push({ id: row.id, image_url: newUrl });
        }
      } catch (e) {
        failed.push({ id: row.id, error: e?.message || String(e) });
      }
    }
  }

  if (migrated.length) invalidateThumbnailMatchRulesCache();

  return res.status(200).json({
    ok: true,
    migratedCount: migrated.length,
    failedCount: failed.length,
    migrated,
    failed,
  });
}
