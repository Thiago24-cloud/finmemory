import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ensureR2ForProductionApi, isCloudProduction } from '../../../lib/r2ProductionGuard';
import {
  buildReceiptR2Key,
  deleteFromR2,
  isR2Configured,
  uploadToR2,
} from '../../../lib/uploadToR2';

/**
 * POST /api/ocr/process-receipt
 * 
 * Processa imagem de nota fiscal usando GPT-4 Vision.
 * 
 * Body: { imageBase64: string, userId: string, fileName?: string }
 * 
 * Fluxo:
 * 1. Valida imagem (tamanho, formato)
 * 2. Faz upload para Cloudflare R2 (se configurado) ou Supabase Storage
 * 3. Envia para GPT-4 Vision extrair dados
 * 4. Retorna dados extraídos + URL da imagem
 */

// Rate limiting simples em memória (reset ao reiniciar)
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 20; // máximo por hora
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hora em ms

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  
  // Reset se passou a janela
  if (now > userLimit.resetAt) {
    userLimit.count = 0;
    userLimit.resetAt = now + RATE_LIMIT_WINDOW;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    const minutesLeft = Math.ceil((userLimit.resetAt - now) / 60000);
    return { allowed: false, minutesLeft };
  }
  
  userLimit.count++;
  rateLimitMap.set(userId, userLimit);
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count };
}

// Lazy initialization
let openaiInstance = null;
let supabaseInstance = null;

function getOpenAI() {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY não configurada');
      return null;
    }
    openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiInstance;
}

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.error('❌ Variáveis do Supabase não configuradas');
      return null;
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// Validar formato de imagem
function validateImage(base64String) {
  // Remover prefixo data:image/...;base64, se existir
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  
  // Calcular tamanho aproximado em bytes
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInMB = sizeInBytes / (1024 * 1024);
  
  if (sizeInMB > 2.5) { // margem de segurança
    return { valid: false, error: 'Imagem muito grande. Máximo 2MB.' };
  }
  
  // Verificar se é base64 válido
  try {
    Buffer.from(base64Data, 'base64');
  } catch {
    return { valid: false, error: 'Formato de imagem inválido.' };
  }
  
  return { valid: true, base64Data, sizeInMB };
}

