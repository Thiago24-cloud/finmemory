import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';

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

  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 5000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!userId) {
      setError('Faça login para compartilhar preços.');
      return;
    }
    if (!productName.trim() || !price || !storeName.trim()) {
      setError('Preencha produto, preço e loja.');
      return;
    }
    if (lat == null || lng == null) {
      setError('Ative a localização para compartilhar no mapa.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError('Configuração indisponível.');
        setSubmitting(false);
        return;
      }

      const priceNum = parseFloat(String(price).replace(',', '.')) || 0;
      const { error: insertErr } = await supabase.from('price_points').insert({
        user_id: userId,
        product_name: productName.trim(),
        price: priceNum,
        store_name: storeName.trim(),
        lat,
        lng,
        category: category || null,
      });

      if (insertErr) throw insertErr;
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
        <Loader2 className="h-10 w-10 animate-spin text-[#667eea]" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.replace('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-5">
      <div className="max-w-md mx-auto">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-xl font-bold text-[#333] mb-4">Compartilhar preço</h1>
        <p className="text-sm text-[#666] mb-4">O preço aparecerá no mapa para a comunidade.</p>

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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea]"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea]"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#667eea]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="button"
              onClick={getLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#f0f0f0] rounded-lg text-sm font-medium text-[#333] hover:bg-[#e5e5e5] disabled:opacity-60"
            >
              <MapPin className="h-4 w-4" />
              {locating ? 'Obtendo...' : lat != null ? 'Localização ok' : 'Usar minha localização'}
            </button>
          </div>
          <button
            type="submit"
            disabled={submitting || lat == null}
            className="w-full py-3 px-4 bg-[#667eea] text-white font-semibold rounded-xl hover:bg-[#5a6fd6] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {submitting ? 'Enviando...' : 'Compartilhar no mapa'}
          </button>
        </form>
      </div>
    </div>
  );
}
