import OpenAI from 'openai';
import { RECEIPT_OCR_PROMPT } from './receiptOcrPrompt';
import { isCloudProduction, ensureR2ForProductionApi } from '../r2ProductionGuard';
import {
  buildReceiptR2Key,
  deleteFromR2,
  isR2Configured,
  uploadToR2,
} from '../uploadToR2';

const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  if (now > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = now + RATE_LIMIT_WINDOW;
  }
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, minutesLeft: Math.ceil((userLimit.resetAt - now) / 60000) };
  }
  userLimit.count++;
  rateLimitMap.set(userId, userLimit);
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count };
}

function validateImage(base64String) {
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  if (sizeInMB > 2.5) return { valid: false, error: 'Imagem muito grande. Máximo ~2MB.' };
  try {
    Buffer.from(base64Data, 'base64');
  } catch {
    return { valid: false, error: 'Formato de imagem inválido.' };
  }
  return { valid: true, base64Data, sizeInMB };
}

function parseOcrJson(responseContent) {
  let jsonStr = responseContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) jsonStr = jsonMatch[0];
  return JSON.parse(jsonStr);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId: string, imageBase64: string, fileName?: string }} opts
 */
export async function processReceiptImage(supabase, { userId, imageBase64, fileName }) {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, status: 500, error: 'OCR indisponível (OpenAI não configurado).' };
  }

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Limite de leituras atingido. Tente em ${rateCheck.minutesLeft} min.`,
    };
  }

  const validation = validateImage(imageBase64);
  if (!validation.valid) {
    return { ok: false, status: 400, error: validation.error };
  }

  if (isCloudProduction() && !isR2Configured()) {
    return { ok: false, status: 503, error: 'Armazenamento R2 obrigatório em produção.', code: 'R2_PRODUCTION_REQUIRED' };
  }

  const timestamp = Date.now();
  const mimeMatch = String(imageBase64).match(/^data:(image\/[\w+.-]+);base64,/i);
  const contentType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';
  const fileExtension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const imageBuffer = Buffer.from(validation.base64Data, 'base64');
  const useR2 = isCloudProduction() || isR2Configured();
  const storagePath = useR2
    ? buildReceiptR2Key(userId, timestamp, fileExtension)
    : `${userId}/${timestamp}.${fileExtension}`;

  let receiptImageUrl = null;

  async function removeStored() {
    if (useR2) await deleteFromR2(storagePath);
    else await supabase.storage.from('receipts').remove([storagePath]);
  }

  if (useR2) {
    const r2Upload = await uploadToR2(imageBuffer, storagePath, contentType);
    if (!r2Upload.success) {
      return { ok: false, status: 500, error: 'Erro ao salvar imagem da nota.' };
    }
    receiptImageUrl = r2Upload.url;
  } else {
    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(storagePath, imageBuffer, { contentType, upsert: false });
    if (uploadError) {
      return { ok: false, status: 500, error: 'Erro ao salvar imagem da nota.' };
    }
    const { data: urlData } = await supabase.storage.from('receipts').createSignedUrl(storagePath, 60 * 60 * 24 * 365);
    receiptImageUrl = urlData?.signedUrl || null;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let extractedData;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: RECEIPT_OCR_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${validation.base64Data}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });
    extractedData = parseOcrJson(completion.choices[0]?.message?.content || '');
  } catch (err) {
    await removeStored();
    return { ok: false, status: 500, error: 'Erro ao processar imagem com IA.', details: err.message };
  }

  if (!extractedData.is_valid_receipt) {
    await removeStored();
    return {
      ok: false,
      status: 400,
      error: 'Não identificamos uma nota fiscal na imagem. Tente outra foto.',
      isInvalidReceipt: true,
    };
  }

  const items = (extractedData.items || []).map((item) => ({
    name: String(item.name || 'Item').trim(),
    price: parseFloat(item.price) || 0,
    quantity: Math.max(1, parseFloat(item.quantity) || 1),
  }));

  return {
    ok: true,
    data: {
      date: extractedData.date || null,
      merchant_name: extractedData.merchant_name || null,
      merchant_cnpj: extractedData.merchant_cnpj || null,
      total_amount: parseFloat(extractedData.total_amount) || null,
      items,
      receipt_image_url: receiptImageUrl,
      chave_nfe: null,
      nfce_url: null,
    },
    remaining_requests: rateCheck.remaining,
  };
}

/** Para uso em handlers Next — retorna false se bloqueou res */
export function ensureReceiptStorageReady(res) {
  return ensureR2ForProductionApi(res);
}
