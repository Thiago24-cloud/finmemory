import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

const CATEGORIES = [
  'Supermercado', 'Farmácia', 'Posto', 'Bar/Restaurante', 'Padaria', 'Hortifruti', 'Eletrônicos', 'Outros',
];

export default function SharePricePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState('Supermercado');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [nearbyStores, setNearbyStores] = useState([]);

  // Pré-preencher loja e categoria quando vier do mapa (geo-fencing: /share-price?store=Nome&category=Supermercado)
  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query;
    if (q.store && typeof q.store === 'string') setStoreName(q.store.trim());
    if (q.category && typeof q.category === 'string') setCategory(q.category.trim());
  }, [router.isReady, router.query]);

  // Não pedir localização ao abrir: em muitos telemóveis o browser bloqueia até o utilizador tocar
  // Buscar lojas próximas quando tiver localização (tabela stores do populate-stores)
  useEffect(() => {
    if (lat == null || lng == null) {
      setNearbyStores([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/map/stores?lat=${lat}&lng=${lng}&radius=2000`)
      .then((res) => (res.ok ? res.json() : { stores: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.stores)) setNearbyStores(data.stores);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [lat, lng]);

  const getLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('O seu navegador não suporta geolocalização. Use um browser atualizado.');
      return;
    }
    setError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) {
          setError('Localização bloqueada. Ative a permissão nas definições do navegador/site e toque de novo em "Usar minha localização".');
        } else if (err.code === 3 || err.message?.includes('timeout')) {
          setError('Tempo esgotado. Verifique se o GPS está ligado e tente novamente.');
        } else {
          setError('Não foi possível obter a localização. Ative o GPS e toque em "Usar minha localização".');
        }
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!session?.user) {
      setError('Faça login para compartilhar preços.');
      return;
    }
    if (!productName.trim() || !price || !storeName.trim()) {
      setError('Preencha produto, preço e loja.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const priceNum = parseFloat(String(price).replace(',', '.')) || 0;
      const body = {
        product_name: productName.trim(),
        price: priceNum,
        store_name: storeName.trim(),
        category: category || null
      };
      if (lat != null && lng != null) {
        body.lat = lat;
        body.lng = lng;
      }
      const res = await fetch('/api/map/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar.');
        return;
      }
      router.push('/mapa?shared=1');
    } catch (err) {
      setError(err.message || 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
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
    <div className="min-h-screen bg-background p-5 pb-24">
      <div className="max-w-md mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-xl font-bold text-[#333] mb-4">Compartilhar preço</h1>
        <p className="text-sm text-[#666] mb-4">O preço aparecerá no mapa no endereço da loja (onde você comprou), não onde você está.</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-card-lovable space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Produto *</label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Leite integral 1L"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Preço (R$) *</label>
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0,00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Loja *</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex: Pão de Açúcar"
              list="nearby-stores-list"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
              required
            />
            <datalist id="nearby-stores-list">
              {nearbyStores.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.neighborhood ? `${s.name} — ${s.neighborhood}` : s.name}
                </option>
              ))}
            </datalist>
            {nearbyStores.length > 0 && (
              <p className="text-xs text-[#2ECC49] mt-1">📍 {nearbyStores.length} loja(s) próxima(s) sugerida(s). Comece a digitar ou escolha na lista.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs text-[#666] mb-2">
              O sistema usa o nome da loja para localizar no mapa. Se não encontrar, toque em &quot;Usar minha localização&quot; para ajudar.
            </p>
            <button
              type="button"
              onClick={getLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#f0f0f0] rounded-lg text-sm font-medium text-[#333] hover:bg-[#e5e5e5] disabled:opacity-60"
            >
              <MapPin className="h-4 w-4" />
              {locating ? 'A obter...' : lat != null ? 'Localização ok' : 'Usar minha localização'}
            </button>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-[#2ECC49] text-white font-semibold rounded-xl hover:bg-[#22a83a] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {submitting ? 'Enviando...' : 'Compartilhar no mapa'}
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  );
}
