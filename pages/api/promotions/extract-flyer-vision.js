import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { geocodeAddress } from '../../../lib/geocode';

const INGEST_PREFIX = 'vision_flyer';

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function checkSecret(req) {
  const secret =
    process.env.ENCARTE_EXTRACT_SECRET ||
    process.env.CATALOG_ENRICH_SECRET ||
    process.env.CATALOG_REGISTER_SECRET ||
    process.env.DIA_IMPORT_SECRET;
  if (!secret) return true;
  const provided =
    req.headers['x-cron-secret'] ||
    req.headers['X-Cron-Secret'] ||
    req.query?.secret;
  return provided === secret;
}

/** Categorias pedidas ao modelo — valores fora da lista viram "Outros". */
const VISION_CATEGORIES = [
  'Hortifruti',
  'Carnes',
  'Laticínios',
  'Bebidas',
  'Mercearia',
  'Higiene',
  'Limpeza',
  'Congelados',
  'Outros',
];

function sanitizeVisionCategory(raw) {
  if (raw == null) return null;
  const t = String(raw).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  for (const c of VISION_CATEGORIES) {
    if (c.toLowerCase() === lower) return c;
  }
  return 'Outros';
}

/**
 * Resposta do modelo: objeto com products, ou JSON solto, ou array raiz (legado).
 */
function parseVisionJsonResponse(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim();
  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let v = tryParse(cleaned);
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    v = tryParse(cleaned.slice(start, end + 1));
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  }
  const aStart = cleaned.indexOf('[');
  const aEnd = cleaned.lastIndexOf(']');
  if (aStart !== -1 && aEnd > aStart) {
    v = tryParse(cleaned.slice(aStart, aEnd + 1));
    if (Array.isArray(v)) return { products: v };
  }
  return null;
}

function sanitizeNome(s) {
  if (s == null) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.slice(0, 280);
}

function parsePromoPrice(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v).replace(/R\$\s*/i, '').replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatPrecoOriginalDePor(orig, promo) {
  if (orig == null && promo == null) return null;
  const parts = [];
  if (orig != null && Number.isFinite(Number(orig))) {
    parts.push(`De R$ ${Number(orig).toFixed(2).replace('.', ',')}`);
  }
  if (promo != null && Number.isFinite(Number(promo))) {
    parts.push(`Por R$ ${Number(promo).toFixed(2).replace('.', ',')}`);
  }
  return parts.length ? parts.join(' ') : null;
}

function isAllowedImageRef(ref) {
  if (!ref || typeof ref !== 'string') return false;
  const t = ref.trim();
  if (t.startsWith('https://')) return true;
  if (t.startsWith('data:image/')) return true;
  return false;
}

