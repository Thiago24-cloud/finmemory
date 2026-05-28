/**
 * Validação opcional (visão): descarta imagens erradas (suplemento, tamanho incoerente com preço).
 * Ative com MAP_PRODUCT_IMAGE_VISION_VALIDATE=1.
 * Provedor: MAP_PRODUCT_IMAGE_VISION_PROVIDER=openai|gemini (padrão openai).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

function visionProvider() {
  const p = String(process.env.MAP_PRODUCT_IMAGE_VISION_PROVIDER || 'openai')
    .trim()
    .toLowerCase();
  return p === 'gemini' ? 'gemini' : 'openai';
}

function visionEnabled() {
  if (typeof process === 'undefined' || process.env?.MAP_PRODUCT_IMAGE_VISION_VALIDATE !== '1') {
    return false;
  }
  if (visionProvider() === 'gemini') {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function buildVisionPrompt(label, priceContext) {
  const priceLine = priceContext
    ? `\nContexto de preço/tamanho esperado: ${priceContext}`
    : '';
  return `Produto: ${label || '(vazio)'}${priceLine}

Critérios (estilo iFood / supermercado):
- Fundo preferencialmente branco ou neutro; produto nítido e centralizado.
- Rejeitar suplementos, whey, cosméticos, itens não relacionados.
- Veracidade: o tamanho/quantidade na foto deve combinar com o preço (ex.: bolo barato ≠ bolo gigante de festa; sabão R$ 2 ≠ saco 2kg).
Responda só JSON: {"ok":true} ou {"ok":false,"reason":"..."}`;
}

async function validateWithGemini(url, label, priceContext) {
  const modelName =
    process.env.MAP_PRODUCT_IMAGE_VISION_MODEL?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() ||
    'gemini-2.5-flash';
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  const model = genAI.getGenerativeModel({ model: modelName });

  const imgRes = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!imgRes.ok) return false;
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const mime = imgRes.headers.get('content-type') || 'image/jpeg';

  const result = await model.generateContent([
    buildVisionPrompt(label, priceContext),
    { inlineData: { mimeType: mime.split(';')[0], data: buf.toString('base64') } },
  ]);
  const raw = result?.response?.text?.()?.trim() || '';
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return true;
  const parsed = JSON.parse(m[0]);
  return Boolean(parsed?.ok);
}

async function validateWithOpenAI(url, label, priceContext) {
  let OpenAI;
  try {
    ({ default: OpenAI } = await import('openai'));
  } catch {
    return true;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.MAP_PRODUCT_IMAGE_VISION_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const user = `${buildVisionPrompt(label, priceContext)}\nImage URL: ${url}`;

  const res = await client.chat.completions.create({
    model,
    max_tokens: 120,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Strict image QA for a Brazilian grocery price map. JSON only.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: user },
          { type: 'image_url', image_url: { url, detail: 'low' } },
        ],
      },
    ],
  });
  const raw = res?.choices?.[0]?.message?.content?.trim();
  if (!raw) return true;
  const parsed = JSON.parse(raw);
  return Boolean(parsed?.ok);
}

/**
 * @param {string} imageUrl
 * @param {string} productName — pode incluir contexto de tamanho (visionLabel)
 * @param {{ price?: number|null, unit?: string|null }} [opts]
 * @returns {Promise<boolean>} true = aceitar imagem
 */
export async function validateMapProductImageUrl(imageUrl, productName, opts = {}) {
  if (!visionEnabled()) return true;
  const url = String(imageUrl || '').trim();
  const label = String(productName || '').trim().slice(0, 300);
  if (!url || !/^https?:\/\//i.test(url)) return false;

  const priceContext =
    opts.price != null
      ? `R$ ${Number(opts.price).toFixed(2)}${opts.unit ? ` / ${opts.unit}` : ''}`
      : opts.unit
        ? String(opts.unit)
        : '';

  try {
    if (visionProvider() === 'gemini') {
      return await validateWithGemini(url, label, priceContext);
    }
    return await validateWithOpenAI(url, label, priceContext);
  } catch (e) {
    console.warn('validateMapProductImageUrl:', e?.message || e);
    return true;
  }
}

export { visionEnabled };
