import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { getServerSession } from 'next-auth/next';
import { geocodeAddress } from '../../../lib/geocode';
import { authOptions } from '../auth/[...nextauth]';
import {
  computeDiscountPct,
  endOfValidDayBrazilIso,
  flyerProductDedupeKey,
  normalizeVisionValidDates,
  parseFlexibleDateToIso,
  parsePromoPriceNumber,
} from '../../../lib/flyerVisionParse';

const INGEST_PREFIX = 'vision_flyer';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

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

/** Segredo de agente OU sessão NextAuth (curadoria no browser). */
async function checkFlyerVisionAuth(req, res) {
  if (checkSecret(req)) return true;
  const session = await getServerSession(req, res, authOptions);
  return !!session?.user?.supabaseId;
}

const VISION_CATEGORIES = [
  'Hortifruti',
  'Carnes',
  'Laticínios',
  'Bebidas',
  'Mercearia',
  'Higiene',
  'Limpeza',
  'Congelados',
  'Padaria',
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

function buildPromotionsSourceTag(ingestSource) {
  return `vision_flyer_api:${ingestSource}`;
}

/** Slugs em que `ILIKE '%slug%'` no nome da loja não bate com o nome de marca real. */
const STORE_NAME_ILIKE_PATTERNS_BY_SLUG = {
  padraosuper: [
    '%Supermercado%Padrão%',
    '%Supermercado%Padrao%',
    '%Mercado%Padrão%',
    '%Mercado%Padrao%',
  ],
  saojorge: ['%Sacolão%São Jorge%', '%Sacolao%Sao Jorge%', '%sacol%jorge%'],
  pomardavilavilamadalena: [
    '%Pomar%Vila%Madalena%',
    '%Pomar da Vila%',
    '%pomar%vila%madalena%',
  ],
};

const DEFAULT_DISPLAY_STORE_NAME_BY_SLUG = {
  padraosuper: 'Supermercado Padrão',
};

/**
 * Procura `public.stores` por slug técnico ou padrões de nome de marca.
 */
async function findStoreRowForFlyerSlug(supabase, supermercado) {
  const slug = String(supermercado || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!slug) return null;

  const patterns = [`%${slug}%`, ...(STORE_NAME_ILIKE_PATTERNS_BY_SLUG[slug] || [])];
  for (const pattern of patterns) {
    const { data, error } = await supabase
      .from('stores')
      .select('id, name')
      .eq('active', true)
      .ilike('name', pattern)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn('extract-flyer-vision find store ilike:', error.message);
    }
    if (data?.id) return data;
  }
  return null;
}

