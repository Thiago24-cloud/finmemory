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

    const searchQueries = buildSearchQueries({
      firstSync,
      lastSync: user.last_sync,
      now
    });

    let messages = [];
    const seenMessageIds = new Set();

    for (const query of searchQueries) {
      console.log(`🔎 Buscando com query: ${query}`);
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 50,
        includeSpamTrash: true
      });

      const batch = response.data.messages || [];
      if (batch.length === 0) {
        continue;
      }

      for (const message of batch) {
        if (!seenMessageIds.has(message.id)) {
          seenMessageIds.add(message.id);
          messages.push(message);
        }
      }

      if (messages.length >= 50) {
        break;
      }
    }
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

        const headers = emailData.data.payload?.headers || [];
        const subject = getHeader(headers, 'Subject');
        const from = getHeader(headers, 'From');
        const dateHeader = getHeader(headers, 'Date');
        const snippet = emailData.data.snippet || '';
        const messageDate = parseEmailDate(dateHeader, emailData.data.internalDate);

        const extractedBody = extractEmailBody(emailData.data);
        let emailBody = extractedBody;

        if (!emailBody || emailBody.length < 50) {
          const fallback = [subject, from, snippet].filter(Boolean).join(' ');
          if (fallback) {
            emailBody = fallback;
          }
        }

        const emailContext = buildEmailContext({
          subject,
          from,
          snippet,
          body: emailBody
        });

        if (!emailContext || emailContext.length < 10) {
          console.log(`⚠️  E-mail vazio ou muito curto, pulando...`);
          continue;
        }

        console.log(`📄 Conteúdo do e-mail preparado: ${emailContext.length} caracteres`);
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
            { role: "user", content: emailContext.substring(0, 15000) }
          ],
          temperature: 0.1
        });

        const result = completion.choices[0].message.content || '';
        console.log('✅ GPT respondeu');

        let notaFiscal;
        try {
          const jsonStr = extractJsonPayload(result);
          if (!jsonStr) {
            throw new Error('JSON não encontrado na resposta');
          }
          notaFiscal = JSON.parse(jsonStr);
        } catch (e) {
          console.error('❌ Erro ao parsear JSON:', e);
          errors++;
          continue;
        }

        const normalizedNota = normalizeNotaFiscal(notaFiscal, {
          subject,
          from,
          snippet,
          emailBody: extractedBody || emailBody,
          messageDate
        });

        if (!normalizedNota || !normalizedNota.estabelecimento || !Number.isFinite(normalizedNota.total)) {
          console.log('⚠️  Dados incompletos, pulando...');
          errors++;
          continue;
        }

        console.log('💾 Salvando no Supabase...');

        const { data: transaction, error: transError } = await supabase
          .from('transacoes')
          .insert({
            user_id: userId,
            estabelecimento: normalizedNota.estabelecimento,
            cnpj: normalizedNota.cnpj,
            endereco: normalizedNota.endereco,
            cidade: normalizedNota.cidade,
            estado: normalizedNota.estado,
            data: normalizedNota.data,
            hora: normalizedNota.hora,
            total: normalizedNota.total,
            forma_pagamento: normalizedNota.formaPagamento,
            descontos: normalizedNota.descontos ?? 0,
            subtotal: normalizedNota.subtotal ?? normalizedNota.total,
            numero_nota: normalizedNota.numeroNota,
            chave_acesso: normalizedNota.chaveAcesso,
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

        if (normalizedNota.produtos && normalizedNota.produtos.length > 0) {
          const produtosToInsert = normalizedNota.produtos.map(produto => ({
            transacao_id: transaction.id,
            codigo: produto.codigo,
            descricao: produto.descricao,
            quantidade: Number.isFinite(produto.quantidade) ? produto.quantidade : 1,
            unidade: produto.unidade,
            valor_unitario: Number.isFinite(produto.valorUnitario) ? produto.valorUnitario : 0,
            valor_total: Number.isFinite(produto.valorTotal) ? produto.valorTotal : 0
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

function buildSearchQueries({ firstSync, lastSync, now }) {
  const timeFilter = buildTimeFilter({ firstSync, lastSync, now });
  const keywords = [
    '"nota fiscal"',
    '"nota fiscal eletrônica"',
    '"nf-e"',
    '"nfc-e"',
    'nfce',
    'nfe',
    'danfe',
    '"cupom fiscal"',
    '"documento auxiliar"',
    '"chave de acesso"',
    '"documento fiscal"',
    'sefaz',
    'comprovante'
  ];
  const keywordQuery = keywords.join(' OR ');

  return [
    `(${keywordQuery}) ${timeFilter}`,
    `has:attachment filename:pdf (${keywordQuery}) ${timeFilter}`
  ];
}

function buildTimeFilter({ firstSync, lastSync, now }) {
  if (firstSync) {
    console.log('📧 Primeira sync: últimos 30 dias');
    return 'newer_than:30d';
  }

  const lastSyncDate = lastSync ? new Date(lastSync) : null;
  if (!lastSyncDate || Number.isNaN(lastSyncDate.getTime())) {
    console.log('📧 Sync sem data anterior, usando 30 dias');
    return 'newer_than:30d';
  }

  const daysSinceSync = Math.max(
    1,
    Math.ceil((now - lastSyncDate) / (1000 * 60 * 60 * 24)) + 1
  );
  console.log(`📧 Sync desde: ${daysSinceSync} dias atrás`);
  return `newer_than:${daysSinceSync}d`;
}

function extractEmailBody(emailData) {
  let body = '';
  const parts = emailData.payload?.parts || [emailData.payload];

  for (const part of parts) {
    if (part.parts) {
      body += extractEmailBody({ payload: { parts: part.parts } });
    }

    const isText = part.mimeType === 'text/plain' || part.mimeType === 'text/html';
    const isAttachment = part.filename && part.filename.length > 0;

    if (isText && !isAttachment && part.body?.data) {
      body += decodeBase64Url(part.body.data) + '\n';
    }
  }

  body = decodeQuotedPrintable(body);
  body = body.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  return body.trim();
}

function decodeBase64Url(data) {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf-8');
}

function decodeQuotedPrintable(text) {
  if (!text || !text.includes('=')) return text || '';
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function buildEmailContext({ subject, from, snippet, body }) {
  const sections = [];
  if (subject) sections.push(`Assunto: ${subject}`);
  if (from) sections.push(`Remetente: ${from}`);
  if (snippet) sections.push(`Resumo: ${snippet}`);
  if (body) sections.push(`Conteudo:\n${body}`);
  return sections.join('\n').trim();
}

function getHeader(headers, headerName) {
  if (!Array.isArray(headers)) return '';
  const header = headers.find(
    item => item.name && item.name.toLowerCase() === headerName.toLowerCase()
  );
  return header?.value || '';
}

function parseEmailDate(dateHeader, internalDate) {
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (internalDate) {
    const parsed = new Date(Number(internalDate));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function extractJsonPayload(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function normalizeNotaFiscal(notaFiscal, { subject, from, snippet, emailBody, messageDate }) {
  if (!notaFiscal || typeof notaFiscal !== 'object') return null;

  const senderName = extractSenderName(from);
  const estabelecimento =
    cleanText(notaFiscal.estabelecimento) || senderName || cleanText(subject);
  const total = parseMoney(notaFiscal.total) ?? extractTotalFromEmail(emailBody);

  return {
    estabelecimento,
    cnpj: cleanText(notaFiscal.cnpj),
    endereco: cleanText(notaFiscal.endereco),
    cidade: cleanText(notaFiscal.cidade),
    estado: cleanText(notaFiscal.estado),
    data: normalizeDate(notaFiscal.data, messageDate),
    hora: normalizeTime(notaFiscal.hora),
    total,
    formaPagamento: cleanText(notaFiscal.formaPagamento),
    descontos: parseMoney(notaFiscal.descontos),
    subtotal: parseMoney(notaFiscal.subtotal),
    numeroNota: cleanText(notaFiscal.numeroNota),
    chaveAcesso: cleanText(notaFiscal.chaveAcesso),
    produtos: normalizeProdutos(notaFiscal.produtos),
    snippet: cleanText(snippet)
  };
}

function normalizeProdutos(produtos) {
  if (!Array.isArray(produtos)) return [];
  return produtos
    .map(produto => ({
      codigo: cleanText(produto.codigo),
      descricao: cleanText(produto.descricao),
      quantidade: parseNumber(produto.quantidade),
      unidade: cleanText(produto.unidade),
      valorUnitario: parseMoney(produto.valorUnitario),
      valorTotal: parseMoney(produto.valorTotal)
    }))
    .filter(produto => produto.descricao);
}

function normalizeDate(value, fallbackDate) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatDate(new Date(value));
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    const brMatch = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }
  }
  if (fallbackDate && !Number.isNaN(fallbackDate.getTime())) {
    return formatDate(fallbackDate);
  }
  return null;
}

function normalizeTime(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/^(\d{1,2})[:h](\d{2})(?::(\d{2}))?/i);
  if (!match) return null;
  const hours = match[1].padStart(2, '0');
  const minutes = match[2];
  const seconds = match[3] ? match[3].padStart(2, '0') : '00';
  return `${hours}:${minutes}:${seconds}`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseMoney(value) {
  return parseNumber(value);
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractTotalFromEmail(body) {
  if (!body) return null;
  const patterns = [
    /valor\s+total\s*[:\-]?\s*R?\$?\s*([0-9][0-9\.,]+)/i,
    /total\s*[:\-]?\s*R?\$?\s*([0-9][0-9\.,]+)/i
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) {
      const value = parseMoney(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

function extractSenderName(fromHeader) {
  if (!fromHeader) return null;
  const match = fromHeader.match(/"?([^"<]+)"?\s*<.+>/);
  const name = match ? match[1] : fromHeader.split('<')[0];
  return cleanText(name);
}

function cleanText(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}