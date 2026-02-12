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
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: 'userId é obrigatório' 
      });
    }
    
    console.log('🔍 Iniciando sync para usuário:', userId);

    // Buscar usuário no banco
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Erro ao buscar usuário:', userError);
      return res.status(404).json({ 
        success: false,
        error: 'Usuário não encontrado',
        details: userError.message 
      });
    }

    if (!user) {
      console.error('❌ Usuário não encontrado no banco');
      return res.status(404).json({ 
        success: false,
        error: 'Usuário não encontrado no banco de dados' 
      });
    }

    // Verificar se o usuário tem tokens
    if (!user.access_token) {
      console.error('❌ Usuário não tem access_token');
      return res.status(401).json({ 
        success: false,
        error: 'Usuário não autorizado. Por favor, faça login novamente com o Gmail.',
        requiresReauth: true
      });
    }

    const tokenExpiry = new Date(user.token_expiry);
    const now = new Date();
    
    // Renovar token se necessário
    if (tokenExpiry <= now && user.refresh_token) {
      console.log('🔄 Renovando token...');
      
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI
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
        console.log('✅ Token renovado com sucesso');
      } catch (refreshError) {
        console.error('❌ Erro ao renovar token:', refreshError);
        return res.status(401).json({ 
          success: false,
          error: 'Erro ao renovar token de acesso. Por favor, faça login novamente.',
          details: refreshError.message,
          requiresReauth: true
        });
      }
    } else if (tokenExpiry <= now && !user.refresh_token) {
      console.error('❌ Token expirado e sem refresh_token');
      return res.status(401).json({ 
        success: false,
        error: 'Sessão expirada. Por favor, faça login novamente com o Gmail.',
        requiresReauth: true
      });
    }

    // Configurar cliente Gmail
    let gmail;
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: user.access_token });
      gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Testar conexão com Gmail
      await gmail.users.getProfile({ userId: 'me' });
      console.log('✅ Conexão com Gmail verificada');
    } catch (gmailError) {
      console.error('❌ Erro ao conectar com Gmail:', gmailError);
      
      // Verificar se é erro de permissão
      const isPermissionError = gmailError.message?.includes('Insufficient Permission') || 
                                gmailError.message?.includes('insufficientPermissions') ||
                                gmailError.code === 403;
      
      if (isPermissionError) {
        return res.status(403).json({ 
          success: false,
          error: 'Permissões insuficientes para acessar o Gmail. Por favor, faça login novamente e autorize o acesso aos e-mails.',
          details: 'O app precisa de permissão para ler seus e-mails do Gmail. Revogue o acesso anterior e conecte novamente.',
          requiresReauth: true,
          errorCode: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      return res.status(401).json({ 
        success: false,
        error: 'Erro ao acessar Gmail. O token pode estar inválido. Por favor, faça login novamente.',
        details: gmailError.message,
        requiresReauth: true
      });
    }

    // Busca por termos relacionados a notas fiscais (no assunto ou corpo)
    // Inclui busca em todas as pastas (inbox, promoções, etc.)
    let query = 'in:anywhere (cupom OR fiscal OR nota OR NFC-e OR NF-e OR danfe OR comprovante OR recibo OR drogaria OR farmacia)';
    
    console.log('🔎 Query de busca:', query);
    
    let daysSinceSync;
    if (firstSync || !user.last_sync) {
      daysSinceSync = 30;
      query += ' newer_than:30d';
      console.log('📧 Primeira sync (ou sem last_sync): últimos 30 dias');
    } else {
      const lastSync = new Date(user.last_sync);
      const rawDays = Math.ceil((now - lastSync) / (1000 * 60 * 60 * 24)) + 1;
      daysSinceSync = Number.isFinite(rawDays) && rawDays > 0
        ? Math.min(Math.max(1, rawDays), 90)
        : 30;
      query += ` newer_than:${daysSinceSync}d`;
      console.log(`📧 Sync desde: ${daysSinceSync} dias atrás`);
    }

    // Buscar e-mails no Gmail
    let messages = [];
    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50
      });

      messages = response.data.messages || [];
      console.log(`📨 ${messages.length} e-mails encontrados`);
    } catch (gmailListError) {
      const errMsg = gmailListError?.message ?? String(gmailListError);
      const errCode = gmailListError?.code ?? gmailListError?.response?.status;
      console.error('❌ Erro ao listar e-mails do Gmail:', errMsg);
      console.error('   Code:', errCode, '| Query:', query);
      if (gmailListError?.stack) console.error('   Stack:', gmailListError.stack);
      
      // Verificar se é erro de permissão
      const isPermissionError = errMsg?.includes('Insufficient Permission') || 
                                errMsg?.includes('insufficientPermissions') ||
                                errCode === 403;
      
      if (isPermissionError) {
        return res.status(403).json({ 
          success: false,
          error: 'Permissões insuficientes para acessar o Gmail. Por favor, faça login novamente e autorize o acesso aos e-mails.',
          details: 'O app precisa de permissão para ler seus e-mails do Gmail. Revogue o acesso anterior e conecte novamente.',
          requiresReauth: true,
          errorCode: 'INSUFFICIENT_PERMISSIONS'
        });
      }
      
      return res.status(500).json({ 
        success: false,
        error: 'Erro ao buscar e-mails no Gmail',
        details: errMsg 
      });
    }

    let processed = 0;
    let errors = 0;
    let skipped = 0;

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

