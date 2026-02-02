import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Tags, Loader2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';

function formatCurrency(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function CategoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.supabaseId ?? (typeof window !== 'undefined' ? localStorage.getItem('user_id') : null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/dashboard');
  }, [status, router]);

  useEffect(() => {
    if (status === 'loading' || !userId) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      const { data } = await supabase
        .from('transacoes')
        .select('id, estabelecimento, total, categoria')
        .eq('user_id', userId);
      if (!cancelled) {
        setTransactions(Array.isArray(data) ? data : []);
        setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [userId, status]);

  const byCategory = useMemo(() => {
    const map = {};
    transactions.forEach((t) => {
      const cat = t.categoria || 'Sem categoria';
      if (!map[cat]) map[cat] = { total: 0, count: 0 };
      map[cat].total += Number(t.total) || 0;
      map[cat].count += 1;
    });
    return Object.entries(map)
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground dark">
        <div className="max-w-md mx-auto px-5 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
            <p className="text-muted-foreground">Carregando categorias...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="max-w-md mx-auto px-5 py-6 pb-24">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Tags className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Categorias</h1>
            <p className="text-sm text-muted-foreground">Gastos por categoria</p>
          </div>
        </div>

        {byCategory.length > 0 ? (
          <div className="card-nubank overflow-hidden">
            <ul className="divide-y divide-border">
              {byCategory.map(({ name, total, count }) => (
                <li key={name} className="flex justify-between items-center p-4 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{count} transação(ões)</p>
                  </div>
                  <p className="font-bold text-accent">{formatCurrency(total)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card-nubank p-6 text-center">
            <p className="text-muted-foreground">Nenhuma categoria ainda. Sincronize ou escaneie notas no Dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
