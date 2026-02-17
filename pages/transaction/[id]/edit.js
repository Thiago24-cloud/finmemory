import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { getSupabase } from '../../../lib/supabase';

export default function EditTransactionPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ estabelecimento: '', total: '', data: '' });
  const [receiptImageUrl, setReceiptImageUrl] = useState(null);
  const [removingPhoto, setRemovingPhoto] = useState(false);

  const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));

  useEffect(() => {
    if (status === 'loading') return;
    if (!id) return;
    if (!userId) {
      setLoading(false);
      setError('Faça login para editar.');
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      setError('Supabase não configurado.');
      return;
    }

    let cancelled = false;

    async function fetchTransaction() {
      setLoading(true);
      setError(null);
      try {
        const { data, err } = await supabase
          .from('transacoes')
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .single();

        if (cancelled) return;
        if (err) {
          setError(err.message || 'Transação não encontrada.');
          setTransaction(null);
          return;
        }
        setTransaction(data);
        setForm({
          estabelecimento: data.estabelecimento || '',
          total: data.total != null ? String(data.total) : '',
          data: data.data ? String(data.data).slice(0, 10) : ''
        });
        setReceiptImageUrl(data.receipt_image_url || null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Erro ao carregar.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTransaction();
    return () => { cancelled = true; };
  }, [id, userId, status]);

  const handleRemovePhoto = async () => {
    if (!confirm('Remover a foto desta nota fiscal?')) return;
    if (!id || !userId) return;
    setRemovingPhoto(true);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, receipt_image_url: null })
      });
      if (res.ok) setReceiptImageUrl(null);
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!id || !userId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          estabelecimento: form.estabelecimento.trim(),
          total: form.total ? parseFloat(form.total.replace(',', '.')) : undefined,
          data: form.data.trim() || undefined
        })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Erro ao salvar.');
        return;
      }
      const targetId = transaction?.id ?? id;
      if (targetId) router.push(`/transaction/${targetId}`);
      else router.push('/dashboard');
    } catch (e) {
      setError(e.message || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#2ECC49]" />
          <p className="text-[#666]">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error && !transaction) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] p-5">
        <div className="max-w-md mx-auto">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </Link>
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-[#666]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Evita renderizar o formulário sem dados (ex.: id undefined durante transição do router)
  if (!transaction || !transaction.id) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#2ECC49]" />
          <p className="text-[#666]">Carregando...</p>
        </div>
      </div>
    );
  }

  const safeId = transaction.id;

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-5">
      <div className="max-w-md mx-auto">
        <Link href={`/transaction/${safeId}`} className="inline-flex items-center gap-2 text-[#666] hover:text-[#333] text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar à transação
        </Link>

        <h1 className="text-xl font-bold text-[#333] mb-4">Editar compra</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Estabelecimento</label>
            <input
              type="text"
              value={form.estabelecimento}
              onChange={(e) => setForm((f) => ({ ...f, estabelecimento: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Valor total (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              value={form.total}
              onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
              placeholder="0,00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#333] mb-1">Data</label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#2ECC49] focus:border-transparent"
              required
            />
          </div>

          {(typeof receiptImageUrl === 'string' && receiptImageUrl.trim()) ? (
            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-[#333] mb-2">Foto da nota fiscal</p>
              <div className="rounded-lg border border-gray-300 overflow-hidden">
                <img src={receiptImageUrl.trim()} alt="Nota fiscal" className="w-full max-h-48 object-contain bg-gray-50" />
                <div className="p-2 bg-gray-100 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={removingPhoto}
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-red-600 hover:bg-red-50 text-sm font-medium"
                  >
                    <Trash2 className="h-4 w-4" />
                    {removingPhoto ? 'Removendo...' : 'Remover foto'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 px-4 bg-[#2ECC49] text-white font-semibold rounded-xl hover:bg-[#22a83a] disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <Link
              href={`/transaction/${safeId}`}
              className="flex-1 py-3 px-4 text-center border border-gray-300 text-[#333] font-semibold rounded-xl hover:bg-gray-50"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