COMO ENCONTRAR O TOTAL (tente nesta ordem):
1. Linhas com "TOTAL", "Total a pagar", "Valor total", "Total geral", "Total R$"
2. Último valor em reais no final do cupom/recibo (geralmente é o total)
3. Se houver lista de produtos com valorTotal, some todos os valorTotal e use como "total"
4. Campo "subtotal" ou "total" em qualquer formato (ex: "R$ 50,99" ou 50.99)

Só use "erro" se realmente não houver nenhum valor de compra no texto. Se tiver produtos com valorTotal, sempre preencha total com a soma.`
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

          // Fallback: se GPT disse "total não encontrado" mas temos produtos com valorTotal, somar e usar como total
          if (notaFiscal?.erro && typeof notaFiscal.erro === 'string') {
            const erroLower = notaFiscal.erro.toLowerCase();
            const isTotalMissing = erroLower.includes('total') && (erroLower.includes('não encontrado') || erroLower.includes('não identificado'));
            let recovered = false;
            if (isTotalMissing && Array.isArray(notaFiscal.produtos) && notaFiscal.produtos.length > 0) {
              const soma = notaFiscal.produtos.reduce((acc, p) => {
                const v = p.valorTotal != null ? parseFloat(String(p.valorTotal).replace(/\./g, '').replace(',', '.')) : 0;
                return acc + (isNaN(v) ? 0 : v);
              }, 0);
              if (soma > 0) {
                notaFiscal.total = Math.round(soma * 100) / 100;
                delete notaFiscal.erro;
                recovered = true;
                console.log('✅ Total recuperado pela soma dos produtos:', notaFiscal.total);
              }
            }
            if (!recovered && notaFiscal.subtotal != null) {
              const sub = typeof notaFiscal.subtotal === 'string'
                ? parseFloat(notaFiscal.subtotal.replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.'))
                : parseFloat(notaFiscal.subtotal);
              if (!isNaN(sub) && sub > 0) {
                notaFiscal.total = sub;
                delete notaFiscal.erro;
                recovered = true;
                console.log('✅ Total recuperado do subtotal:', notaFiscal.total);
              }
            }
            if (notaFiscal?.erro) {
              console.log(`⏭️  GPT não conseguiu extrair dados deste e-mail: ${notaFiscal.erro}`);
              skipped++;
              continue;
            }
          }

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

        // data é NOT NULL na tabela transacoes: usa data do GPT, ou data do e-mail, ou hoje
        let dataTransacao = notaFiscal.data;
        if (!dataTransacao || (typeof dataTransacao === 'string' && dataTransacao.trim() === '')) {
          const emailDate = emailData?.data?.internalDate;
          if (emailDate) {
            const d = new Date(parseInt(emailDate, 10));
            dataTransacao = d.toISOString().slice(0, 10); // YYYY-MM-DD
          } else {
            dataTransacao = new Date().toISOString().slice(0, 10);
          }
        }
        if (typeof dataTransacao === 'object' && dataTransacao instanceof Date) {
          dataTransacao = dataTransacao.toISOString().slice(0, 10);
        } else if (typeof dataTransacao === 'string' && dataTransacao.length > 10) {
          dataTransacao = dataTransacao.slice(0, 10);
        }

        const { data: transaction, error: transError } = await supabase
          .from('transacoes')
          .insert({
            user_id: userId,
            estabelecimento: notaFiscal.estabelecimento,
            cnpj: notaFiscal.cnpj || null,
            endereco: notaFiscal.endereco || null,
            cidade: notaFiscal.cidade || null,
            estado: notaFiscal.estado || null,
            data: dataTransacao,
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

    console.log(`🎉 Sincronização concluída: ${processed} processadas, ${skipped} ignorados (GPT sem dados), ${errors} erros`);

    res.status(200).json({ success: true, processed, skipped, errors, total: messages.length });

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    console.error('   Stack:', error.stack);
    console.error('   Tipo:', error.constructor.name);
    
    // Retornar mensagem de erro mais específica
    let errorMessage = 'Erro na sincronização';
    let errorDetails = error.message;
    
    if (error.message?.includes('invalid_grant')) {
      errorMessage = 'Token de acesso inválido. Por favor, faça login novamente.';
      errorDetails = 'O token do Gmail expirou ou foi revogado.';
    } else if (error.message?.includes('insufficient_scope') || 
               error.message?.includes('Insufficient Permission') ||
               error.message?.includes('insufficientPermissions')) {
      errorMessage = 'Permissões insuficientes. Por favor, faça login novamente e autorize o acesso aos e-mails do Gmail.';
      errorDetails = 'O app precisa de permissão para ler seus e-mails. Revogue o acesso anterior em https://myaccount.google.com/permissions e conecte novamente.';
    } else if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
      errorDetails = error.message;
    }

    console.error('📤 Retornando 500:', { error: errorMessage, details: errorDetails });
    res.status(500).json({ 
      success: false,
      error: errorMessage, 
      details: errorDetails,
      requiresReauth: error.message?.includes('invalid_grant') || error.message?.includes('insufficient_scope')
    });
  }
}

function extractEmailBody(emailData) {
  let body = '';
  const parts = emailData.payload.parts || [emailData.payload];
  
  for (const part of parts) {
    if (!part) continue;
    if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
      if (part.body?.data) {
        body += Buffer.from(part.body.data, 'base64').toString('utf-8') + '\n';
      }
    }
    if (part.parts?.length) {
      body += extractEmailBody({ payload: { parts: part.parts } });
    }
  }
  
  body = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  return body.trim();
}