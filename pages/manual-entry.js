import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { getSupabase } from '../lib/supabase';
import { createPricePointsFromTransaction } from '../lib/autoPricePoints';

const CATEGORIES = [
  'Supermercado', 'Restaurante', 'Transporte', 'Farmácia', 'Combustível',
  'Vestuário', 'Eletrônicos', 'Serviços', 'Padaria', 'Feira', 'Lazer', 'Outros',
];

export default function ManualEntryPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [estabelecimento, setEstabelecimento] = useState('');
  const [total, setTotal] = useState('');
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState('Outros');
  const [formaPagamento, setFormaPagamento] = useState('');
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!userId) {
      setError('Faça login para adicionar gastos.');
      return;
    }
    if (!estabelecimento.trim() || !total) {
      setError('Preencha estabelecimento e valor.');
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

      const totalNum = parseFloat(String(total).replace(',', '.')) || 0;
      const items = descricao.trim()
        ? [{ descricao: descricao.trim(), quantidade: 1, valor_total: totalNum }]
        : [{ descricao: estabelecimento.trim(), quantidade: 1, valor_total: totalNum }];

      const { error: insertErr } = await supabase.from('transacoes').insert({
        user_id: userId,
        estabelecimento: estabelecimento.trim(),
        total: totalNum,
        data: data || null,
        categoria,
        forma_pagamento: formaPagamento.trim() || null,
        source: 'manual',
        items,
      });

      if (insertErr) throw insertErr;

      await createPricePointsFromTransaction({
        userId,
        storeName: estabelecimento.trim(),
        category: categoria,
        items,
      });

      router.push('/dashboard');
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
        <h1 className="text-xl font-bold text-[#333] mb-4">Novo gasto manual</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-card-lovable space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Estabelecimento *</label>
            <input
              type="text"
              value={estabelecimento}
              onChange={(e) => setEstabelecimento(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Valor total (R$) *</label>
            <input
              type="text"
              inputMode="decimal"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0,00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Categoria</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Forma de pagamento</label>
            <input
              type="text"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              placeholder="Ex: Cartão, PIX"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Descrição do item (opcional)</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Almoço executivo"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 px-4 bg-[#2ECC49] text-white font-semibold rounded-xl hover:bg-[#22a83a] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  );
}
