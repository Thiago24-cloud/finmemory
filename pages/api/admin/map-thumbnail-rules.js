import { requireMapQuickAddAdminForApi } from '../../../lib/requireMapQuickAddAdminApi';
import { invalidateThumbnailMatchRulesCache } from '../../../lib/mapThumbnailMatchRules';
import { resolveThumbnailRuleImageInput } from '../../../lib/mapThumbnailRuleImageUpload';

function parseKeywords(input) {
  if (Array.isArray(input)) {
    return input.map((s) => String(s).trim()).filter(Boolean).slice(0, 120);
  }
  if (typeof input === 'string') {
    return input
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 120);
  }
  return [];
}

/**
 * GET — lista regras (ativas e inativas) para o painel.
 * POST — cria.
 * PATCH — atualiza (body.id).
 * DELETE — ?id=uuid
 */
export default async function handler(req, res) {
  const ctx = await requireMapQuickAddAdminForApi(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('map_thumbnail_match_rules')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ rules: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const canonical_label = String(body.canonical_label || '').trim().slice(0, 200);
    if (!canonical_label) return res.status(400).json({ error: 'canonical_label obrigatório' });
    const keywords = parseKeywords(body.keywords);
    if (!keywords.length) return res.status(400).json({ error: 'Indique pelo menos uma palavra-chave' });
    const rc = ['supermarket', 'fast_food', 'any'].includes(body.retail_context)
      ? body.retail_context
      : 'supermarket';
    const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 100;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) : null;
    let image_url = null;
    if (typeof body.image_url === 'string' && body.image_url.trim()) {
      try {
        image_url = await resolveThumbnailRuleImageInput(supabase, body.image_url);
      } catch (e) {
        return res.status(400).json({ error: e?.message || 'Imagem inválida' });
      }
    }
    const { data, error } = await supabase
      .from('map_thumbnail_match_rules')
      .insert({
        canonical_label,
        keywords,
        retail_context: rc,
        sort_order,
        active: body.active !== false,
        notes,
        image_url,
      })
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    invalidateThumbnailMatchRulesCache();
    return res.status(201).json({ rule: data });
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const id = body.id;
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id obrigatório' });
    const patch = {};
    if (body.canonical_label != null) {
      const c = String(body.canonical_label).trim().slice(0, 200);
      if (!c) return res.status(400).json({ error: 'canonical_label vazio' });
      patch.canonical_label = c;
    }
    if (body.keywords != null) {
      const k = parseKeywords(body.keywords);
      if (!k.length) return res.status(400).json({ error: 'keywords não podem ficar vazias' });
      patch.keywords = k;
    }
    if (body.retail_context != null) {
      if (!['supermarket', 'fast_food', 'any'].includes(body.retail_context)) {
        return res.status(400).json({ error: 'retail_context inválido' });
      }
      patch.retail_context = body.retail_context;
    }
    if (body.sort_order != null) {
      const n = Number(body.sort_order);
      patch.sort_order = Number.isFinite(n) ? n : 100;
    }
    if (body.active != null) patch.active = Boolean(body.active);
    if (body.notes !== undefined) {
      const raw = body.notes === null ? '' : String(body.notes);
      const t = raw.trim();
      patch.notes = t.length ? t.slice(0, 500) : null;
    }
    if (body.image_url !== undefined) {
      if (body.image_url === null || body.image_url === '') {
        patch.image_url = null;
      } else {
        try {
          patch.image_url = await resolveThumbnailRuleImageInput(supabase, String(body.image_url));
        } catch (e) {
          return res.status(400).json({ error: e?.message || 'Imagem inválida' });
        }
      }
    }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nada a atualizar' });
    const { data, error } = await supabase
      .from('map_thumbnail_match_rules')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Não encontrado' });
    invalidateThumbnailMatchRulesCache();
    return res.status(200).json({ rule: data });
  }

  if (req.method === 'DELETE') {
    const id = typeof req.query?.id === 'string' ? req.query.id : null;
    if (!id) return res.status(400).json({ error: 'Query id obrigatório' });
    const { error } = await supabase.from('map_thumbnail_match_rules').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    invalidateThumbnailMatchRulesCache();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } },
};
