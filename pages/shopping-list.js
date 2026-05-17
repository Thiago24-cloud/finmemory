import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Check,
  Filter,
  MapPin,
  Mic,
  MicOff,
} from 'lucide-react';
import { ShoppingListBottomNav } from '../components/shopping/ShoppingListBottomNav';
import { ShoppingListWeb3Main } from '../components/shopping/ShoppingListWeb3Main';
import { getSupabase } from '../lib/supabase';
import { useMapCart } from '../components/map/MapCartContext';
import { matchShoppingListProductFromCatalog } from '../lib/shoppingListCatalogMatch';
import {
  SHOPPING_LIST_FILTER_STATUS,
  SHOPPING_LIST_FILTER_PERIOD,
  SHOPPING_LIST_FILTER_UI,
} from '../lib/appMicrocopy';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';
import { canUseRestrictedFeatures } from '../lib/restrictedFeatureAccess';
import { useUserRole } from '../contexts/UserRoleContext';
import { clampShoppingQuantity } from '../lib/shoppingListQuantity';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/shopping-list', permanent: false } };
    }
    const allowed = await canAccessForSession(session);
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
  const { userRole, isRetailer } = useUserRole();
  const [partnership, setPartnership] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [newUnit, setNewUnit] = useState('un');
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

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !userId) return;
    setAdding(true);
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      const qty = clampShoppingQuantity(newQuantity, isRetailer);
      const unit = isRetailer && newUnit ? String(newUnit).trim() : null;
      await addNamedItem(supabase, name, qty, unit);
      setNewName('');
      setNewQuantity(1);
      if (isRetailer) setNewUnit('un');
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.replace('/login');
    return null;
  }

  const showMapBlock = listBucket === 'now' && mapGroups.length > 0;

  return (
    <div className="min-h-screen bg-background p-5 pb-28 font-sans antialiased text-foreground">
      <div className="mx-auto max-w-md">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <p className="mb-4 text-[11px] leading-relaxed text-muted-foreground">
          Mapa com preço + lembretes.{' '}
          {partnership ? (
            <span className="text-primary/90">Parceria ativa.</span>
          ) : (
            <Link href="/partnership" className="text-primary underline underline-offset-2">
              Parceria (opcional)
            </Link>
          )}
        </p>

        <div className="mb-4 flex rounded-2xl border border-border bg-card p-1 ring-1 ring-primary/10">
          <button
            type="button"
            onClick={() => setListBucket('now')}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
              listBucket === 'now'
                ? 'gradient-primary text-primary-foreground shadow-[0_0_20px_-6px_hsl(var(--primary)/0.5)]'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Compra agora
          </button>
          <button
            type="button"
            onClick={() => setListBucket('later')}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors ${
              listBucket === 'later' ? 'bg-amber-500/90 text-amber-950' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Para depois
          </button>
        </div>
        <p className="mb-5 text-[11px] text-muted-foreground">
          {listBucket === 'now'
            ? 'O que vai comprar nesta ida à loja.'
            : 'Lista para semana ou mês — sem pressa.'}
        </p>

        {voicePulse ? (
          <p className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            microfone ativo
          </p>
        ) : null}
        <p className="mb-1 text-[10px] text-muted-foreground">Tentamos achar foto no catálogo.</p>
        <p className="mb-5 text-[10px] text-muted-foreground">
          Dica voz: toque no microfone e diga, por exemplo, &quot;manga, mamão e uva&quot;. Enter no campo adiciona o
          item.
        </p>

        <ShoppingListWeb3Main
          title={isRetailer ? 'Reposição de estoque' : 'O que você precisa?'}
          userRole={userRole}
          newName={newName}
          setNewName={setNewName}
          newQuantity={newQuantity}
          setNewQuantity={setNewQuantity}
          newUnit={newUnit}
          setNewUnit={setNewUnit}
          onSubmit={handleAdd}
          adding={adding}
          voiceSupported={voiceSupported}
          voiceListening={voiceListening}
          voiceContinuous={voiceContinuous}
          onVoiceClick={handleVoiceAdd}
          onVoiceContinuousToggle={handleToggleContinuousVoice}
          noteItems={noteItems}
          onToggleChecked={toggleChecked}
          onDelete={handleDelete}
          mapaListaHref={mapaListaHref}
          listCount={noteItems.length}
          voiceHint={voiceHint}
          placeholder="Digite aqui..."
        />

        <div className="mt-8 h-px bg-border" aria-hidden />

        {shoppingBag.length > 0 ? (
          <section className="mb-4 rounded-2xl border border-border bg-card p-3 ring-1 ring-primary/5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-foreground">Carrinho do mapa</p>
                <p className="text-xs text-muted-foreground">
                  {shoppingBagTotals.itemsCount} • {formatMoney(shoppingBagTotals.totalPrice)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSaveMapBag}
                disabled={savingMapBag}
                className="rounded-xl px-3 py-2 text-xs font-bold text-primary-foreground gradient-primary hover:brightness-110 disabled:opacity-60"
              >
                {savingMapBag ? '…' : 'Salvar'}
              </button>
            </div>
            <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
              {shoppingBag.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-border/60 bg-background/80 px-2 py-1.5 text-xs"
                >
                  <span className="line-clamp-1 flex-1 text-muted-foreground">{item.productName || item.name}</span>
                  <span className="shrink-0 font-semibold text-primary">
                    {typeof item.priceNum === 'number' ? formatMoney(item.priceNum) : item.precoLabel || '—'}
                  </span>
                </div>
              ))}
            </div>
            {mapBagBanner ? (
              <p className="mt-2 text-xs font-medium text-primary/90">{mapBagBanner}</p>
            ) : null}
          </section>
        ) : null}

        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Filter className="h-4 w-4" />
            {SHOPPING_LIST_FILTER_UI.toggleButton}
            {(filterStatus !== 'all' || filterPeriod !== 'all') && (
              <span
                className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground"
                aria-hidden
              >
                {SHOPPING_LIST_FILTER_UI.filtersOnBadge}
              </span>
            )}
          </button>
          {showFilters && (
            <div className="mt-3 space-y-4 rounded-2xl border border-border bg-card p-4 ring-1 ring-primary/5">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {SHOPPING_LIST_FILTER_UI.sectionSituation}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SHOPPING_LIST_FILTER_STATUS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFilterStatus(f.value)}
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                        filterStatus === f.value
                          ? 'gradient-primary text-primary-foreground shadow-[0_0_16px_-6px_hsl(var(--primary)/0.45)]'
                          : 'border border-border bg-background text-muted-foreground hover:border-primary/20'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{SHOPPING_LIST_FILTER_UI.sectionWhen}</p>
                <div className="flex flex-wrap gap-2">
                  {SHOPPING_LIST_FILTER_PERIOD.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFilterPeriod(f.value)}
                      className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                        filterPeriod === f.value
                          ? 'gradient-primary text-primary-foreground shadow-[0_0_16px_-6px_hsl(var(--primary)/0.45)]'
                          : 'border border-border bg-background text-muted-foreground hover:border-primary/20'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {showMapBlock ? (
          <section className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <h2 className="text-base font-bold text-foreground">Do mapa</h2>
            </div>
            <div className="space-y-4">
              {mapGroups.map(({ groupId, items: gItems, total, created_at }) => (
                <div
                  key={String(groupId)}
                  className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-primary/5"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2.5">
                    <span className="text-xs font-medium text-muted-foreground">{formatShortWhen(created_at)}</span>
                    <span className="text-sm font-bold tabular-nums text-primary">Total {formatMoney(total)}</span>
                  </div>
                  <ul className="divide-y divide-border">
                        {gItems.map((item) => {
                          const priceStr =
                            typeof item.unit_price === 'number' && Number.isFinite(item.unit_price)
                              ? formatMoney(item.unit_price)
                              : item.price_label || '—';
                          return (
                            <li
                              key={item.id}
                              className="flex items-start gap-3 bg-background/40 p-3"
                            >
                              {item.list_thumbnail_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.list_thumbnail_url}
                                  alt=""
                                  className="mt-0.5 h-11 w-11 shrink-0 rounded-lg border border-border object-cover bg-card"
                                />
                              ) : null}
                              <button
                                type="button"
                                onClick={() => toggleChecked(item)}
                                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                                  item.checked
                                    ? 'border-primary bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.45)]'
                                    : 'border-muted-foreground/50 bg-transparent'
                                }`}
                                aria-label={item.checked ? 'Desmarcar' : 'Marcar como comprado'}
                              >
                                {item.checked ? <Check className="h-4 w-4" /> : null}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <span
                                    className={`font-medium ${item.checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                                  >
                                    {item.name}
                                  </span>
                                  <span
                                    className={`shrink-0 text-sm font-semibold tabular-nums ${item.checked ? 'text-muted-foreground' : 'text-primary'}`}
                                  >
                                    {priceStr}
                                  </span>
                                </div>
                                {item.store_label ? (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{item.store_label}</p>
                                ) : null}
                                {item.shopping_intent === 'saved_deferred' ? (
                                  <p className="mt-0.5 text-[10px] font-medium text-amber-400/90">
                                    Comprar depois · radar
                                  </p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="shrink-0 rounded-xl p-2 text-rose-400/90 transition hover:bg-rose-500/10 hover:text-rose-300"
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

        {items.length > 0 && noteItems.length === 0 && !showMapBlock ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {listBucket === 'later' ? 'Nada para depois neste filtro.' : 'Nada neste filtro.'}
          </p>
        ) : null}
      </div>
      <ShoppingListBottomNav mapHref={mapaListaHref} />
    </div>
  );
}
