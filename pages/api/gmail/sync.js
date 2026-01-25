import { google } from 'googleapis';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Validação das variáveis de ambiente
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERRO: OPENAI_API_KEY não configurada!');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERRO: Variáveis do Supabase não configuradas!');
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || '' 
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validação de variáveis de ambiente
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ ERRO: OPENAI_API_KEY não configurada!');
    return res.status(500).json({ 
      success: false,
      error: 'Configuração do servidor incompleta (OpenAI)' 
    });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ ERRO: Variáveis do Supabase não configuradas!');
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
    let query = 'cupom fiscal OR nota fiscal OR NFC-e OR NF-e OR danfe OR comprovante de compra OR recibo';
    
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
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Você é um especialista em extrair informações de notas fiscais brasileiras. Retorne APENAS JSON válido sem markdown:
{
  "estabelecimento": "nome da loja",
  "cnpj": "CNPJ",
  "endereco": "endereço",
  "cidade": "cidade",
  "estado": "UF",
  "data": "YYYY-MM-DD",
  "hora": "HH:MM:SS",
  "total": 0.00,
  "formaPagamento": "forma",
  "produtos": [{"codigo": "cod", "descricao": "nome", "quantidade": 0, "unidade": "UN", "valorUnitario": 0.00, "valorTotal": 0.00}],
  "descontos": 0.00,
  "subtotal": 0.00,
  "numeroNota": "numero",
  "chaveAcesso": "chave"
}`
            },
            { role: "user", content: emailBody.substring(0, 15000) }
          ],
          temperature: 0.1
        });

        const result = completion.choices[0].message.content;
        console.log('✅ GPT respondeu');

        let notaFiscal;
        try {
          const jsonStr = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          notaFiscal = JSON.parse(jsonStr);
        } catch (e) {
          console.error('❌ Erro ao parsear JSON:', e);
          errors++;
          continue;
        }

        if (!notaFiscal || !notaFiscal.estabelecimento || !notaFiscal.total) {
          console.log('⚠️  Dados incompletos, pulando...');
          errors++;
          continue;
        }

        console.log('💾 Salvando no Supabase...');

        const { data: transaction, error: transError } = await supabase
          .from('transacoes')
          .insert({
            user_id: userId,
            estabelecimento: notaFiscal.estabelecimento,
            cnpj: notaFiscal.cnpj,
            endereco: notaFiscal.endereco,
            cidade: notaFiscal.cidade,
            estado: notaFiscal.estado,
            data: notaFiscal.data,
            hora: notaFiscal.hora,
            total: parseFloat(notaFiscal.total),
            forma_pagamento: notaFiscal.formaPagamento,
            descontos: parseFloat(notaFiscal.descontos || 0),
            subtotal: parseFloat(notaFiscal.subtotal || notaFiscal.total),
            numero_nota: notaFiscal.numeroNota,
            chave_acesso: notaFiscal.chaveAcesso,
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