/** Nome amigável (ex.: body.storeName) — último recurso antes de criar loja. */
async function findStoreByDisplayName(supabase, displayName) {
  const n = String(displayName || '')
    .trim()
    .replace(/[%_\\]/g, ' ');
  if (n.length < 3) return null;
  const pattern = `%${n.slice(0, 80)}%`;
  const { data, error } = await supabase
    .from('stores')
    .select('id, name')
    .eq('active', true)
    .ilike('name', pattern)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn('extract-flyer-vision findStoreByDisplayName:', error.message);
  }
  return data?.id ? data : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!(await checkFlyerVisionAuth(req, res))) {
    return res.status(403).json({ error: 'Forbidden — faça login ou envie x-cron-secret' });
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
    storeId: storeIdRaw,
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

  const flyerImageUrlForRows = visionUrl.startsWith('https://') ? visionUrl : null;

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
  const defaultExpireIso = new Date(Date.now() + ttl * 3_600_000).toISOString();
  const ingestSource = buildIngestSource(supermercado, flyerKey, visionUrl);
  const promotionsSourceTag = buildPromotionsSourceTag(ingestSource);

  let storeId = null;
  let resolvedStoreName = storeName && String(storeName).trim() ? String(storeName).trim().slice(0, 200) : null;
  if (storeIdRaw) {
    const sid = String(storeIdRaw).trim();
    const { data: st, error: stErr } = await supabase.from('stores').select('id, name').eq('id', sid).maybeSingle();
    if (!stErr && st?.id) {
      storeId = st.id;
      resolvedStoreName = String(st.name || resolvedStoreName || '').slice(0, 200);
    }
  }
  if (!storeId) {
    const bySlug = await findStoreRowForFlyerSlug(supabase, supermercado);
    if (bySlug?.id) {
      storeId = bySlug.id;
      resolvedStoreName = String(bySlug.name || '').slice(0, 200);
    }
  }
  if (!storeId && resolvedStoreName) {
    const byDisplay = await findStoreByDisplayName(supabase, resolvedStoreName);
    if (byDisplay?.id) {
      storeId = byDisplay.id;
      resolvedStoreName = String(byDisplay.name || resolvedStoreName).slice(0, 200);
    }
  }
  if (!storeId) {
    const defaultBrand = DEFAULT_DISPLAY_STORE_NAME_BY_SLUG[supermercado] || null;
    const newName = resolvedStoreName?.trim()
      ? resolvedStoreName.slice(0, 200)
      : defaultBrand || supermercado;
    const { data: created, error: createErr } = await supabase
      .from('stores')
      .insert({
        name: newName,
        type: 'supermarket',
        address: geocodeQuery && String(geocodeQuery).trim() ? String(geocodeQuery).trim().slice(0, 500) : null,
        lat,
        lng,
        active: true,
        needs_review: true,
      })
      .select('id, name')
      .single();
    if (createErr || !created?.id) {
      return res.status(500).json({
        error: createErr?.message || 'Não foi possível criar loja em stores',
      });
    }
    storeId = created.id;
    resolvedStoreName = String(created.name || newName).slice(0, 200);
  }

  const displayNameForPromotions = resolvedStoreName || 'Loja';
  const catList = VISION_CATEGORIES.join(' | ');
  const prompt = `Você analisa imagens de encartes e folhetos de supermercados brasileiros.

Extraia TODOS os produtos com preço promocional visível.
Cada produto = um objeto separado no array (não agrupe vários em um só).

## CAMPOS OBRIGATÓRIOS POR PRODUTO:
- product_name: nome completo (marca + descrição + gramagem)
  Ex: "Feijão Carioca Camil Pct 1kg", "Picanha Estância 92 Peça à Vácuo"
- promo_price: preço principal (número com ponto: 5.99). OBRIGATÓRIO.
- category: exatamente uma de: ${catList}

## CAMPOS OPCIONAIS:
- original_price: preço "De" / tachado, ou null
- club_price: preço clube/cartão fidelidade, ou null
- club_name: nome do programa (ex: "Clube Lopes"), ou null
- unit: kg | un | L | ml | g | pct | 100g | unid | null
- brand: marca do produto, ou null
- image_hint: frase curta descrevendo a embalagem/produto na imagem, ou null
- validity_note: texto curto sobre vigência deste produto (opcional), ou null

## VALIDADE — MUITO IMPORTANTE:
Folhetos brasileiros têm 3 tipos de validade:
1. Válido a semana toda → valid_from: "2026-04-06", valid_until: "2026-04-12", valid_dates: null
2. Válido só em dias específicos → valid_dates: ["2026-04-06","2026-04-10"], valid_from: null, valid_until: null
3. Válido num único dia → valid_dates: ["2026-04-07"], valid_from: null, valid_until: null

Regras de validade:
- "Segunda e Sexta, dias 06 e 10/04/2026" → valid_dates: ["2026-04-06","2026-04-10"]
- "Sábado e Domingo, 11 e 12/04/2026" → valid_dates: ["2026-04-11","2026-04-12"]
- "Segunda de Ofertas 06/04/2026" → valid_dates: ["2026-04-06"]
- "Válido de 06 a 12/04/2026" → valid_from: "2026-04-06", valid_until: "2026-04-12"
- Se não houver data visível para o produto → valid_from: null, valid_until: null, valid_dates: null

## METADADOS DO ENCARTE:
- chain_name_visible: nome do supermercado (ex: "Sacolão São Jorge")
- encarte_valid_from: data de início geral do encarte (YYYY-MM-DD ou null)
- encarte_valid_until: data de fim geral do encarte (YYYY-MM-DD ou null)

## FORMATO DE RESPOSTA (APENAS JSON, sem markdown):
{
  "chain_name_visible": "Sacolão São Jorge",
  "encarte_valid_from": "2026-04-06",
  "encarte_valid_until": "2026-04-12",
  "products": [
    {
      "product_name": "Feijão Carioca Camil Pct 1kg",
      "brand": "Camil",
      "unit": "pct",
      "category": "Mercearia",
      "promo_price": 5.98,
      "original_price": null,
      "club_price": null,
      "club_name": null,
      "valid_from": null,
      "valid_until": null,
      "valid_dates": ["2026-04-06"],
      "image_hint": "embalagem vermelha feijão carioca",
      "chain_name_visible": "Sacolão São Jorge"
    }
  ]
}`;

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
    const encarteFrom = parseFlexibleDateToIso(parsed?.encarte_valid_from);
    const encarteUntil = parseFlexibleDateToIso(parsed?.encarte_valid_until);
    const seen = new Set();
    const agentRows = [];
    const promotionRows = [];

    for (const p of products) {
      const nome = sanitizeNome(p?.product_name);
      const promo = parsePromoPriceNumber(p?.promo_price);
      if (!nome || promo == null) continue;

      const orig =
        p?.original_price != null && p.original_price !== '' ? parsePromoPriceNumber(p.original_price) : null;
      const club =
        p?.club_price != null && p.club_price !== '' ? parsePromoPriceNumber(p.club_price) : null;
      const unit = p?.unit != null ? String(p.unit).replace(/\s+/g, ' ').trim().slice(0, 32) || null : null;

      const dk = flyerProductDedupeKey(nome, promo, unit);
      if (seen.has(dk)) continue;
      seen.add(dk);

      let validDates = normalizeVisionValidDates(p?.valid_dates);
      let validFrom = parseFlexibleDateToIso(p?.valid_from);
      let validUntil = parseFlexibleDateToIso(p?.valid_until);
      if (!validDates?.length && !validFrom && !validUntil && encarteFrom && encarteUntil) {
        validFrom = encarteFrom;
        validUntil = encarteUntil;
      }

      let expiraEm = defaultExpireIso;
      if (validDates?.length) {
        const maxD = validDates.reduce((a, b) => (a > b ? a : b));
        const endIso = endOfValidDayBrazilIso(maxD);
        if (endIso) expiraEm = new Date(endIso).toISOString();
      } else if (validUntil) {
        const endIso = endOfValidDayBrazilIso(validUntil);
        if (endIso) expiraEm = new Date(endIso).toISOString();
      }

      const discountPct = computeDiscountPct(orig, promo);
      const imageHint =
        p?.image_hint != null && String(p.image_hint).trim()
          ? String(p.image_hint).replace(/\s+/g, ' ').trim().slice(0, 400)
          : null;

      let validityNote =
        p?.validity_note != null && String(p.validity_note).trim()
          ? String(p.validity_note).replace(/\s+/g, ' ').trim().slice(0, 400)
          : null;
      if (validDates?.length && !validityNote) {
        validityNote = `Datas: ${validDates.join(', ')}`;
      }

      agentRows.push({
        supermercado,
        nome_produto: nome,
        preco: promo,
        preco_original: formatPrecoOriginalDePor(orig, promo),
        categoria: sanitizeVisionCategory(p?.category),
        imagem_url: flyerImageUrlForRows,
        validade: validUntil || null,
        valid_from: validFrom,
        club_price: club != null && Number.isFinite(club) ? club : null,
        lat,
        lng,
        run_id: String(runId),
        atualizado_em: nowIso,
        expira_em: expiraEm,
        ativo: true,
        ingest_source: ingestSource,
        validity_note: validityNote,
      });

      if (storeId) {
        promotionRows.push({
          product_name: nome,
          promo_price: promo,
          original_price: orig != null && Number.isFinite(orig) ? orig : null,
          club_price: club != null && Number.isFinite(club) ? club : null,
          unit,
          category: sanitizeVisionCategory(p?.category),
          store_name: displayNameForPromotions,
          store_id: storeId,
          valid_from: validDates?.length ? null : validFrom,
          valid_until: validDates?.length ? null : validUntil,
          valid_dates: validDates?.length ? validDates : null,
          active: true,
          is_individual_product: true,
          source: promotionsSourceTag,
          flyer_image_url: flyerImageUrlForRows,
          product_image_url: null,
          image_hint: imageHint,
          discount_pct: discountPct != null ? discountPct : null,
          validity_note: validityNote,
        });
      }
    }

    if (replacePrevious) {
      const { error: deactErr } = await supabase
        .from('promocoes_supermercados')
        .update({ ativo: false })
        .eq('supermercado', supermercado)
        .eq('ingest_source', ingestSource)
        .eq('ativo', true);
      if (deactErr) {
        console.warn('extract-flyer-vision deactivate agent:', deactErr.message);
      }

      if (storeId && promotionRows.length) {
        const { error: prDeact } = await supabase
          .from('promotions')
          .update({ active: false })
          .eq('store_id', storeId)
          .eq('source', promotionsSourceTag)
          .eq('active', true);
        if (prDeact) {
          console.warn('extract-flyer-vision deactivate promotions:', prDeact.message);
        }
      }
    }

    if (!agentRows.length) {
      return res.status(200).json({
        ok: true,
        inserted: 0,
        insertedPromotions: 0,
        runId,
        ingestSource,
        model,
        maxTokens,
        note: 'Nenhum produto com nome e preço promocional válidos',
        rawCount: products.length,
      });
    }

    const chunkSize = 400;
    for (let i = 0; i < agentRows.length; i += chunkSize) {
      const slice = agentRows.slice(i, i + chunkSize);
      const { error: insertErr } = await supabase.from('promocoes_supermercados').insert(slice);
      if (insertErr) {
        console.error('extract-flyer-vision insert agent:', insertErr);
        return res.status(500).json({ error: insertErr.message });
      }
    }

    let insertedPromotions = 0;
    if (storeId && promotionRows.length) {
      for (let i = 0; i < promotionRows.length; i += chunkSize) {
        const slice = promotionRows.slice(i, i + chunkSize);
        const { error: pErr } = await supabase.from('promotions').insert(slice);
        if (pErr) {
          console.error('extract-flyer-vision insert promotions:', pErr);
          return res.status(500).json({ error: pErr.message });
        }
        insertedPromotions += slice.length;
      }
    }

    return res.status(200).json({
      ok: true,
      inserted: agentRows.length,
      insertedPromotions,
      runId,
      ingestSource,
      promotionsSourceTag,
      model,
      maxTokens,
      ttlHours: ttl,
      lat,
      lng,
      storeId: storeId || null,
    });
  } catch (e) {
    console.error('extract-flyer-vision error:', e);
    return res.status(500).json({ error: e?.message || 'Erro interno' });
  }
}
