import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { ArrowLeft, CreditCard, Loader2, Plus, Trash2, Calculator } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';

const CATEGORIES = [
  'Supermercado',
  'Restaurante',
  'Transporte',
  'Farmácia',
  'Combustível',
  'Vestuário',
  'Lazer',
  'Outros',
];

function formatBrl(n) {
  if (n == null || Number.isNaN(Number(n))) return 'R$ 0,00';
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/cartoes', permanent: false } };
    }
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[cartoes getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/cartoes', permanent: false } };
  }
}

export default function CartoesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(currentMonthKey);
  const [msg, setMsg] = useState('');
  const [showAddCard, setShowAddCard] = useState(false);

  const [newLabel, setNewLabel] = useState('');
  const [newLast4, setNewLast4] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newClosing, setNewClosing] = useState('');
  const [newDue, setNewDue] = useState('');
  const [savingCard, setSavingCard] = useState(false);

  const [expenseByCard, setExpenseByCard] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch(`/api/cards/manual?month=${encodeURIComponent(month)}`, {
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Erro ao carregar cartões.');
        setCards([]);
        return;
      }
      const list = Array.isArray(data.cards) ? data.cards : [];
      setCards(list);
      const next = {};
      list.forEach((c) => {
        next[c.id] = {
          valor: '',
          estabelecimento: '',
          categoria: 'Outros',
          busy: false,
        };
      });
      setExpenseByCard(next);
    } catch (e) {
      setMsg(e?.message || 'Erro de rede.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return month;
    try {
      return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } catch {
      return month;
    }
  }, [month]);

  const addCard = async (e) => {
    e.preventDefault();
    setSavingCard(true);
    setMsg('');
    try {
      const res = await fetch('/api/cards/manual', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel,
          last4: newLast4,
          credit_limit: newLimit === '' ? null : newLimit,
          closing_day: newClosing === '' ? null : newClosing,
          due_day: newDue === '' ? null : newDue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Erro ao salvar.');
        return;
      }
      setNewLabel('');
      setNewLast4('');
      setNewLimit('');
      setNewClosing('');
      setNewDue('');
      setShowAddCard(false);
      await load();
    } catch (e) {
      setMsg(e?.message || 'Erro.');
    } finally {
      setSavingCard(false);
    }
  };

  const removeCard = async (id) => {
    if (!confirm('Remover este cartão? Os gastos já lançados continuam no histórico.')) return;
    setMsg('');
    const res = await fetch(`/api/cards/manual/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || 'Erro ao remover.');
      return;
    }
    await load();
  };

  const addExpense = async (cardId) => {
    const st = expenseByCard[cardId] || { valor: '', estabelecimento: '', categoria: 'Outros' };
    const valor = String(st.valor || '').replace(',', '.').trim();
    const num = parseFloat(valor);
    if (!Number.isFinite(num) || num <= 0) {
      setMsg('Informe um valor válido.');
      return;
    }
    setExpenseByCard((prev) => ({
      ...prev,
      [cardId]: { ...st, busy: true },
    }));
    setMsg('');
    try {
      const res = await fetch('/api/transactions/manual-card', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manual_credit_card_id: cardId,
          valor: num,
          estabelecimento: st.estabelecimento || 'Compra no cartão',
          categoria: st.categoria || 'Outros',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error || 'Erro ao lançar.');
        setExpenseByCard((prev) => ({
          ...prev,
          [cardId]: { ...st, busy: false },
        }));
        return;
      }
      setExpenseByCard((prev) => ({
        ...prev,
        [cardId]: { valor: '', estabelecimento: '', categoria: st.categoria || 'Outros', busy: false },
      }));
      await load();
    } catch (e) {
      setMsg(e?.message || 'Erro.');
      setExpenseByCard((prev) => ({
        ...prev,
        [cardId]: { ...st, busy: false },
      }));
    }
  };

  if (status === 'unauthenticated') {
    router.replace('/login?callbackUrl=/cartoes');
    return null;
  }

  return (
    <>
      <Head>
        <title>FinMemory - Cartões</title>
      </Head>
      <div className="min-h-screen bg-[#f6f8f6] pb-24">
        <div className="max-w-md mx-auto px-4 pt-4">
          <div className="flex items-center justify-between mb-4">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-600 text-sm">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <Link
              href="/calculadora"
              className="inline-flex items-center gap-1 text-xs text-[#2ECC49] font-medium"
            >
              <Calculator className="h-3.5 w-3.5" /> Calculadora
            </Link>
          </div>

          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#e8f5e9] flex items-center justify-center text-[#2ECC49]">
              <CreditCard className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Cartões</h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Cadastro manual sem número completo. Compras na maquininha só entram automático com Open Finance
                (Pluggy); aqui você pode lançar na hora.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <label className="text-xs text-gray-500">Mês do resumo</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-gray-200 px-2 py-1 text-sm"
            />
            <span className="text-xs text-gray-500 capitalize truncate">{monthLabel}</span>
          </div>

          {msg ? <p className="text-sm text-red-600 mb-3">{msg}</p> : null}

          <button
            type="button"
            onClick={() => setShowAddCard((v) => !v)}
            className="w-full mb-4 flex items-center justify-center gap-2 rounded-xl py-3 border-2 border-dashed border-[#2ECC49]/35 text-[#2ECC49] font-semibold text-sm hover:bg-[#e8f5e9]/50"
          >
            <Plus className="h-5 w-5" />
            {showAddCard ? 'Fechar formulário' : 'Adicionar cartão'}
          </button>

          {showAddCard ? (
            <form onSubmit={addCard} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm mb-6">
              <p className="text-sm font-semibold text-gray-900 mb-3">Novo cartão</p>
              <input
                type="text"
                placeholder="Nome (ex.: Nubank)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full mb-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Últimos 4 dígitos (opcional)"
                value={newLast4}
                onChange={(e) => setNewLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full mb-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                inputMode="decimal"
                placeholder="Limite total (opcional)"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="w-full mb-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Dia fechamento"
                  value={newClosing}
                  onChange={(e) => setNewClosing(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Dia vencimento"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={savingCard}
                className="w-full rounded-xl py-3 bg-[#2ECC49] text-white font-semibold text-sm disabled:opacity-60"
              >
                {savingCard ? 'Salvando...' : 'Salvar cartão'}
              </button>
            </form>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#2ECC49]" />
            </div>
          ) : cards.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">
              Nenhum cartão ainda. Adicione um para acompanhar limite e lançar gastos manualmente.
            </p>
          ) : (
            <ul className="space-y-4">
              {cards.map((c) => {
                const spent = Number(c.spent_month || 0);
                const limit = c.credit_limit != null ? Number(c.credit_limit) : null;
                const pct = limit && limit > 0 ? Math.min(100, (spent / limit) * 100) : null;
                const st = expenseByCard[c.id] || { valor: '', estabelecimento: '', categoria: 'Outros', busy: false };
                return (
                  <li key={c.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">{c.label}</p>
                        <p className="text-xs text-gray-500">
                          {c.last4 ? `•••• ${c.last4}` : 'Sem últimos dígitos'}
                          {c.closing_day ? ` · Fecha dia ${c.closing_day}` : ''}
                          {c.due_day ? ` · Vence dia ${c.due_day}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCard(c.id)}
                        className="p-2 text-gray-400 hover:text-red-600"
                        aria-label="Remover cartão"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-gray-600">Gasto no mês</span>
                      <span className="font-semibold text-gray-900">{formatBrl(spent)}</span>
                    </div>
                    {limit != null && limit > 0 ? (
                      <>
                        <div className="mt-1 flex justify-between text-xs text-gray-500">
                          <span>Limite</span>
                          <span>{formatBrl(limit)}</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2ECC49] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    ) : null}

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-700 mb-2">Lançar gasto neste cartão</p>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="Valor"
                          value={st.valor}
                          onChange={(e) =>
                            setExpenseByCard((prev) => ({
                              ...prev,
                              [c.id]: { ...st, valor: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Onde (opcional)"
                          value={st.estabelecimento}
                          onChange={(e) =>
                            setExpenseByCard((prev) => ({
                              ...prev,
                              [c.id]: { ...st, estabelecimento: e.target.value },
                            }))
                          }
                          className="rounded-lg border border-gray-200 px-2 py-2 text-sm"
                        />
                      </div>
                      <select
                        value={st.categoria}
                        onChange={(e) =>
                          setExpenseByCard((prev) => ({
                            ...prev,
                            [c.id]: { ...st, categoria: e.target.value },
                          }))
                        }
                        className="w-full mb-2 rounded-lg border border-gray-200 px-2 py-2 text-sm"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={st.busy}
                        onClick={() => addExpense(c.id)}
                        className="w-full rounded-xl py-2.5 bg-[#2ECC49] text-white text-sm font-semibold disabled:opacity-60"
                      >
                        {st.busy ? 'Salvando...' : 'Registrar gasto'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-gray-500 mt-8 text-center leading-relaxed">
            Quando o Pluggy estiver em produção, as compras podem sincronizar do banco. Até lá, o lançamento
            manual mantém o mesmo nível de controle no app.
          </p>
        </div>
        <BottomNav />
      </div>
    </>
  );
}
