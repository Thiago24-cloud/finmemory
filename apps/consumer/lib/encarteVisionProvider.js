/**
 * Provedor de visão para extração de encartes (fila encarte_queue → promotions).
 * ENCARTE_VISION_PROVIDER=openai | gemini (padrão: openai).
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export function parseVisionJsonResponse(text) {
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

export function getEncarteVisionProvider() {
  return (process.env.ENCARTE_VISION_PROVIDER || 'openai').toLowerCase().trim();
}

function clampInt(n, min, max, fallback) {
  const x = Number.parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(max, Math.max(min, x));
}

async function loadImageAsGeminiInline(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (url.startsWith('data:image/')) {
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(url.replace(/\s/g, ''));
    if (!m) throw new Error('data:image inválida para Gemini');
    return { mimeType: m[1].toLowerCase(), data: m[2] };
  }
  if (!url.startsWith('https://')) {
    throw new Error('Só https:// ou data:image/ são suportados');
  }
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(60000),
    headers: { Accept: 'image/*,*/*' },
  });
  if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  let mimeType = ct && ct.startsWith('image/') ? ct : 'image/jpeg';
  if (mimeType === 'application/octet-stream' || !mimeType.startsWith('image/')) {
    const lower = url.split('?')[0].toLowerCase();
    if (lower.endsWith('.png')) mimeType = 'image/png';
    else if (lower.endsWith('.webp')) mimeType = 'image/webp';
    else if (lower.endsWith('.gif')) mimeType = 'image/gif';
    else mimeType = 'image/jpeg';
  }
  return { mimeType, data: buf.toString('base64') };
}

async function runOpenAiVision({ imageUrl, prompt, model, maxTokens }) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY não configurada');
  const openai = new OpenAI({ apiKey: key });
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });
  const raw = completion?.choices?.[0]?.message?.content || '';
  return { raw, model };
}

async function runGeminiVision({ imageUrl, prompt, model, maxTokens }) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const { mimeType, data } = await loadImageAsGeminiInline(imageUrl);
  const genAI = new GoogleGenerativeAI(key);
  const genModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    },
  });
  const result = await genModel.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data,
            },
          },
        ],
      },
    ],
  });
  const raw = result?.response?.text?.() || '';
  return { raw, model };
}

/**
 * @param {{ imageUrl: string, prompt: string }} opts
 * @returns {Promise<{ raw: string, model: string, provider: string }>}
 */
export async function runEncarteVision({ imageUrl, prompt }) {
  const provider = getEncarteVisionProvider();
  const maxTokensRaw = Number.parseInt(process.env.OPENAI_VISION_MAX_TOKENS || '4096', 10);
  const maxTokensOpenAi = Number.isFinite(maxTokensRaw)
    ? Math.min(16384, Math.max(512, maxTokensRaw))
    : 4096;
  const maxTokensGemini = clampInt(
    process.env.GEMINI_ENCARTE_MAX_OUTPUT_TOKENS || maxTokensOpenAi,
    512,
    8192,
    Math.min(8192, maxTokensOpenAi)
  );

  if (provider === 'gemini') {
    const model =
      process.env.GEMINI_ENCARTE_MODEL?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_MODEL?.trim() ||
      'gemini-2.0-flash';
    const { raw, model: m } = await runGeminiVision({
      imageUrl,
      prompt,
      model,
      maxTokens: maxTokensGemini,
    });
    return { raw, model: m, provider: 'gemini' };
  }

  if (provider !== 'openai') {
    throw new Error(`ENCARTE_VISION_PROVIDER inválido: ${provider} (use openai ou gemini)`);
  }

  const model =
    process.env.EXTRACT_PROMO_VISION_MODEL?.trim() ||
    process.env.OPENAI_VISION_MODEL?.trim() ||
    'gpt-4o';
  const { raw, model: m } = await runOpenAiVision({
    imageUrl,
    prompt,
    model,
    maxTokens: maxTokensOpenAi,
  });
  return { raw, model: m, provider: 'openai' };
}
