import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Trash2, Check, Filter, MapPin, StickyNote, Navigation, Bell } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import ProximityAlertsSettings from '../components/ProximityAlertsSettings';
import { getSupabase } from '../lib/supabase';
import { useMapCart } from '../components/map/MapCartContext';
import { matchShoppingListProductFromCatalog } from '../lib/shoppingListCatalogMatch';

const FILTER_STATUS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'checked', label: 'Concluídos' },
];

const FILTER_PERIOD = [
  { value: 'all', label: 'Todos os períodos' },
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
];

function itemInPeriod(item, period) {
  const d = item.created_at ? new Date(item.created_at) : null;
  if (!d || period === 'all') return true;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return d >= todayStart;
  if (period === '7d') {
    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }
  if (period === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= monthStart;
  }
  if (period === 'last_month') {
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return d >= lastMonthStart && d <= lastMonthEnd;
  }
  return true;
}

export default function ShoppingListPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [partnership, setPartnership] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [savingMapBag, setSavingMapBag] = useState(false);
  const [mapBagBanner, setMapBagBanner] = useState('');
  const [deferBusy, setDeferBusy] = useState(false);
  const { shoppingBag, shoppingBagTotals, clearSelectedProducts } = useMapCart();

  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchPartnershipAndItems();
  }, [userId]);

  const fetchPartnershipAndItems = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let activePartnership = null;
    const { data: memberRow } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (memberRow) {
      const { data: p } = await supabase
        .from('partnerships')
        .select('id')
        .eq('id', memberRow.partnership_id)
        .eq('status', 'active')
        .maybeSingle();
      if (p) activePartnership = p;
    }
    setPartnership(activePartnership);

    const { data: personal } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('owner_user_id', userId)
      .is('partnership_id', null)
      .order('created_at', { ascending: false });

    let shared = [];
    if (activePartnership) {
      const { data: s } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('partnership_id', activePartnership.id)
        .order('created_at', { ascending: false });
      shared = s || [];
    }

    const merged = [...(personal || []), ...shared];
    merged.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    setItems(merged);
    setLoading(false);
  };

  const filteredItems = useMemo(() => {
    let list = items;
    if (filterStatus === 'pending') list = list.filter((i) => !i.checked);
    if (filterStatus === 'checked') list = list.filter((i) => i.checked);
    list = list.filter((i) => itemInPeriod(i, filterPeriod));
    return list;
  }, [items, filterStatus, filterPeriod]);

  const pendingNamesForProximity = useMemo(
    () =>
      items
        .filter((i) => !i.checked)
        .map((i) => String(i.name || '').trim())
        .filter(Boolean),
    [items]
  );

  /** Anotações pendentes para abrir no mapa (planejador). */
  const pendingNoteNamesForMap = useMemo(
    () =>
      items
        .filter((i) => !i.checked && i.source_type !== 'map')
        .map((i) => String(i.name || '').trim())
        .filter(Boolean),
    [items]
  );

  const mapaListaHref = useMemo(() => {
    if (!pendingNoteNamesForMap.length) return '/mapa';
    const q = pendingNoteNamesForMap.slice(0, 12).join(',');
    return `/mapa?lista=${encodeURIComponent(q)}`;
  }, [pendingNoteNamesForMap]);

  /** Itens manuais ainda sem “comprar depois” explícito — marcamos para o fluxo de radar. */
  const deferCandidateIds = useMemo(
    () =>
      items
        .filter(
          (i) =>
            !i.checked &&
            i.source_type !== 'map' &&
            (!i.shopping_intent || i.shopping_intent === 'plan_today')
        )
        .map((i) => i.id),
    [items]
  );

  const noteItems = useMemo(
    () => filteredItems.filter((i) => i.source_type !== 'map'),
    [filteredItems]
  );

  const mapItems = useMemo(
    () => filteredItems.filter((i) => i.source_type === 'map'),
    [filteredItems]
  );

  const mapGroups = useMemo(() => {
    const byGroup = new Map();
    for (const it of mapItems) {
      const gid = it.shopping_list_group_id || `solo-${it.id}`;
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid).push(it);
    }
    return [...byGroup.entries()]
      .map(([groupId, arr]) => {
        const sorted = [...arr].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        const total = sorted.reduce((s, x) => {
          const n = typeof x.unit_price === 'number' ? x.unit_price : 0;
          return s + (Number.isFinite(n) ? n : 0);
        }, 0);
        const created = sorted[0]?.created_at;
        return { groupId, items: sorted, total, created_at: created };
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [mapItems]);

  const formatMoney = (n) =>
    typeof n === 'number' && Number.isFinite(n)
      ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '—';

  const formatShortWhen = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupedByDay = useMemo(() => {
    const groups = {};
    noteItems.forEach((item) => {
      const d = item.created_at ? new Date(item.created_at) : new Date();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      let label;
      if (d >= todayStart) label = 'Hoje';
      else if (d >= yesterdayStart) label = 'Ontem';
      else label = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    const order = ['Hoje', 'Ontem'];
    const rest = Object.keys(groups).filter((k) => !order.includes(k));
    rest.sort((a, b) => {
      const da = groups[a][0]?.created_at || '';
      const db = groups[b][0]?.created_at || '';
      return db.localeCompare(da);
    });
    return [...order.filter((k) => groups[k]), ...rest].map((label) => ({ label, items: groups[label] }));
  }, [noteItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !userId) return;
    setAdding(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      const { catalog_product_id, list_thumbnail_url } = await matchShoppingListProductFromCatalog(
        supabase,
        name
      );
      const row = {
        partnership_id: partnership?.id ?? null,
        owner_user_id: userId,
        name,
        added_by: userId,
        source_type: 'note',
        shopping_intent: 'plan_today',
      };
      if (catalog_product_id) row.catalog_product_id = catalog_product_id;
      if (list_thumbnail_url) row.list_thumbnail_url = list_thumbnail_url;
      await supabase.from('shopping_list_items').insert(row);
      setNewName('');
      await fetchPartnershipAndItems();
    } finally {
      setAdding(false);
    }
  };

  const handleMarkNotesForLater = async () => {
    if (!deferCandidateIds.length || !userId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setDeferBusy(true);
    try {
      await supabase
        .from('shopping_list_items')
        .update({ shopping_intent: 'saved_deferred' })
        .in('id', deferCandidateIds);
      await fetchPartnershipAndItems();
    } finally {
      setDeferBusy(false);
    }
  };

  const toggleChecked = async (item) => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase
      .from('shopping_list_items')
      .update({
        checked: !item.checked,
        checked_by: !item.checked ? userId : null,
        checked_at: !item.checked ? new Date().toISOString() : null,
      })
      .eq('id', item.id);
    fetchPartnershipAndItems();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este item?')) return;
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.from('shopping_list_items').delete().eq('id', id);
    fetchPartnershipAndItems();
  };

  const handleSaveMapBag = async () => {
    setMapBagBanner('');
    if (!userId) {
      setMapBagBanner('Faça login para salvar os produtos do mapa.');
      return;
    }
    if (!shoppingBag?.length) return;
    const supabase = getSupabase();
    if (!supabase) {
      setMapBagBanner('Não foi possível conectar.');
      return;
    }
    setSavingMapBag(true);
    try {
      let partnershipId = null;
      const { data: memberRow, error: e1 } = await supabase
        .from('partnership_members')
        .select('partnership_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (!e1 && memberRow) {
        const { data: p, error: e2 } = await supabase
          .from('partnerships')
          .select('id')
          .eq('id', memberRow.partnership_id)
          .eq('status', 'active')
          .maybeSingle();
        if (!e2 && p) partnershipId = p.id;
      }

      const itemsPayload = shoppingBag.map(({ offerId, id, productName, name, storeLabel, priceNum, precoLabel }) => ({
        offerId: String(offerId || id),
        productName: productName || name || 'Item',
        storeLabel,
        priceNum: typeof priceNum === 'number' && Number.isFinite(priceNum) ? priceNum : null,
        precoLabel: precoLabel || null,
      }));
      const total = itemsPayload.reduce((s, x) => s + (typeof x.priceNum === 'number' ? x.priceNum : 0), 0);

      const { data: listRow, error: insErr } = await supabase
        .from('shopping_lists')
        .insert({
          partnership_id: partnershipId,
          owner_user_id: userId,
          created_by: userId,
          total,
          items: itemsPayload,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      const groupId = listRow?.id;
      if (groupId) {
        const enriched = await Promise.all(
          shoppingBag.map(async ({ offerId, id, productName, name, storeLabel, priceNum, precoLabel }) => {
            const label = productName || name || 'Item';
            const { catalog_product_id, list_thumbnail_url } = await matchShoppingListProductFromCatalog(
              supabase,
              label
            );
            return {
              offerId,
              id,
              productName,
              name,
              storeLabel,
              priceNum,
              precoLabel,
              label,
              catalog_product_id,
              list_thumbnail_url,
            };
          })
        );
        const rows = enriched.map(
          ({ offerId, id, label, storeLabel, priceNum, precoLabel, catalog_product_id, list_thumbnail_url }) => {
            const r = {
              partnership_id: partnershipId,
              owner_user_id: userId,
              added_by: userId,
              name: label,
              quantity: 1,
              source_type: 'map',
              shopping_intent: 'map_active',
              unit_price: typeof priceNum === 'number' && Number.isFinite(priceNum) ? priceNum : null,
              price_label: precoLabel || null,
              store_label: storeLabel || null,
              map_offer_id: offerId != null ? String(offerId) : String(id),
              shopping_list_group_id: groupId,
            };
            if (catalog_product_id) r.catalog_product_id = catalog_product_id;
            if (list_thumbnail_url) r.list_thumbnail_url = list_thumbnail_url;
            return r;
          }
        );
        const { error: itemsErr } = await supabase.from('shopping_list_items').insert(rows);
        if (itemsErr) {
          await supabase.from('shopping_lists').delete().eq('id', groupId);
          throw itemsErr;
        }
      }
      clearSelectedProducts();
      setMapBagBanner('Produtos salvos na lista com sucesso.');
      await fetchPartnershipAndItems();
    } catch (e) {
      setMapBagBanner(e?.message || 'Não foi possível salvar os produtos.');
    } finally {
      setSavingMapBag(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#2ECC49]" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.replace('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-5 pb-24">
      <div className="max-w-md mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-xl font-bold text-[#333] mb-1">Lista de compras</h1>
        <p className="text-sm text-gray-500 mb-4">
          Compras planejadas no mapa (com preço) e anotações rápidas no mesmo lugar.
          {partnership ? (
            <span className="block mt-2 text-emerald-800 text-xs">
              Parceria ativa: itens novos entram na lista compartilhada com quem entrou pelo código.
            </span>
          ) : (
            <span className="block mt-2 text-xs">
              <Link href="/partnership" className="text-emerald-700 font-medium underline">
                Parceria
              </Link>{' '}
              é opcional: use para gerar um código e compartilhar a lista com outra pessoa.
            </span>
          )}
        </p>

        {shoppingBag.length > 0 ? (
          <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-emerald-900">Carrinho do mapa</p>
                <p className="text-xs text-emerald-800">
                  {shoppingBagTotals.itemsCount} itens • {formatMoney(shoppingBagTotals.totalPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveMapBag}
                disabled={savingMapBag}
                className="rounded-lg bg-[#2ECC49] px-3 py-2 text-xs font-semibold text-white hover:bg-[#22a83a] disabled:opacity-60"
              >
                {savingMapBag ? 'Salvando…' : 'Salvar produtos'}
              </button>
            </div>
            <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
              {shoppingBag.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 rounded-md bg-white/80 px-2 py-1.5 text-xs">
                  <span className="line-clamp-1 flex-1 text-gray-700">{item.productName || item.name}</span>
                  <span className="shrink-0 font-semibold text-emerald-700">
                    {typeof item.priceNum === 'number' ? formatMoney(item.priceNum) : item.precoLabel || '—'}
                  </span>
                </div>
              ))}
            </div>
            {mapBagBanner ? (
              <p className="mt-2 text-xs font-medium text-emerald-900">{mapBagBanner}</p>
            ) : null}
          </section>
        ) : null}

        {userId ? (
          <ProximityAlertsSettings userId={userId} pendingNames={pendingNamesForProximity} />
        ) : null}

        <form onSubmit={handleAdd} className="flex gap-2 mb-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="O que precisa comprar? (ex.: manga, carne…)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="p-2 bg-[#2ECC49] text-white rounded-lg hover:bg-[#22a83a] disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>
        <p className="text-[11px] text-gray-500 mb-3">
          Ao adicionar, procuramos no catálogo e no mapa uma foto para mostrar na lista.
        </p>

        {pendingNoteNamesForMap.length > 0 || deferCandidateIds.length > 0 ? (
          <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:flex-wrap">
            {pendingNoteNamesForMap.length > 0 ? (
              <Link
                href={mapaListaHref}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <Navigation className="h-4 w-4 shrink-0" aria-hidden />
                Ver no mapa (ofertas desta lista)
              </Link>
            ) : null}
            {deferCandidateIds.length > 0 ? (
              <button
                type="button"
                disabled={deferBusy}
                onClick={() => void handleMarkNotesForLater()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                <Bell className="h-4 w-4 shrink-0" aria-hidden />
                {deferBusy ? 'A gravar…' : 'Guardar para comprar depois (radar)'}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Filtros: estado (Todos / Pendentes / Concluídos) e período (por dia de uso) */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {(filterStatus !== 'all' || filterPeriod !== 'all') && (
              <span className="bg-[#2ECC49] text-white text-xs px-1.5 py-0.5 rounded-full">ativo</span>
            )}
          </button>
          {showFilters && (
            <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Estado</p>
                <div className="flex flex-wrap gap-2">
                  {FILTER_STATUS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFilterStatus(f.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterStatus === f.value ? 'bg-[#2ECC49] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Período (dia em que adicionou)</p>
                <div className="flex flex-wrap gap-2">
                  {FILTER_PERIOD.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFilterPeriod(f.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filterPeriod === f.value ? 'bg-[#2ECC49] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {filteredItems.length > 0 && (
          <>
            {/* Compras do mapa (com preço e loja) */}
            {mapGroups.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden />
                  <h2 className="text-base font-bold text-[#333]">Do mapa de preços</h2>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Itens que você salvou no carrinho do mapa — totais só somam linhas com preço numérico.
                </p>
                <div className="space-y-4">
                  {mapGroups.map(({ groupId, items: gItems, total, created_at }) => (
                    <div
                      key={String(groupId)}
                      className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white shadow-card-lovable overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-emerald-100/80 bg-emerald-50/50">
                        <span className="text-xs font-medium text-emerald-800">
                          {formatShortWhen(created_at)}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-emerald-700">
                          Total {formatMoney(total)}
                        </span>
                      </div>
                      <ul className="divide-y divide-gray-100">
                        {gItems.map((item) => {
                          const priceStr =
                            typeof item.unit_price === 'number' && Number.isFinite(item.unit_price)
                              ? formatMoney(item.unit_price)
                              : item.price_label || '—';
                          return (
                            <li
                              key={item.id}
                              className="flex items-start gap-3 p-3 bg-white/90"
                            >
                              {item.list_thumbnail_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.list_thumbnail_url}
                                  alt=""
                                  className="mt-0.5 h-11 w-11 shrink-0 rounded-lg border border-gray-100 object-cover bg-gray-50"
                                />
                              ) : null}
                              <button
                                type="button"
                                onClick={() => toggleChecked(item)}
                                className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-full border-2 flex items-center justify-center ${item.checked ? 'bg-[#28a745] border-[#28a745] text-white' : 'border-gray-300'}`}
                                aria-label={item.checked ? 'Desmarcar' : 'Marcar como comprado'}
                              >
                                {item.checked ? <Check className="h-4 w-4" /> : null}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <span
                                    className={`font-medium ${item.checked ? 'line-through text-[#666]' : 'text-[#333]'}`}
                                  >
                                    {item.name}
                                  </span>
                                  <span
                                    className={`shrink-0 text-sm tabular-nums font-semibold ${item.checked ? 'text-gray-400' : 'text-emerald-700'}`}
                                  >
                                    {priceStr}
                                  </span>
                                </div>
                                {item.store_label ? (
                                  <p className="text-xs text-gray-500 mt-0.5">{item.store_label}</p>
                                ) : null}
                                {item.shopping_intent === 'saved_deferred' ? (
                                  <p className="text-[10px] font-medium text-amber-700 mt-0.5">Comprar depois · radar</p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                                aria-label="Remover item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Anotações manuais */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 mb-1">
                <StickyNote className="h-5 w-5 text-amber-600 shrink-0" aria-hidden />
                <h2 className="text-base font-bold text-[#333]">Anotações</h2>
              </div>
              <p className="text-xs text-gray-500 -mt-1 mb-2">
                Lembretes rápidos — sem preço do mapa.
              </p>
              {noteItems.length === 0 ? (
                <p className="text-sm text-gray-400 py-1">Nenhuma anotação neste filtro.</p>
              ) : (
                groupedByDay.map(({ label, items: dayItems }) => (
                  <div key={label}>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">{label}</h3>
                    <ul className="space-y-2">
                      {dayItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-card-lovable border border-gray-100"
                        >
                          {item.list_thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.list_thumbnail_url}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg border border-gray-100 object-cover bg-gray-50"
                            />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100 border border-dashed border-gray-200" aria-hidden />
                          )}
                          <button
                            type="button"
                            onClick={() => toggleChecked(item)}
                            className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center ${item.checked ? 'bg-[#28a745] border-[#28a745] text-white' : 'border-gray-300'}`}
                          >
                            {item.checked ? <Check className="h-4 w-4" /> : null}
                          </button>
                          <span className={`flex-1 min-w-0 ${item.checked ? 'line-through text-[#666]' : 'text-[#333]'}`}>
                            <span className="font-medium">{item.name}</span>
                            {item.quantity > 1 && ` (${item.quantity}${item.unit || ''})`}
                            {item.shopping_intent === 'saved_deferred' ? (
                              <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                depois
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </section>
          </>
        )}

        {filteredItems.length === 0 && (
          <p className="text-center text-[#666] py-8">
            {items.length === 0
              ? 'Nada aqui ainda. Use o mapa para salvar ofertas com preço ou adicione anotações acima.'
              : 'Nenhum item neste filtro. Mude os filtros acima.'}
          </p>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