function buildIngestSource(supermercado, flyerKey, imageRef) {
  const slug = String(supermercado || '').toLowerCase().trim();
  const key =
    flyerKey && String(flyerKey).trim()
      ? String(flyerKey).trim().slice(0, 64)
      : createHash('sha256')
          .update(String(imageRef || ''))
          .digest('hex')
          .slice(0, 16);
  return `${INGEST_PREFIX}:${slug}:${key}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!checkSecret(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const openai = getOpenAI();
  if (!openai) {
    return res.status(500).json({ error: 'OPENAI_API_KEY não configurada' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase service role não configurado' });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const body = req.body || {};
  const {
    imageUrl,
    imageBase64,
    imageMimeType,
    supermercado: superRaw,
    storeName,
    flyerKey,
    replacePrevious = true,
    lat: latIn,
    lng: lngIn,
    geocodeQuery,
  } = body;

  const supermercado = String(superRaw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!supermercado) {
    return res.status(400).json({ error: 'supermercado (slug, ex.: carrefour) é obrigatório' });
  }

  let visionUrl = null;
  if (imageUrl && String(imageUrl).trim()) {
    const u = String(imageUrl).trim();
    if (!isAllowedImageRef(u)) {
      return res.status(400).json({
        error: 'imageUrl deve ser https:// ou data:image/... (URLs não públicas não funcionam na API OpenAI)',
      });
    }
    visionUrl = u;
  } else if (imageBase64 && String(imageBase64).trim()) {
    const mime = String(imageMimeType || 'image/jpeg').replace(/[^a-z0-9/+.-]/gi, '') || 'image/jpeg';
    const b64 = String(imageBase64).trim();
    if (b64.length > 18_000_000) {
      return res.status(400).json({ error: 'imageBase64 excede o limite seguro' });
    }
    visionUrl = `data:${mime};base64,${b64}`;
  } else {
    return res.status(400).json({ error: 'Informe imageUrl (https ou data:) ou imageBase64' });
  }

  let lat = latIn != null ? Number(latIn) : NaN;
  let lng = lngIn != null ? Number(lngIn) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    const q =
      (geocodeQuery && String(geocodeQuery).trim()) ||
      (storeName && String(storeName).trim()) ||
      null;
    if (!q) {
      return res.status(400).json({
        error: 'Informe lat e lng, ou storeName / geocodeQuery para geocodificar o pin no mapa',
      });
    }
    const coords = await geocodeAddress(`${q}, Brasil`);
    if (!coords || coords.lat == null || coords.lng == null) {
      return res.status(422).json({ error: 'Não foi possível obter lat/lng a partir do endereço' });
    }
    lat = coords.lat;
    lng = coords.lng;
  }

  const ttlHours = Number(process.env.PROMO_TTL_HOURS || process.env.FINMEMORY_TTL_HOURS || 72);
  const ttl = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 72;
  const runId = new Date().toISOString();
  const nowIso = runId;
  const expireIso = new Date(Date.now() + ttl * 3_600_000).toISOString();
  const ingestSource = buildIngestSource(supermercado, flyerKey, visionUrl);

  const catList = VISION_CATEGORIES.join('|');
  const prompt = `Você analisa uma imagem de encarte ou folheto de supermercado (Brasil).

Extraia TODOS os produtos com preço promocional visível.

Regras:
- Use preço promocional (ex.: "Por R$ 5,99"); se houver "De X Por Y", preencha original_price com X e promo_price com Y.
- promo_price é obrigatório por item (número decimal, ponto como separador: 5.99).
- original_price: número ou null se não houver preço "de/tachado".
- unit: kg | un | L | ml | g | pct | null se não der para inferir.
- category: exatamente uma destas strings: ${catList} (use Outros se não encaixar).
- valid_until: data de fim da oferta no formato YYYY-MM-DD se aparecer no encarte; senão null.
- brand: marca se clara; senão null.

Responda APENAS com JSON válido neste formato (sem markdown):
{"products":[{"product_name":"string","brand":string|null,"unit":string|null,"category":"Hortifruti","promo_price":number,"original_price":number|null,"valid_until":string|null}]}`;

  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const maxTokensRaw = Number.parseInt(process.env.OPENAI_VISION_MAX_TOKENS || '4096', 10);
  const maxTokens = Number.isFinite(maxTokensRaw)
    ? Math.min(16384, Math.max(512, maxTokensRaw))
    : 4096;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: visionUrl, detail: 'high' } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content || '';
    const parsed = parseVisionJsonResponse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return res.status(422).json({
        error: 'Resposta do modelo não é JSON válido',
        preview: String(raw).slice(0, 400),
      });
    }

    const products = Array.isArray(parsed?.products) ? parsed.products : [];
    const seen = new Set();
    const rows = [];

    for (const p of products) {
      const nome = sanitizeNome(p?.product_name);
      const promo = parsePromoPrice(p?.promo_price);
      if (!nome || promo == null) continue;
      const orig =
        p?.original_price != null && p.original_price !== ''
          ? parsePromoPrice(p.original_price)
          : null;
      const key = nome.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      let vd = null;
      if (p?.valid_until) {
        const vs = String(p.valid_until).trim();
        vd = /^\d{4}-\d{2}-\d{2}$/.test(vs) ? vs : null;
      }

      rows.push({
        supermercado,
        nome_produto: nome,
        preco: promo,
        preco_original: formatPrecoOriginalDePor(orig, promo),
        categoria: sanitizeVisionCategory(p?.category),
        imagem_url: visionUrl.startsWith('data:') ? null : visionUrl,
        validade: vd,
        lat,
        lng,
        run_id: String(runId),
        atualizado_em: nowIso,
        expira_em: expireIso,
        ativo: true,
        ingest_source: ingestSource,
      });
    }

    if (replacePrevious) {
      const { error: deactErr } = await supabase
        .from('promocoes_supermercados')
        .update({ ativo: false })
        .eq('supermercado', supermercado)
        .eq('ingest_source', ingestSource)
        .eq('ativo', true);
      if (deactErr) {
        console.warn('extract-flyer-vision deactivate:', deactErr.message);
      }
    }

    if (!rows.length) {
      return res.status(200).json({
        ok: true,
        inserted: 0,
        runId,
        ingestSource,
        model,
        maxTokens,
        note: 'Nenhum produto com nome e preço promocional válidos',
        rawCount: products.length,
      });
    }

    const chunkSize = 400;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const slice = rows.slice(i, i + chunkSize);
      const { error: insertErr } = await supabase.from('promocoes_supermercados').insert(slice);
      if (insertErr) {
        console.error('extract-flyer-vision insert:', insertErr);
        return res.status(500).json({ error: insertErr.message });
      }
    }

    return res.status(200).json({
      ok: true,
      inserted: rows.length,
      runId,
      ingestSource,
      model,
      maxTokens,
      ttlHours: ttl,
      lat,
      lng,
    });
  } catch (e) {
    console.error('extract-flyer-vision error:', e);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}
