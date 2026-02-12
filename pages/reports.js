import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Loader2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';

function formatCurrency(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.supabaseId ?? (typeof window !== 'undefined' ? localStorage.getItem('user_id') : null);
  const [selectedMonth, setSelectedMonth] = useState(null); // 'YYYY-MM' ou null = todos

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
        .select('id, estabelecimento, total, data, categoria')
        .eq('user_id', userId)
        .order('data', { ascending: false });
      if (!cancelled) {
        setTransactions(Array.isArray(data) ? data : []);
        setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [userId, status]);

  const availableMonths = useMemo(() => {
    const set = new Set();
    transactions.forEach((t) => {
      if (t.data) {
        const d = new Date(t.data);
        if (!isNaN(d.getTime())) set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (!selectedMonth) return transactions;
    return transactions.filter((t) => {
      if (!t.data) return false;
      const d = new Date(t.data);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return ym === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const summary = useMemo(() => {
    const list = filteredTransactions;
    const total = list.reduce((s, t) => s + (Number(t.total) || 0), 0);
    const byCategory = {};
    list.forEach((t) => {
      const cat = t.categoria || 'Outros';
      byCategory[cat] = (byCategory[cat] || 0) + (Number(t.total) || 0);
    });
    const categories = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return { total, count: list.length, categories };
  }, [filteredTransactions]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground dark">
        <div className="max-w-md mx-auto px-5 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
            <p className="text-muted-foreground">Carregando relatórios...</p>
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
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>
            <p className="text-sm text-muted-foreground">Resumo das suas transações</p>
          </div>
        </div>

        {availableMonths.length > 0 && (
          <div className="mb-4">
            <label htmlFor="reports-month-filter" className="block text-sm font-medium text-foreground mb-2">
              Ver gastos por mês
            </label>
            <select
              id="reports-month-filter"
              value={selectedMonth || ''}
              onChange={(e) => setSelectedMonth(e.target.value || null)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
            >
              <option value="">Todos os meses</option>
              {availableMonths.map((ym) => {
                const [y, m] = ym.split('-');
                const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
                const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return (
                  <option key={ym} value={ym}>
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        <div className="space-y-4">
          <div className="card-nubank">
            <p className="text-muted-foreground text-sm">Total em transações</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.total)}</p>
            <p className="text-muted-foreground text-xs mt-1">{summary.count} transação(ões)</p>
          </div>

          {summary.categories.length > 0 && (
            <div className="card-nubank">
              <h2 className="text-lg font-semibold text-foreground mb-3">Por categoria</h2>
              <ul className="space-y-2">
                {summary.categories.slice(0, 10).map(({ name, value }) => (
                  <li key={name} className="flex justify-between items-center text-sm">
                    <span className="text-foreground">{name}</span>
                    <span className="font-medium text-foreground">{formatCurrency(value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.count === 0 && (
            <div className="card-nubank p-6 text-center">
              <p className="text-muted-foreground">Nenhuma transação ainda. Sincronize o Gmail ou escaneie uma nota fiscal no Dashboard.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
