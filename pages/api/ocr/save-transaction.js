import { createClient } from '@supabase/supabase-js';
import { geocodeAddress } from '../../../lib/geocode';

/**
 * POST /api/ocr/save-transaction
 * 
 * Salva a transação confirmada pelo usuário após revisão dos dados.
 * 
 * Body: {
 *   userId: string,
 *   date: string (YYYY-MM-DD),
 *   merchant_name: string,
 *   merchant_cnpj: string | null,
 *   total_amount: number,
 *   items: Array<{name, price}>,
 *   category: string | null,
 *   payment_method: string | null,
 *   receipt_image_url: string
 * }
 */

let supabaseInstance = null;

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ 
      success: false, 
      error: 'Configuração do servidor incompleta' 
    });
  }

  try {
    const {
      userId,
      date,
      merchant_name,
      merchant_cnpj,
      total_amount,
      items,
      category,
      payment_method,
      receipt_image_url,
      shareOnMap,
      lat: userLat,
      lng: userLng
    } = req.body;

    // Validações
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId é obrigatório' });
    }

    if (!merchant_name || merchant_name.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Nome do estabelecimento é obrigatório' });
    }

    if (!total_amount || isNaN(parseFloat(total_amount)) || parseFloat(total_amount) <= 0) {
      return res.status(400).json({ success: false, error: 'Valor total inválido' });
    }

    console.log('💾 Salvando transação de nota fiscal para:', userId);

    // Verificar se usuário existe
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    // data é NOT NULL na tabela transacoes: usa data extraída ou hoje
    const dataTransacao = (date && String(date).trim()) ? date.trim().slice(0, 10) : new Date().toISOString().slice(0, 10);

    // Preparar dados para inserção
    // Adaptado para a estrutura existente da tabela transacoes
    const transactionData = {
      user_id: userId,
      estabelecimento: merchant_name.trim(),
      cnpj: merchant_cnpj || null,
      data: dataTransacao,
      total: parseFloat(total_amount),
      forma_pagamento: payment_method || null,
      categoria: category || null,
      items: items && items.length > 0 ? items : null,
      source: 'receipt_ocr',
      receipt_image_url: receipt_image_url || null
    };

    console.log('📝 Dados a salvar:', {
      estabelecimento: transactionData.estabelecimento,
      total: transactionData.total,
      items_count: items?.length || 0
    });

    // Inserir transação
    const { data: transaction, error: insertError } = await supabase
      .from('transacoes')
      .insert(transactionData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao inserir transação:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar transação',
        details: insertError.message
      });
    }

    console.log('✅ Transação salva com sucesso:', transaction.id);

    // Inserir pontos no mapa (price_points) se o usuário optou por divulgar
    if (shareOnMap) {
    try {
      let coords = null;
      const latNum = userLat != null ? parseFloat(userLat) : NaN;
      const lngNum = userLng != null ? parseFloat(userLng) : NaN;
      if (!Number.isNaN(latNum) && !Number.isNaN(lngNum) && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
        coords = { lat: latNum, lng: lngNum };
      }
      if (!coords) {
        const geoQuery = [merchant_name.trim()].concat(
          (req.body.merchant_address && String(req.body.merchant_address).trim())
            ? [String(req.body.merchant_address).trim()]
            : []
        ).join(', ') + ', Brasil';
        coords = await geocodeAddress(geoQuery);
      }
      if (coords && coords.lat != null && coords.lng != null) {
        const pointsToInsert = [];
        if (items && items.length > 0) {
          items.forEach((item) => {
            pointsToInsert.push({
              user_id: userId,
              product_name: (item.name && String(item.name).trim()) || 'Produto',
              price: parseFloat(item.price) || 0,
              store_name: merchant_name.trim(),
              lat: coords.lat,
              lng: coords.lng,
              category: category || null
            });
          });
        } else {
          pointsToInsert.push({
            user_id: userId,
            product_name: 'Compra',
            price: parseFloat(total_amount) || 0,
            store_name: merchant_name.trim(),
            lat: coords.lat,
            lng: coords.lng,
            category: category || null
          });
        }
        const { error: mapErr } = await supabase.from('price_points').insert(pointsToInsert);
        if (mapErr) console.warn('⚠️ Erro ao inserir price_points:', mapErr.message);
        else console.log(`✅ ${pointsToInsert.length} ponto(s) adicionado(s) ao mapa`);
      } else {
        console.log('⚠️ Sem coordenadas (geolocalização negada e geocoding falhou) para:', merchant_name);
      }
    } catch (mapError) {
      console.warn('⚠️ Erro ao alimentar mapa:', mapError.message);
    }
    } else {
      console.log('ℹ️ Usuário optou por não divulgar preços no mapa');
    }

    // Salvar produtos na tabela produtos (se existir e tiver itens)
    if (items && items.length > 0) {
      try {
        const produtosToInsert = items.map(item => ({
          transacao_id: transaction.id,
          descricao: item.name,
          valor_total: parseFloat(item.price) || 0,
          quantidade: 1,
          unidade: 'UN',
          valor_unitario: parseFloat(item.price) || 0
        }));

        const { error: prodError } = await supabase
          .from('produtos')
          .insert(produtosToInsert);

        if (prodError) {
          console.warn('⚠️ Erro ao salvar produtos (não crítico):', prodError.message);
        } else {
          console.log(`✅ ${produtosToInsert.length} produtos salvos`);
        }
      } catch (produtosError) {
        console.warn('⚠️ Tabela produtos pode não existir:', produtosError.message);
      }
    }

    return res.status(200).json({
      success: true,
      transaction: {
        id: transaction.id,
        estabelecimento: transaction.estabelecimento,
        total: transaction.total,
        data: transaction.data,
        source: transaction.source
      }
    });

  } catch (error) {
    console.error('❌ Erro ao salvar transação:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao salvar transação',
      details: error.message
    });
  }
}
