import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

/**
 * POST /api/ocr/process-receipt
 * 
 * Processa imagem de nota fiscal usando GPT-4 Vision.
 * 
 * Body: { imageBase64: string, userId: string, fileName?: string }
 * 
 * Fluxo:
 * 1. Valida imagem (tamanho, formato)
 * 2. Faz upload para Supabase Storage
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

    // 1. Upload da imagem para Supabase Storage
    console.log('📤 Fazendo upload da imagem...');
    
    const timestamp = Date.now();
    const fileExtension = 'jpg'; // Assumindo JPG, pode melhorar detecção
    const storagePath = `${userId}/${timestamp}.${fileExtension}`;
    
    // Converter base64 para buffer
    const imageBuffer = Buffer.from(validation.base64Data, 'base64');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Erro ao fazer upload:', uploadError);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao salvar imagem',
        details: uploadError.message 
      });
    }

    console.log('✅ Upload concluído:', uploadData.path);

    // Obter URL pública/signed da imagem
    const { data: urlData } = await supabase.storage
      .from('receipts')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 ano

    const receiptImageUrl = urlData?.signedUrl || null;

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
      
      // Deletar imagem se OCR falhou
      await supabase.storage.from('receipts').remove([storagePath]);
      
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
      
      return res.status(500).json({
        success: false,
        error: 'Não foi possível extrair dados da imagem. A resposta da IA não está no formato esperado.',
        rawResponse: responseContent.substring(0, 500)
      });
    }

    // 4. Verificar se é uma nota fiscal válida
    if (!extractedData.is_valid_receipt) {
      console.log('⚠️ Imagem não é uma nota fiscal válida');
      
      // Deletar imagem se não é nota fiscal
      await supabase.storage.from('receipts').remove([storagePath]);
      
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
        total_amount: parseFloat(extractedData.total_amount) || null,
        items: extractedData.items || [],
        category: extractedData.category || null,
        payment_method: extractedData.payment_method || null,
        receipt_image_url: receiptImageUrl,
        storage_path: storagePath // para referência interna
      },
      remaining_requests: rateCheck.remaining
    });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    console.error('   Stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar nota fiscal',
      details: error.message
    });
  }
}
