import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Store, MapPin, Calendar, Loader2, Receipt, Pencil, Trash2 } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';

function formatCurrency(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function TransactionDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id || status === 'loading') return;

    const userId = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));
    if (!userId) {
      setLoading(false);
      setError('Faça login para ver os detalhes.');
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
        const { data, error: err } = await supabase
          .from('transacoes')
          .select('*, produtos (*)')
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
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Erro ao carregar.');
          setTransaction(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTransaction();
    return () => { cancelled = true; };
  }, [id, session?.user?.supabaseId, status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-background text-foreground dark">
        <div className="max-w-md mx-auto px-5 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </Link>
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
            <p className="text-muted-foreground">Carregando transação...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-background text-foreground dark">
        <div className="max-w-md mx-auto px-5 py-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </Link>
          <div className="bg-card rounded-[24px] p-6 text-center">
            <p className="text-muted-foreground">{error || 'Transação não encontrada.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const formattedDate = transaction.data ? new Date(transaction.data + 'T00:00:00').toLocaleDateString('pt-BR') : '';
  const formattedTime = transaction.hora ? transaction.hora.substring(0, 5) : null;
  const total = Number(transaction.total) || 0;
  const produtos = transaction.produtos || [];

  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [receiptImageUrl, setReceiptImageUrl] = useState(transaction.receipt_image_url || null);

  const hasReceiptImage = receiptImageUrl && receiptImageUrl.trim();

  const handleRemovePhoto = async () => {
    if (!confirm('Remover a foto desta nota fiscal? A transação continuará, apenas a imagem será desvinculada.')) return;
    const uid = session?.user?.supabaseId || (typeof window !== 'undefined' && localStorage.getItem('user_id'));
    if (!uid) return;
    setRemovingPhoto(true);
    try {
      const res = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, receipt_image_url: null })
      });
      const json = await res.json();
      if (json.success) setReceiptImageUrl(null);
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingPhoto(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <div className="max-w-md mx-auto px-5 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
          </Link>
          <Link
            href={`/transaction/${transaction.id}/edit`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-sm font-medium"
          >
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </div>

        <div className="card-nubank overflow-hidden">
          <div className="p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                <Store className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-foreground truncate">
                  {transaction.estabelecimento || 'Estabelecimento'}
                </h1>
                {transaction.endereco && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{transaction.endereco}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>{formattedDate}{formattedTime ? ` às ${formattedTime}` : ''}</span>
                </div>
                {transaction.categoria && (
                  <p className="text-sm text-muted-foreground mt-1">Categoria: {transaction.categoria}</p>
                )}
                {transaction.forma_pagamento && (
                  <p className="text-sm text-muted-foreground">Pagamento: {transaction.forma_pagamento}</p>
                )}
              </div>
            </div>

            <div className="text-2xl font-bold text-accent pt-2 border-t border-border">
              Total: {formatCurrency(total)}
            </div>
          </div>

          {hasReceiptImage && (
            <div className="border-t border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-accent" />
                Foto da nota fiscal
              </h2>
              <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                <img
                  src={receiptImageUrl}
                  alt="Nota fiscal"
                  className="w-full max-h-80 object-contain bg-white"
                />
                <div className="p-3 bg-muted/50 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={removingPhoto}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    {removingPhoto ? 'Removendo...' : 'Remover foto'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {produtos.length > 0 && (
            <div className="border-t border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-accent" />
                Produtos ({produtos.length})
              </h2>
              <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 font-semibold text-foreground">Produto</th>
                      <th className="text-center p-3 font-semibold text-foreground w-16">Qtd</th>
                      <th className="text-right p-3 font-semibold text-foreground w-24">Unit.</th>
                      <th className="text-right p-3 font-semibold text-foreground w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((produto) => (
                      <tr key={produto.id} className="border-t border-border">
                        <td className="p-3 font-medium text-foreground">{produto.descricao}</td>
                        <td className="p-3 text-center text-muted-foreground">
                          {(Number(produto.quantidade) || 0).toFixed(0)} {produto.unidade || 'UN'}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {formatCurrency(produto.valor_unitario)}
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground">
                          {formatCurrency(produto.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
