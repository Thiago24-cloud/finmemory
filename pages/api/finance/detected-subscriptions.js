import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { isNonExpenseBankDebit } from '../../../lib/monthExpenseTotals';
import {
  bankTransactionToPluggyLike,
  detectSubscriptions,
} from '../../../lib/finance/detectSubscriptions';
import {
  dismissSubscriptionDetections,
  getDismissedSubscriptionIds,
} from '../../../lib/subscriptionDismissals';

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function resolveUserId(session, supabase) {
  let userId = session?.user?.supabaseId;
  if (userId) return userId;
  const email = session?.user?.email;
  if (!email) return null;
  const { data } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  return data?.id || null;
}

/**
 * GET  /api/finance/detected-subscriptions?days=120
 *      Lista assinaturas detectadas (Pluggy / bank_transactions) para validação.
 *
 * POST /api/finance/detected-subscriptions
 *      body: { confirm: [{ id, ... }] } — grava em `cobrancas`
 *      body: { dismiss: ["sub_...", ...] } — ignora (não mostra de novo)
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email && !session?.user?.supabaseId) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ ok: false, error: 'Configuração incompleta' });
  }

  const userId = await resolveUserId(session, supabase);
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'Utilizador não encontrado' });
  }

  const days = Math.min(365, Math.max(30, parseInt(String(req.query?.days || '120'), 10) || 120));
  const since = isoDateDaysAgo(days);

  const { data: bankTx, error: txErr } = await supabase
    .from('bank_transactions')
    .select('id, pluggy_transaction_id, description, amount, date, category, type')
    .eq('user_id', userId)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(2500);

  if (txErr) {
    console.error('[detected-subscriptions] bank_transactions:', txErr.message);
    return res.status(500).json({ ok: false, error: 'Falha ao ler transações' });
  }

  const expenseDebits = (bankTx || []).filter((row) => !isNonExpenseBankDebit(row));
  const pluggyLike = expenseDebits.map((row) => bankTransactionToPluggyLike(row));

  const { data: cobrancas } = await supabase
    .from('cobrancas')
    .select('titulo')
    .eq('user_id', userId)
    .eq('ativa', true);

  const existingTitulos = (cobrancas || []).map((c) => c.titulo).filter(Boolean);

  let dismissedIds = new Set();
  try {
    dismissedIds = await getDismissedSubscriptionIds(supabase, userId);
  } catch (e) {
    console.warn('[detected-subscriptions] dismissals:', e?.message || e);
  }

  const detectedAll = detectSubscriptions(pluggyLike, { existingCobrancaTitulos: existingTitulos });
  const detected = detectedAll.filter((d) => !dismissedIds.has(d.id));

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      days,
      since,
      transactions_analyzed: expenseDebits.length,
      detected,
      pending: detected.filter((d) => !d.ja_cadastrada),
      already_registered: detected.filter((d) => d.ja_cadastrada),
      dismissed_count: dismissedIds.size,
    });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const dismiss = Array.isArray(body.dismiss) ? body.dismiss : [];
    if (dismiss.length) {
      try {
        const { dismissed } = await dismissSubscriptionDetections(
          supabase,
          userId,
          dismiss.map((x) => (typeof x === 'string' ? x : x?.id))
        );
        return res.status(200).json({ ok: true, dismissed_count: dismissed });
      } catch (e) {
        if (e?.code === 'MISSING_TABLE') {
          return res.status(503).json({ ok: false, error: e.message });
        }
        console.error('[detected-subscriptions] dismiss:', e?.message || e);
        return res.status(500).json({ ok: false, error: 'Falha ao ignorar assinaturas' });
      }
    }

    const confirm = Array.isArray(body.confirm) ? body.confirm : [];
    if (!confirm.length) {
      return res.status(400).json({ ok: false, error: 'Envie confirm ou dismiss' });
    }

    const byId = new Map(detectedAll.map((d) => [d.id, d]));
    const created = [];
    const skipped = [];

    for (const item of confirm) {
      const id = item?.id;
      const det = id ? byId.get(id) : null;
      if (!det) {
        skipped.push({ id, reason: 'not_found' });
        continue;
      }
      if (det.ja_cadastrada && !item.force) {
        skipped.push({ id, reason: 'already_registered' });
        continue;
      }

      const titulo = String(item.titulo || det.nome_amigavel).trim().slice(0, 200);
      const valor = Number(item.valor ?? det.valor);
      const dia = Number(item.dia_vencimento ?? det.dia_cobranca_esperado ?? 1);
      const categoria = String(item.categoria || det.categoria || 'Streaming').trim().slice(0, 80);

      if (!titulo || !Number.isFinite(valor) || valor <= 0) {
        skipped.push({ id, reason: 'invalid_fields' });
        continue;
      }

      const { data: row, error: insErr } = await supabase
        .from('cobrancas')
        .insert({
          user_id: userId,
          titulo,
          valor: Math.round(valor * 100) / 100,
          dia_vencimento: Math.min(28, Math.max(1, dia)),
          categoria,
          recorrencia: 'mensal',
          ativa: true,
        })
        .select('id, titulo, valor, dia_vencimento, categoria')
        .single();

      if (insErr) {
        skipped.push({ id, reason: insErr.message });
        continue;
      }
      created.push(row);
    }

    return res.status(200).json({
      ok: true,
      created,
      skipped,
      created_count: created.length,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}
