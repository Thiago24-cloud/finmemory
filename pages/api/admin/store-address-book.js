import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { hasFinmemoryAdminAllowlist, isFinmemoryAdminEmail } from '../../../lib/adminAccess';
import { canAccess } from '../../../lib/access-server';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import {
  digitsOnlyCnpj,
  normalizeAddressKey,
  normalizeStoreNameKey,
} from '../../../lib/adminStoreAddressBook';

async function assertAdmin(session) {
  if (!session?.user?.email) return { ok: false, status: 401, error: 'Faça login.' };
  if (hasFinmemoryAdminAllowlist()) {
    if (!isFinmemoryAdminEmail(session.user.email)) {
      return { ok: false, status: 403, error: 'Acesso restrito ao painel operacional.' };
    }
  } else {
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { ok: false, status: 403, error: 'Sem permissão.' };
    }
  }
  return { ok: true };
}

/**
 * GET /api/admin/store-address-book?q=...&address=...&store_name=...
 * POST /api/admin/store-address-book { store_name, address, cnpj, is_franchise? }
 */
export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const gate = await assertAdmin(session);
  if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase admin não configurado.' });

  if (req.method === 'GET') {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : '';
    const storeName = typeof req.query.store_name === 'string' ? req.query.store_name.trim() : '';

    if (address.length >= 3 && storeName.length >= 2) {
      const addrNorm = normalizeAddressKey(address);
      const nameNorm = normalizeStoreNameKey(storeName);
      const { data, error } = await supabase
        .from('admin_quickadd_store_book')
        .select('store_name, address_raw, cnpj_digits, is_franchise')
        .eq('address_norm', addrNorm)
        .eq('store_name_norm', nameNorm)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ match: data || null });
    }

    if (q.length < 2) {
      return res.status(200).json({ items: [] });
    }

    const pattern = `%${q.slice(0, 120)}%`;
    const { data: byAddr, error: e1 } = await supabase
      .from('admin_quickadd_store_book')
      .select('store_name, address_raw, cnpj_digits, is_franchise, updated_at')
      .ilike('address_raw', pattern)
      .order('updated_at', { ascending: false })
      .limit(16);
    if (e1) return res.status(500).json({ error: e1.message });
    const { data: byName, error: e2 } = await supabase
      .from('admin_quickadd_store_book')
      .select('store_name, address_raw, cnpj_digits, is_franchise, updated_at')
      .ilike('store_name', pattern)
      .order('updated_at', { ascending: false })
      .limit(16);
    if (e2) return res.status(500).json({ error: e2.message });
    const seen = new Set();
    const merged = [];
    for (const row of [...(byAddr || []), ...(byName || [])]) {
      const k = `${row.cnpj_digits}|${row.address_raw}|${row.store_name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(row);
      if (merged.length >= 24) break;
    }
    merged.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    return res.status(200).json({ items: merged });
  }

  if (req.method === 'POST') {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const storeName = typeof body.store_name === 'string' ? body.store_name.trim() : '';
    const address = typeof body.address === 'string' ? body.address.trim() : '';
    const cnpjDigits = digitsOnlyCnpj(body.cnpj);
    const isFranchise = Boolean(body.is_franchise);

    if (!storeName || !address) {
      return res.status(400).json({ error: 'store_name e address são obrigatórios.' });
    }
    if (cnpjDigits.length !== 14) {
      return res.status(400).json({ error: 'CNPJ deve ter 14 dígitos para gravar no repositório.' });
    }

    const row = {
      store_name: storeName,
      store_name_norm: normalizeStoreNameKey(storeName),
      address_raw: address,
      address_norm: normalizeAddressKey(address),
      cnpj_digits: cnpjDigits,
      is_franchise: isFranchise,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('admin_quickadd_store_book').upsert(row, {
      onConflict: 'cnpj_digits,address_norm',
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
