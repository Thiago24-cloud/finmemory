import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Loader2, ListOrdered } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { getSupabase } from '../lib/supabase';

function formatListDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ListasSalvasPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [partnership, setPartnership] = useState(null);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetchLists();
  }, [userId]);

  const fetchLists = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data: memberRow } = await supabase
      .from('partnership_members')
      .select('partnership_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (!memberRow) {
      setPartnership(null);
      setLists([]);
      setLoading(false);
      return;
    }
    const { data: p } = await supabase
      .from('partnerships')
      .select('id')
      .eq('id', memberRow.partnership_id)
      .eq('status', 'active')
      .maybeSingle();
    setPartnership(p || null);
    if (p) {
      const { data: rows } = await supabase
        .from('shopping_lists')
        .select('id, total, items, created_at, created_by')
        .eq('partnership_id', p.id)
        .order('created_at', { ascending: false });
      setLists(Array.isArray(rows) ? rows : []);
    } else {
      setLists([]);
    }
    setLoading(false);
  };

  const normalizedLists = useMemo(() => {
    return lists.map((row) => ({
      ...row,
      itemsArray: Array.isArray(row.items) ? row.items : [],
    }));
  }, [lists]);

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

  if (!partnership) {
    return (
      <div className="min-h-screen bg-background p-5 pb-24">
        <div className="max-w-md mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="bg-white rounded-xl p-6 shadow-card-lovable text-center">
            <p className="text-[#666] mb-4">Precisa de uma parceria ativa para ver as listas salvas.</p>
            <Link
              href="/partnership"
              className="inline-block py-3 px-4 bg-[#2ECC49] text-white font-semibold rounded-xl hover:bg-[#22a83a]"
            >
              Ir para Parceria
            </Link>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-5 pb-24">
      <div className="max-w-md mx-auto">
        <Link href="/mapa" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Mapa
        </Link>
        <div className="flex items-center gap-2 mb-1">
          <ListOrdered className="h-6 w-6 text-[#2ECC49]" />
          <h1 className="text-xl font-bold text-[#333]">Listas salvas</h1>
        </div>
        <p className="text-sm text-[#666] mb-6">Histórico do carrinho do mapa (data, itens e total).</p>

        <div className="space-y-4">
          {normalizedLists.map((row) => (
            <article key={row.id} className="bg-white rounded-xl p-4 shadow-card-lovable border border-gray-100">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">{formatListDate(row.created_at)}</p>
                  <p className="text-lg font-bold text-[#2ECC49] tabular-nums mt-0.5">
                    R$ {Number(row.total || 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-[#333] border-t border-gray-100 pt-3">
                {row.itemsArray.length === 0 ? (
                  <li className="text-gray-500">Sem detalhe dos itens.</li>
                ) : (
                  row.itemsArray.map((it, i) => (
                    <li key={`${row.id}-${i}`} className="flex justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        {it.productName || it.name || 'Item'}
                        {it.storeLabel ? (
                          <span className="block text-xs text-gray-500">{it.storeLabel}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-600">
                        {typeof it.priceNum === 'number' ? `R$ ${it.priceNum.toFixed(2)}` : '—'}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </article>
          ))}
        </div>

        {normalizedLists.length === 0 && (
          <p className="text-center text-[#666] py-10">
            Nenhuma lista ainda. No mapa, adicione ofertas ao carrinho e toque em <strong>Salvar lista</strong>.
          </p>
        )}

        <Link
          href="/shopping-list"
          className="mt-8 block text-center text-sm text-[#2ECC49] font-medium underline"
        >
          Abrir lista de compras compartilhada
        </Link>
      </div>
      <BottomNav />
    </div>
  );
}
