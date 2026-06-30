import { requireMerchantApi } from '../../../../lib/merchant/requireMerchantApi';
import { normalizeEanDigits } from '../../../../lib/merchant/mapInsumoRow';

function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * POST /api/merchant/estoque/detect
 * Body: { imageBase64: string }
 *
 * Stub para plugar modelo servidor (YOLO / FastAPI). Retorna estrutura padrão.
 * Substitua `runServerVisionModel` por chamada ao seu serviço Python.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireMerchantApi(req, res);
  if (!auth) return;

  const body = parseBody(req);
  const imageBase64 = String(body.imageBase64 || '').trim();
  if (!imageBase64 || imageBase64.length < 32) {
    return res.status(400).json({ error: 'imageBase64 é obrigatório.' });
  }

  try {
    const detection = await runServerVisionModel({
      imageBase64,
      lojaId: auth.store.id,
      supabase: auth.supabase,
    });

    return res.status(200).json({
      ok: true,
      detection,
    });
  } catch (error) {
    console.error('[estoque/detect]', error?.message || error);
    return res.status(502).json({
      error: error?.message || 'Falha na inferência de visão.',
    });
  }
}

/**
 * PLUG: integre FastAPI/YOLO aqui (fetch para VISION_SERVER_URL).
 * @param {{ imageBase64: string, lojaId: string, supabase: import('@supabase/supabase-js').SupabaseClient }} input
 */
async function runServerVisionModel({ imageBase64, lojaId, supabase }) {
  const visionUrl = process.env.VISION_INFERENCE_URL?.trim();
  if (visionUrl) {
    const upstream = await fetch(visionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.VISION_INFERENCE_SECRET
          ? { Authorization: `Bearer ${process.env.VISION_INFERENCE_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ image_base64: imageBase64, loja_id: lojaId }),
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      throw new Error(data.error || `Vision upstream ${upstream.status}`);
    }
    const label = data.label || data.class_name || 'unknown';
    const confidence = Number(data.confidence) || 0;
    const ean = normalizeEanDigits(data.ean || data.gtin);
    return {
      label,
      confidence,
      ean,
      sku: data.sku || null,
      insumoId: data.insumo_id || data.insumoId || null,
    };
  }

  // Sem servidor de visão configurado — retorno neutro (cliente continua em modo local/barras).
  return {
    label: 'unknown',
    confidence: 0,
    ean: null,
    sku: null,
    insumoId: null,
    hint: 'Configure VISION_INFERENCE_URL para inferência na nuvem.',
  };
}