// Prompt para o GPT-4 Vision
const OCR_PROMPT = `Você é um especialista em extrair informações de notas fiscais brasileiras (NFC-e, cupom fiscal, nota fiscal eletrônica).

Analise esta imagem e extraia as seguintes informações em formato JSON:

{
  "is_valid_receipt": true/false,
  "date": "YYYY-MM-DD",
  "merchant_name": "Nome completo do estabelecimento",
  "merchant_cnpj": "XX.XXX.XXX/XXXX-XX",
  "merchant_address": "Endereço completo se visível (rua, número, bairro, cidade)",
  "total_amount": 123.45,
  "items": [
    {"name": "Nome do produto", "price": 12.90},
    {"name": "Outro produto", "price": 8.50}
  ],
  "category": "Supermercado|Restaurante|Farmácia|Eletrônicos|Vestuário|Serviços|Combustível|Outros",
  "payment_method": "Cartão de Crédito|Débito|Dinheiro|PIX|null"
}

REGRAS IMPORTANTES:
1. Se a imagem NÃO for uma nota fiscal brasileira válida, retorne {"is_valid_receipt": false}
2. Valores devem ser números (sem "R$", sem pontos de milhar, use ponto como separador decimal)
3. Datas no formato YYYY-MM-DD
4. Se algum campo não estiver visível na imagem, use null
5. Seja preciso nos valores e nomes dos itens
6. O campo "category" deve ser uma das opções listadas
7. Extraia TODOS os itens visíveis na nota

Retorne APENAS o JSON, sem texto adicional, sem markdown.`;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb', // Limite do body (base64 é maior que o arquivo original)
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ensureR2ForProductionApi(res)) return;

  const openai = getOpenAI();
  const supabase = getSupabase();

  if (!openai) {
    return res.status(500).json({ 
      success: false, 
      error: 'Configuração do servidor incompleta (OpenAI)' 
    });
  }

  if (!supabase) {
    return res.status(500).json({ 
      success: false, 
      error: 'Configuração do servidor incompleta (Supabase)' 
    });
  }

  let storagePath = null;
  let useR2 = false;
  let supabaseForCleanup = null;

  try {
    const { imageBase64, userId, fileName } = req.body;

    // Validar campos obrigatórios
    if (!imageBase64) {
      return res.status(400).json({ 
        success: false, 
        error: 'Imagem não enviada' 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'userId é obrigatório' 
      });
    }

    console.log('📸 Processando nota fiscal para usuário:', userId);

    // Rate limiting
    const rateCheck = checkRateLimit(userId);
    if (!rateCheck.allowed) {
      console.log(`⚠️ Rate limit atingido para ${userId}`);
      return res.status(429).json({
        success: false,
        error: `Limite de processamento atingido. Tente novamente em ${rateCheck.minutesLeft} minutos.`,
        retryAfterMinutes: rateCheck.minutesLeft
      });
    }

    // Validar imagem
    const validation = validateImage(imageBase64);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        error: validation.error 
      });
    }

    console.log(`📏 Tamanho da imagem: ${validation.sizeInMB.toFixed(2)}MB`);

    // Verificar se usuário existe
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      console.error('❌ Usuário não encontrado:', userError);
      return res.status(404).json({ 
        success: false, 
        error: 'Usuário não encontrado' 
      });
    }

    // 1. Upload da imagem (R2 se configurado, senão Supabase Storage)
    console.log('📤 Fazendo upload da imagem...');

    const timestamp = Date.now();
    const mimeMatch = String(imageBase64).match(/^data:(image\/[\w+.-]+);base64,/i);
    const contentType = mimeMatch ? mimeMatch[1].toLowerCase() : 'image/jpeg';
    const fileExtension = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : 'jpg';

    const imageBuffer = Buffer.from(validation.base64Data, 'base64');

    supabaseForCleanup = supabase;
    useR2 = isCloudProduction() || isR2Configured();

    if (isCloudProduction() && !isR2Configured()) {
      return res.status(503).json({
        success: false,
        error: 'Armazenamento R2 obrigatório em produção.',
        code: 'R2_PRODUCTION_REQUIRED',
      });
    }

    storagePath = useR2
      ? buildReceiptR2Key(userId, timestamp, fileExtension)
      : `${userId}/${timestamp}.${fileExtension}`;

    let receiptImageUrl = null;

    if (useR2) {
      const r2Upload = await uploadToR2(imageBuffer, storagePath, contentType);
      if (!r2Upload.success) {
        console.error('❌ Erro ao fazer upload R2:', r2Upload.error);
        return res.status(500).json({
          success: false,
          error: 'Erro ao salvar imagem',
          details: r2Upload.error?.message || 'Falha no upload R2',
        });
      }
      receiptImageUrl = r2Upload.url;
      console.log('✅ Upload R2 concluído:', storagePath);
    } else {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, imageBuffer, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        console.error('❌ Erro ao fazer upload:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Erro ao salvar imagem',
          details: uploadError.message,
        });
      }

      console.log('✅ Upload Supabase concluído:', uploadData.path);

      const { data: urlData } = await supabase.storage
        .from('receipts')
        .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

      receiptImageUrl = urlData?.signedUrl || null;
    }

    async function removeStoredReceipt() {
      if (useR2) {
        await deleteFromR2(storagePath);
      } else {
        await supabase.storage.from('receipts').remove([storagePath]);
      }
    }

    // 2. Chamar GPT-4 Vision para OCR
    console.log('🤖 Enviando para GPT-4 Vision...');

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-4o', // gpt-4o tem vision integrado
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: OCR_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${validation.base64Data}`,
                  detail: 'high' // alta qualidade para OCR
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1 // baixa temperatura para precisão
      });
    } catch (openaiError) {
      console.error('❌ Erro ao chamar OpenAI:', openaiError);
      
      await removeStoredReceipt();
      
      return res.status(500).json({
        success: false,
        error: 'Erro ao processar imagem com IA',
        details: openaiError.message
      });
    }

    const responseContent = completion.choices[0]?.message?.content || '';
    console.log('📝 Resposta do GPT:', responseContent.substring(0, 500));

    // 3. Parsear resposta JSON
    let extractedData;
    try {
      // Limpar possíveis marcadores de código
      let jsonStr = responseContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      // Encontrar o JSON na resposta
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      extractedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('❌ Erro ao parsear resposta:', parseError);
      console.error('📄 Resposta bruta:', responseContent);
      
      await removeStoredReceipt();

      return res.status(500).json({
        success: false,
        error: 'Não foi possível extrair dados da imagem. A resposta da IA não está no formato esperado.',
        rawResponse: responseContent.substring(0, 500)
      });
    }

    // 4. Verificar se é uma nota fiscal válida
    if (!extractedData.is_valid_receipt) {
      console.log('⚠️ Imagem não é uma nota fiscal válida');
      
      await removeStoredReceipt();
      
      return res.status(400).json({
        success: false,
        error: 'Não conseguimos identificar uma nota fiscal na imagem. Tente novamente com melhor iluminação ou uma foto mais nítida.',
        isInvalidReceipt: true
      });
    }

    console.log('✅ Dados extraídos com sucesso:', {
      merchant: extractedData.merchant_name,
      total: extractedData.total_amount,
      items: extractedData.items?.length || 0
    });

    // 5. Retornar dados extraídos (não salvar ainda, usuário vai confirmar)
    return res.status(200).json({
      success: true,
      data: {
        is_valid_receipt: true,
        date: extractedData.date || null,
        merchant_name: extractedData.merchant_name || null,
        merchant_cnpj: extractedData.merchant_cnpj || null,
        merchant_address: extractedData.merchant_address || null,
        total_amount: parseFloat(extractedData.total_amount) || null,
        items: extractedData.items || [],
        category: extractedData.category || null,
        payment_method: extractedData.payment_method || null,
        receipt_image_url: receiptImageUrl,
      },
      remaining_requests: rateCheck.remaining
    });

  } catch (error) {
    if (storagePath) {
      try {
        if (useR2) {
          await deleteFromR2(storagePath);
        } else if (supabaseForCleanup) {
          await supabaseForCleanup.storage.from('receipts').remove([storagePath]);
        }
      } catch (cleanupErr) {
        console.warn('⚠️ Falha ao limpar comprovante após erro:', cleanupErr?.message || cleanupErr);
      }
    }

    console.error('❌ Erro no processamento:', error);
    console.error('   Stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar nota fiscal',
      details: error.message
    });
  }
}
