import { google } from 'googleapis';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization - só cria quando necessário
let openaiInstance = null;
let supabaseInstance = null;

function getOpenAI() {
  if (!openaiInstance) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ ERRO: OPENAI_API_KEY não configurada!');
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
      console.error('❌ ERRO: Variáveis do Supabase não configuradas!');
      return null;
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Obter instâncias dos serviços
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
    const { userId, firstSync } = req.body;
    console.log('🔍 Iniciando sync para usuário:', userId);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tokenExpiry = new Date(user.token_expiry);
    const now = new Date();
    
    if (tokenExpiry <= now && user.refresh_token) {
      console.log('🔄 Renovando token...');
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI // Pode ser múltiplas, separadas por vírgula
      );

      oauth2Client.setCredentials({ refresh_token: user.refresh_token });
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      await supabase
        .from('users')
        .update({
          access_token: credentials.access_token,
          token_expiry: new Date(credentials.expiry_date)
        })
        .eq('id', userId);

      user.access_token = credentials.access_token;
    }

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: user.access_token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Busca por termos relacionados a notas fiscais (no assunto ou corpo)
    // Inclui busca em todas as pastas (inbox, promoções, etc.)
    let query = 'in:anywhere (cupom OR fiscal OR nota OR NFC-e OR NF-e OR danfe OR comprovante OR recibo OR drogaria OR farmacia)';
    
    console.log('🔎 Query de busca:', query);
    
    if (firstSync) {
      query += ' newer_than:30d';
      console.log('📧 Primeira sync: últimos 30 dias');
    } else {
      const lastSync = new Date(user.last_sync);
      const daysSinceSync = Math.ceil((now - lastSync) / (1000 * 60 * 60 * 24)) + 1;
      query += ` newer_than:${daysSinceSync}d`;
      console.log(`📧 Sync desde: ${daysSinceSync} dias atrás`);
    }

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    });

    const messages = response.data.messages || [];
    console.log(`📨 ${messages.length} e-mails encontrados`);

    let processed = 0;
    let errors = 0;

    for (const message of messages) {
      try {
        const { data: existing } = await supabase
          .from('transacoes')
          .select('id')
          .eq('email_id', message.id)
          .single();

        if (existing) {
          console.log(`⏭️  E-mail ${message.id} já processado`);
          continue;
        }

        console.log(`📩 Processando e-mail ${message.id}...`);

        const emailData = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        let emailBody = extractEmailBody(emailData.data);
        
        if (!emailBody || emailBody.length < 50) {
          console.log(`⚠️  E-mail vazio ou muito curto, pulando...`);
          continue;
        }

        console.log(`📄 Corpo do e-mail extraído: ${emailBody.length} caracteres`);
        console.log('🤖 Enviando para GPT...');
        
        let completion;
        let result;
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Você é um especialista em extrair informações de notas fiscais brasileiras (NF-e, NFC-e, cupons fiscais, recibos).

IMPORTANTE: Retorne APENAS um JSON válido, sem markdown, sem texto adicional antes ou depois.

CAMPOS OBRIGATÓRIOS (não pode faltar):
- estabelecimento: Nome da loja/empresa (string, obrigatório)
- total: Valor total da compra (number, obrigatório, sempre > 0)

CAMPOS OPCIONAIS (pode ser null se não encontrar):
- cnpj, endereco, cidade, estado, data, hora, formaPagamento, descontos, subtotal, numeroNota, chaveAcesso, produtos

FORMATO DO JSON (use null para campos não encontrados):
{
  "estabelecimento": "Nome da Loja",
  "cnpj": "12.345.678/0001-90" ou null,
  "endereco": "Rua, número" ou null,
  "cidade": "Cidade" ou null,
  "estado": "UF" ou null,
  "data": "YYYY-MM-DD" ou null,
  "hora": "HH:MM:SS" ou null,
  "total": 50.99,
  "formaPagamento": "Cartão/Dinheiro/PIX" ou null,
  "produtos": [
    {
      "codigo": "123" ou null,
      "descricao": "Nome do produto",
      "quantidade": 2.0,
      "unidade": "UN" ou "KG" ou "L",
      "valorUnitario": 25.50,
      "valorTotal": 51.00
    }
  ] ou [],
  "descontos": 0.00 ou null,
  "subtotal": 50.99 ou null,
  "numeroNota": "123456" ou null,
  "chaveAcesso": "chave" ou null
}

Se não conseguir identificar o estabelecimento ou o total, retorne um JSON com esses campos como null e adicione um campo "erro": "mensagem explicando o problema".`
              },
              { role: "user", content: `Extraia as informações da seguinte nota fiscal/cupom/recibo:\n\n${emailBody.substring(0, 15000)}` }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
          });

          result = completion.choices[0].message.content;
        } catch (openaiError) {
          console.error('❌ Erro ao chamar OpenAI:', openaiError);
          // Se o erro for por causa do response_format, tenta sem ele
          if (openaiError.message?.includes('response_format') || openaiError.code === 'invalid_request_error') {
            console.log('🔄 Tentando novamente sem response_format...');
            try {
              completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "system",
                    content: `Você é um especialista em extrair informações de notas fiscais brasileiras. Retorne APENAS JSON válido sem markdown, sem texto adicional. Campos obrigatórios: estabelecimento (string) e total (number > 0).`
                  },
                  { role: "user", content: `Extraia as informações da seguinte nota fiscal:\n\n${emailBody.substring(0, 15000)}` }
                ],
                temperature: 0.1
              });
              result = completion.choices[0].message.content;
            } catch (retryError) {
              console.error('❌ Erro na segunda tentativa:', retryError);
              errors++;
              continue;
            }
          } else {
            errors++;
            continue;
          }
        }
        console.log('✅ GPT respondeu');
        console.log('📝 Resposta bruta do GPT (primeiros 500 chars):', result.substring(0, 500));

        let notaFiscal;
        try {
          // Remove markdown code blocks se existirem
          let jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          // Remove possíveis prefixos de texto antes do JSON
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          }
          notaFiscal = JSON.parse(jsonStr);
          console.log('✅ JSON parseado com sucesso');
          console.log('📋 Dados extraídos:', {
            estabelecimento: notaFiscal.estabelecimento || '❌ FALTANDO',
            total: notaFiscal.total || '❌ FALTANDO',
            data: notaFiscal.data || '❌ FALTANDO',
            produtos_count: notaFiscal.produtos?.length || 0
          });
        } catch (e) {
          console.error('❌ Erro ao parsear JSON:', e);
          console.error('📄 Conteúdo que falhou ao parsear:', result.substring(0, 1000));
          errors++;
          continue;
        }

        // Normalização e validação dos dados
        if (!notaFiscal) {
          console.log('⚠️  Dados incompletos: objeto notaFiscal é null/undefined');
          console.log('   Resposta completa do GPT:', result);
          errors++;
          continue;
        }

        // Normaliza o estabelecimento (remove espaços, tenta encontrar em outros campos)
        if (!notaFiscal.estabelecimento || notaFiscal.estabelecimento.trim() === '') {
          // Tenta encontrar em outros campos comuns
          notaFiscal.estabelecimento = notaFiscal.estabelecimento || 
                                      notaFiscal.loja || 
                                      notaFiscal.empresa || 
                                      notaFiscal.razaoSocial ||
                                      notaFiscal.nomeEstabelecimento ||
                                      'Estabelecimento Desconhecido';
        }

        // Normaliza o total (tenta converter de string, remove R$, espaços, etc)
        let totalValue = null;
        if (notaFiscal.total !== null && notaFiscal.total !== undefined) {
          if (typeof notaFiscal.total === 'string') {
            // Remove R$, espaços, pontos de milhar, mantém apenas vírgula decimal
            const cleaned = notaFiscal.total.replace(/R\$\s*/gi, '')
                                            .replace(/\./g, '')
                                            .replace(',', '.')
                                            .trim();
            totalValue = parseFloat(cleaned);
          } else {
            totalValue = parseFloat(notaFiscal.total);
          }
        }

        // Se ainda não tem total, tenta subtotal
        if (!totalValue || isNaN(totalValue) || totalValue <= 0) {
          if (notaFiscal.subtotal) {
            if (typeof notaFiscal.subtotal === 'string') {
              const cleaned = notaFiscal.subtotal.replace(/R\$\s*/gi, '')
                                                  .replace(/\./g, '')
                                                  .replace(',', '.')
                                                  .trim();
              totalValue = parseFloat(cleaned);
            } else {
              totalValue = parseFloat(notaFiscal.subtotal);
            }
          }
        }

        // Validação final
        const camposFaltando = [];
        const estabelecimentoNormalizado = notaFiscal.estabelecimento?.trim() || '';
        if (!estabelecimentoNormalizado || estabelecimentoNormalizado.length < 2) {
          camposFaltando.push('estabelecimento (muito curto ou vazio)');
        }
        if (!totalValue || isNaN(totalValue) || totalValue <= 0) {
          camposFaltando.push(`total (valor: ${totalValue}, inválido ou <= 0)`);
        }

        if (camposFaltando.length > 0) {
          console.log('⚠️  Dados incompletos após normalização, pulando...');
          console.log('   Campos faltando:', camposFaltando.join(', '));
          console.log('   Estabelecimento tentado:', notaFiscal.estabelecimento);
          console.log('   Total tentado:', totalValue);
          console.log('   Dados recebidos (primeiros 1000 chars):', JSON.stringify(notaFiscal, null, 2).substring(0, 1000));
          errors++;
          continue;
        }

        // Atualiza o total normalizado
        notaFiscal.total = totalValue;

        console.log('💾 Salvando no Supabase...');

        const { data: transaction, error: transError } = await supabase
          .from('transacoes')
          .insert({
            user_id: userId,
            estabelecimento: notaFiscal.estabelecimento,
            cnpj: notaFiscal.cnpj || null,
            endereco: notaFiscal.endereco || null,
            cidade: notaFiscal.cidade || null,
            estado: notaFiscal.estado || null,
            data: notaFiscal.data || null,
            hora: notaFiscal.hora || null,
            total: parseFloat(notaFiscal.total) || 0,
            forma_pagamento: notaFiscal.formaPagamento || null,
            descontos: parseFloat(notaFiscal.descontos) || 0,
            subtotal: parseFloat(notaFiscal.subtotal || notaFiscal.total) || 0,
            numero_nota: notaFiscal.numeroNota || null,
            chave_acesso: notaFiscal.chaveAcesso || null,
            email_id: message.id
          })
          .select()
          .single();

        if (transError) {
          console.error('❌ Erro ao salvar transação:', transError);
          errors++;
          continue;
        }

        console.log('✅ Transação salva:', transaction.id);

        if (notaFiscal.produtos && notaFiscal.produtos.length > 0) {
          const produtosToInsert = notaFiscal.produtos.map(produto => ({
            transacao_id: transaction.id,
            codigo: produto.codigo,
            descricao: produto.descricao,
            quantidade: parseFloat(produto.quantidade),
            unidade: produto.unidade,
            valor_unitario: parseFloat(produto.valorUnitario),
            valor_total: parseFloat(produto.valorTotal)
          }));

          const { error: prodError } = await supabase.from('produtos').insert(produtosToInsert);

          if (prodError) {
            console.error('❌ Erro ao salvar produtos:', prodError);
          } else {
            console.log(`✅ ${produtosToInsert.length} produtos salvos`);
          }
        }

        processed++;
        console.log(`✅ Nota processada! (${processed}/${messages.length})`);

      } catch (error) {
        console.error('❌ Erro ao processar e-mail:', error);
        errors++;
      }
    }

    await supabase.from('users').update({ last_sync: now }).eq('id', userId);

    console.log(`🎉 Sincronização concluída: ${processed} processadas, ${errors} erros`);

    res.status(200).json({ success: true, processed, errors, total: messages.length });

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    res.status(500).json({ error: 'Erro na sincronização', details: error.message });
  }
}

function extractEmailBody(emailData) {
  let body = '';
  const parts = emailData.payload.parts || [emailData.payload];
  
  for (const part of parts) {
    if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
      if (part.body.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
      }
    }
    if (part.parts) {
      body += extractEmailBody({ payload: { parts: part.parts } });
    }
  }
  
  body = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  return body.trim();
}