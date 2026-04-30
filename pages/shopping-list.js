import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Check,
  Filter,
  MapPin,
  StickyNote,
  Navigation,
  Mic,
  MicOff,
} from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { getSupabase } from '../lib/supabase';
import { useMapCart } from '../components/map/MapCartContext';
import { matchShoppingListProductFromCatalog } from '../lib/shoppingListCatalogMatch';
import {
  SHOPPING_LIST_FILTER_STATUS,
  SHOPPING_LIST_FILTER_PERIOD,
  SHOPPING_LIST_FILTER_UI,
} from '../lib/appMicrocopy';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import { canUseRestrictedFeatures } from '../lib/restrictedFeatureAccess';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/shopping-list', permanent: false } };
    }
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    if (!canUseRestrictedFeatures(session.user.email)) {
      return { redirect: { destination: '/em-breve', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[shopping-list getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/shopping-list', permanent: false } };
  }
}

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

function normalizeUnit(rawUnit) {
  const u = String(rawUnit || '').toLowerCase().trim();
  if (!u) return null;
  if (['kg', 'quilo', 'quilos'].includes(u)) return 'kg';
  if (['g', 'grama', 'gramas'].includes(u)) return 'g';
  if (['l', 'lt', 'litro', 'litros'].includes(u)) return 'l';
  if (['ml', 'mililitro', 'mililitros'].includes(u)) return 'ml';
  if (['dz', 'duzia', 'dúzia'].includes(u)) return 'dz';
  if (['un', 'und', 'unidade', 'unidades'].includes(u)) return 'un';
  if (['pacote', 'pacotes'].includes(u)) return 'pct';
  if (['caixa', 'caixas'].includes(u)) return 'cx';
  return u;
}

function parseVoiceItems(rawTranscript) {
  const base = String(rawTranscript || '')
    .toLowerCase()
    .replace(/\b(eu|quero|comprar|preciso|coloca|coloque|botar|bota|adiciona|adicionar|na|no|lista|de compras|por favor)\b/g, ' ')
    .replace(/[.!?;:]/g, ',')
    .replace(/\s+e\s+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) return /** @type {Array<{name:string, quantity:number, unit:string|null}>} */ ([]);
  const parts = base.split(',').map((s) => s.trim()).filter((s) => s.length >= 2);
  const dedupe = new Set();
  const out = [];
  for (const partRaw of parts) {
    let part = partRaw;
    let quantity = 1;
    let unit = null;
    const m = part.match(/^(\d+(?:[.,]\d+)?)\s*(kg|quilo|quilos|g|grama|gramas|l|lt|litro|litros|ml|mililitro|mililitros|un|und|unidade|unidades|duzia|dúzia|dz|pacote|pacotes|caixa|caixas)?\s*(?:de\s+)?(.+)$/i);
    if (m) {
      quantity = Number(String(m[1]).replace(',', '.')) || 1;
      unit = normalizeUnit(m[2] || null);
      part = String(m[3] || '').trim();
    }
    part = part.replace(/^(de|da|do|dos|das)\s+/i, '').trim();
    if (part.length < 2) continue;
    const key = `${part}|${quantity}|${unit || ''}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    out.push({ name: part, quantity, unit });
  }
  return out;
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
  /** Compra imediata vs planeamento (semana/mês). */
  const [listBucket, setListBucket] = useState('now');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceContinuous, setVoiceContinuous] = useState(false);
  const [voicePulse, setVoicePulse] = useState(false);
  const [voiceHint, setVoiceHint] = useState('');
  const recognitionRef = useRef(null);
  const voiceBusyRef = useRef(false);
  const continuousAddedNamesRef = useRef([]);
  const { shoppingBag, shoppingBagTotals, clearSelectedProducts } = useMapCart();

  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchPartnershipAndItems();
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }
    setVoiceSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      setVoiceListening(true);
      setVoiceHint('Ouvindo... fale os itens separados por pausa ou "e".');
    };
    recognition.onerror = () => {
      setVoiceListening(false);
      setVoiceHint('Não foi possível captar o áudio. Tente novamente.');
    };
    recognition.onend = () => {
      setVoiceListening(false);
      if (voiceContinuous && recognitionRef.current && !voiceBusyRef.current) {
        try {
          recognitionRef.current.start();
        } catch (_) {
          setVoiceContinuous(false);
        }
      }
    };
    recognitionRef.current = recognition;
    return () => {
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch (_) {
        /* ignore */
      }
    };
  }, [voiceContinuous]);

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

  /** Nomes da lista “agora” para o mapa (só notas pendentes, não “para depois”). */
  const pendingNoteNamesForMap = useMemo(
    () =>
      items
        .filter(
          (i) =>
            !i.checked &&
            i.source_type !== 'map' &&
            i.shopping_intent !== 'saved_deferred'
        )
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
  const baseNoteItems = useMemo(
    () => filteredItems.filter((i) => i.source_type !== 'map'),
    [filteredItems]
  );

  const noteItemsForTab = useMemo(() => {
    if (listBucket === 'later') {
      return baseNoteItems.filter((i) => i.shopping_intent === 'saved_deferred');
    }
    return baseNoteItems.filter((i) => i.shopping_intent !== 'saved_deferred');
  }, [baseNoteItems, listBucket]);

  const noteItems = noteItemsForTab;

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
        shopping_intent: listBucket === 'later' ? 'saved_deferred' : 'plan_today',
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

  const addNamedItem = async (supabase, rawName, quantityInput = 1, unitInput = null) => {
    const name = String(rawName || '').trim();
    if (!name) return;
    const quantity = Number.isFinite(Number(quantityInput)) ? Math.max(1, Number(quantityInput)) : 1;
    const unit = unitInput ? String(unitInput).trim() : null;
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
      shopping_intent: listBucket === 'later' ? 'saved_deferred' : 'plan_today',
      quantity,
      unit,
    };
    if (catalog_product_id) row.catalog_product_id = catalog_product_id;
    if (list_thumbnail_url) row.list_thumbnail_url = list_thumbnail_url;
    await supabase.from('shopping_list_items').insert(row);
  };

  const handleVoiceAdd = async () => {
    if (!voiceSupported || !recognitionRef.current || adding || !userId || voiceBusyRef.current) return;
    setVoiceHint('');
    voiceBusyRef.current = true;
    recognitionRef.current.onresult = async (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || '';
      const parsed = parseVoiceItems(transcript);
      if (!parsed.length) {
        setVoiceHint('Não entendi os itens. Ex.: "manga, mamão e uva".');
        voiceBusyRef.current = false;
        return;
      }
      setAdding(true);
      try {
        const supabase = getSupabase();
        if (!supabase) return;
        for (const item of parsed) {
          // serial para manter o mesmo fluxo de match do catálogo
          // e evitar concorrência de inserts no mesmo estado de lista.
          // eslint-disable-next-line no-await-in-loop
          await addNamedItem(supabase, item.name, item.quantity, item.unit);
        }
        setVoiceHint(
          `Adicionado por voz: ${parsed
            .map((p) => `${p.quantity > 1 ? `${p.quantity}${p.unit ? ` ${p.unit}` : 'x'} ` : ''}${p.name}`)
            .join(', ')}.`
        );
        setNewName('');
        await fetchPartnershipAndItems();
        if (voiceContinuous) {
          continuousAddedNamesRef.current = [
            ...new Set([...continuousAddedNamesRef.current, ...parsed.map((p) => p.name)]),
          ];
        } else if (listBucket === 'now') {
          const voiced = parsed.map((p) => p.name);
          const mergedNames = [...new Set([...pendingNoteNamesForMap, ...voiced])];
          const q = mergedNames.slice(0, 12).join(',');
          router.push(q ? `/mapa?lista=${encodeURIComponent(q)}` : '/mapa');
        }
      } finally {
        setAdding(false);
        voiceBusyRef.current = false;
      }
    };
    try {
      recognitionRef.current.start();
    } catch (_) {
      setVoiceHint('Microfone indisponível no momento.');
      voiceBusyRef.current = false;
    }
  };

  const beep = useCallback((kind = 'start') => {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = kind === 'start' ? 980 : 520;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const now = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.14);
      setTimeout(() => {
        try {
          ctx.close();
        } catch (_) {
          /* ignore */
        }
      }, 240);
    } catch (_) {
      /* ignore (autoplay block / device policy) */
    }
  }, []);

  const handleToggleContinuousVoice = async () => {
    if (!voiceSupported || !recognitionRef.current || adding || !userId) return;
    if (voiceContinuous) {
      setVoiceContinuous(false);
      setVoicePulse(false);
      try {
        recognitionRef.current.stop();
      } catch (_) {
        /* ignore */
      }
      beep('stop');
      if (listBucket === 'now' && continuousAddedNamesRef.current.length > 0) {
        const mergedNames = [...new Set([...pendingNoteNamesForMap, ...continuousAddedNamesRef.current])];
        continuousAddedNamesRef.current = [];
        const q = mergedNames.slice(0, 12).join(',');
        router.push(q ? `/mapa?lista=${encodeURIComponent(q)}` : '/mapa');
      }
      setVoiceHint('Escuta contínua encerrada.');
      return;
    }
    continuousAddedNamesRef.current = [];
    setVoiceContinuous(true);
    setVoicePulse(true);
    beep('start');
    setTimeout(() => setVoicePulse(false), 260);
    setVoiceHint('Escuta contínua ativa. Fale itens em sequência. Toque em "Parar" para finalizar.');
    await handleVoiceAdd();
  };

  const handleMoveItemBucket = async (item, target) => {
    const supabase = getSupabase();
    if (!supabase || item.source_type === 'map') return;
    const nextIntent = target === 'later' ? 'saved_deferred' : 'plan_today';
    await supabase.from('shopping_list_items').update({ shopping_intent: nextIntent }).eq('id', item.id);
    fetchPartnershipAndItems();
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

  const showMapBlock = listBucket === 'now' && mapGroups.length > 0;
  const hasNotesInTab = noteItems.length > 0;

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-5 pb-24">
      <div className="max-w-md mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-3">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-xl font-bold text-[#333]">Lista</h1>
        <p className="text-xs text-gray-500 mb-3">
          Mapa com preço + lembretes.{' '}
          {partnership ? (
            <span className="text-emerald-800">Parceria ativa.</span>
          ) : (
            <Link href="/partnership" className="text-emerald-700 underline">
              Parceria (opcional)
            </Link>
          )}
        </p>

        <div className="mb-3 flex rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setListBucket('now')}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
              listBucket === 'now' ? 'bg-[#2ECC49] text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Compra agora
          </button>
          <button
            type="button"
            onClick={() => setListBucket('later')}
            className={`flex-1 rounded-lg py-2 text-xs font-bold transition-colors ${
              listBucket === 'later' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Para depois
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          {listBucket === 'now'
            ? 'O que vai comprar nesta ida à loja.'
            : 'Lista para semana ou mês — sem pressa.'}
        </p>

        <form onSubmit={handleAdd} className="mb-1 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="O que precisa?"
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-[15px] focus:ring-2 focus:ring-[#2ECC49]"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="shrink-0 rounded-xl bg-[#2ECC49] p-3 text-white hover:bg-[#22a83a] disabled:opacity-50"
            aria-label="Adicionar"
          >
            <Plus className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={handleVoiceAdd}
            disabled={!voiceSupported || voiceListening || adding || voiceContinuous}
            className="shrink-0 rounded-xl border border-gray-300 bg-white p-3 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            aria-label="Adicionar por voz"
            title={
              voiceSupported
                ? 'Adicionar itens por voz'
                : 'Reconhecimento de voz não suportado neste navegador'
            }
          >
            {voiceListening ? <MicOff className="h-6 w-6 text-red-600" /> : <Mic className="h-6 w-6" />}
          </button>
          <button
            type="button"
            onClick={handleToggleContinuousVoice}
            disabled={!voiceSupported || adding}
            className={`shrink-0 rounded-xl px-3 text-xs font-bold ${
              voiceContinuous
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            } disabled:opacity-50`}
          >
            {voiceContinuous ? 'Parar' : '🎤 contínuo'}
          </button>
        </form>
        {voicePulse ? (
          <p className="mb-2 mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-emerald-600" />
            microfone ativo
          </p>
        ) : null}
        <p className="mb-1 text-[10px] text-gray-400">Tentamos achar foto no catálogo.</p>
        <p className="mb-4 text-[10px] text-gray-400">
          Dica voz: toque no microfone e diga, por exemplo, "manga, mamão e uva".
        </p>
        {voiceHint ? <p className="mb-3 text-xs font-medium text-emerald-700">{voiceHint}</p> : null}

        {listBucket === 'now' && pendingNoteNamesForMap.length > 0 ? (
          <Link
            href={mapaListaHref}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white no-underline hover:bg-emerald-700"
          >
            <Navigation className="h-4 w-4 shrink-0" aria-hidden />
            Ver no mapa
          </Link>
        ) : null}

        {shoppingBag.length > 0 ? (
          <section className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-emerald-900">Carrinho do mapa</p>
                <p className="text-xs text-emerald-800">
                  {shoppingBagTotals.itemsCount} • {formatMoney(shoppingBagTotals.totalPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveMapBag}
                disabled={savingMapBag}
                className="rounded-lg bg-[#2ECC49] px-3 py-2 text-xs font-semibold text-white hover:bg-[#22a83a] disabled:opacity-60"
              >
                {savingMapBag ? '…' : 'Salvar'}
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

        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200"
          >
            <Filter className="h-4 w-4" />
            {SHOPPING_LIST_FILTER_UI.toggleButton}
            {(filterStatus !== 'all' || filterPeriod !== 'all') && (
              <span
                className="rounded-full bg-[#2ECC49] px-1.5 py-0.5 text-xs font-bold text-white"
                aria-hidden
              >
                {SHOPPING_LIST_FILTER_UI.filtersOnBadge}
              </span>
            )}
          </button>
          {showFilters && (
            <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200 space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500">{SHOPPING_LIST_FILTER_UI.sectionSituation}</p>
                <div className="flex flex-wrap gap-2">
                  {SHOPPING_LIST_FILTER_STATUS.map((f) => (
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
                <p className="mb-2 text-xs font-medium text-gray-500">{SHOPPING_LIST_FILTER_UI.sectionWhen}</p>
                <div className="flex flex-wrap gap-2">
                  {SHOPPING_LIST_FILTER_PERIOD.map((f) => (
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

        {(showMapBlock || hasNotesInTab) && (
          <>
            {showMapBlock ? (
              <section className="mb-8">
                <div className="mb-2 flex items-center gap-2">
                  <MapPin className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                  <h2 className="text-base font-bold text-[#333]">Do mapa</h2>
                </div>
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
            ) : null}

            {hasNotesInTab ? (
              <section className="space-y-6">
                <div className="mb-2 flex items-center gap-2">
                  <StickyNote className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                  <h2 className="text-base font-bold text-[#333]">
                    {listBucket === 'now' ? 'Esta compra' : 'Mais tarde'}
                  </h2>
                </div>
                {groupedByDay.map(({ label, items: dayItems }) => (
                  <div key={label}>
                    <h3 className="mb-2 text-sm font-semibold text-gray-500">{label}</h3>
                    <ul className="space-y-2">
                      {dayItems.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-card-lovable"
                        >
                          {item.list_thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.list_thumbnail_url}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg border border-gray-100 bg-gray-50 object-cover"
                            />
                          ) : (
                            <div className="h-12 w-12 shrink-0 rounded-lg border border-dashed border-gray-200 bg-gray-100" aria-hidden />
                          )}
                          <button
                            type="button"
                            onClick={() => toggleChecked(item)}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${item.checked ? 'border-[#28a745] bg-[#28a745] text-white' : 'border-gray-300'}`}
                          >
                            {item.checked ? <Check className="h-4 w-4" /> : null}
                          </button>
                          <span className={`min-w-0 flex-1 ${item.checked ? 'text-[#666] line-through' : 'text-[#333]'}`}>
                            <span className="font-medium">{item.name}</span>
                            {item.quantity > 1 && ` (${item.quantity}${item.unit || ''})`}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleMoveItemBucket(item, listBucket === 'now' ? 'later' : 'now')}
                            className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold text-sky-700 hover:bg-sky-50"
                          >
                            {listBucket === 'now' ? 'Depois' : 'Agora'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : null}
          </>
        )}

        {!showMapBlock && !hasNotesInTab ? (
          <p className="py-8 text-center text-sm text-gray-500">
            {items.length === 0
              ? 'Nada ainda.'
              : listBucket === 'later'
                ? 'Nada para depois.'
                : 'Nada neste filtro.'}
          </p>
        ) : null}
      </div>
      <BottomNav />
    </div>
  );
}
