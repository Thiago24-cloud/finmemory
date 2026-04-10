import { useMemo } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Coffee,
  Fuel,
  Home,
  ShoppingBag,
  Smartphone,
  Utensils,
} from 'lucide-react';

function categoryIcon(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('restaurant') || c.includes('aliment')) return Utensils;
  if (c.includes('combust') || c.includes('fuel') || c.includes('posto')) return Fuel;
  if (c.includes('mercado') || c.includes('grocery') || c.includes('supermercado')) return ShoppingBag;
  if (c.includes('moradia') || c.includes('home') || c.includes('aluguel')) return Home;
  if (c.includes('telecom') || c.includes('internet') || c.includes('mobile')) return Smartphone;
  if (c.includes('cafe') || c.includes('coffee')) return Coffee;
  if (c.includes('banco') || c.includes('transfer')) return Building2;
  return null;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(n));
}

function formatDateLabel(isoDate) {
  if (!isoDate) return '';
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function groupByDate(transactions) {
  const map = new Map();
  for (const t of transactions || []) {
    const key = t.date || '';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  return Array.from(map.entries());
}

/**
 * Lista transações Open Finance (objetos da API summary: type, amount, description, date, category, account_name).
 */
export default function OpenFinanceTransactionList({ transactions, loading }) {
  const groups = useMemo(() => groupByDate(transactions), [transactions]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-[#e5e7eb] last:border-0">
            <div className="h-10 w-10 rounded-full bg-[#e5e7eb] animate-pulse shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 w-[75%] max-w-[240px] bg-[#e5e7eb] rounded animate-pulse" />
              <div className="h-3 w-[50%] max-w-[160px] bg-[#e5e7eb] rounded animate-pulse" />
            </div>
            <div className="h-4 w-16 bg-[#e5e7eb] rounded animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (!transactions?.length) {
    return (
      <p className="text-sm text-[#666] text-center py-6">
        Nenhuma transação do Open Finance ainda. Conecte o banco em Configurações e aguarde a sincronização.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([dateKey, items]) => (
        <section key={dateKey}>
          <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wide mb-2">
            {formatDateLabel(dateKey)}
          </h3>
          <ul className="space-y-0 divide-y divide-[#e5e7eb] rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
            {items.map((t) => {
              const isCredit = t.type === 'CREDIT';
              const Icon =
                categoryIcon(t.category) || (isCredit ? ArrowDownLeft : ArrowUpRight);
              const colorClass = isCredit ? 'text-emerald-600' : 'text-red-600';
              const bgClass = isCredit ? 'bg-emerald-50' : 'bg-red-50';

              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-3">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${bgClass}`}
                  >
                    <Icon className={`h-5 w-5 ${colorClass}`} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#333] text-sm truncate">
                      {t.description || 'Sem descrição'}
                    </p>
                    <p className="text-xs text-[#888] truncate">
                      {[t.category, t.account_name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className={`text-sm font-semibold tabular-nums shrink-0 ${colorClass}`}>
                    {isCredit ? '+' : '−'}
                    {formatMoney(t.amount)}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
