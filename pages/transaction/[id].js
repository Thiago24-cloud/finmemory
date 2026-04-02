import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Store, MapPin, Calendar, Loader2, Receipt, Pencil, Trash2, Share2 } from 'lucide-react';
import { getSupabase } from '../../lib/supabase';
import { buildReceiptShareText, whatsAppShareUrl } from '../../lib/buildReceiptShareText';
import { shareReceiptWithNativeSheet } from '../../lib/shareReceiptWhatsApp';

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
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [receiptImageUrl, setReceiptImageUrl] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareHint, setShareHint] = useState(null);

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
        setReceiptImageUrl(data?.receipt_image_url || null);
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

  const hasReceiptImage = receiptImageUrl && receiptImageUrl.trim();

  const openWhatsAppWithSummary = () => {
    setShareHint(null);
    const payload = { ...transaction, receipt_image_url: receiptImageUrl };
    let text = buildReceiptShareText(payload);
    if (text.length > 5500) {
      text = `${text.slice(0, 5200)}\n\n… (texto truncado — abra o app para ver tudo.)`;
    }
    const url = whatsAppShareUrl(text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const sharePhotoWithSystemSheet = async () => {
    if (!receiptImageUrl?.trim()) return;
    setShareBusy(true);
    setShareHint(null);
    const payload = { ...transaction, receipt_image_url: receiptImageUrl };
    const text = buildReceiptShareText(payload).slice(0, 3500);
    const slug = (transaction.estabelecimento || 'nota')
      .replace(/[^\w\u00C0-\u024f]+/gi, '-')
      .slice(0, 40);
    const result = await shareReceiptWithNativeSheet({
      imageUrl: receiptImageUrl,
      text,
      filename: `finmemory-${slug}`,
    });
    setShareBusy(false);
    if (!result.ok && result.reason !== 'cancelled') {
      setShareHint(
        'Não foi possível anexar a foto automaticamente. Use «Enviar resumo no WhatsApp» e, em seguida, envie a imagem da nota manualmente (ou abra a foto em tela cheia e use Compartilhar no celular).'
      );
    }
  };

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

          <div className="border-t border-border px-6 py-4 bg-muted/20">
            <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <Share2 className="h-5 w-5 text-accent" />
              Compartilhar
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Envie o resumo da compra por WhatsApp (prestação de contas, cartão da empresa, etc.). Com foto da nota, use a segunda opção no celular para anexar a imagem.
            </p>
            {shareHint && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                {shareHint}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={openWhatsAppWithSummary}
                className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold text-white bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.99] transition-colors"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.884 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                Enviar resumo no WhatsApp
              </button>
              {hasReceiptImage && (
                <button
                  type="button"
                  onClick={sharePhotoWithSystemSheet}
                  disabled={shareBusy}
                  className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold border-2 border-[#25D366] text-[#128C7E] bg-white hover:bg-green-50 disabled:opacity-60"
                >
                  {shareBusy ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Preparando…
                    </>
                  ) : (
                    <>
                      <Share2 className="h-5 w-5" />
                      Enviar foto + resumo (compartilhar do celular)
                    </>
                  )}
                </button>
              )}
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

          {/* Preços e produtos que você pagou – sempre visível */}
          <div className="border-t border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              Preços e produtos que você pagou
            </h2>
            {produtos.length > 0 ? (
              <div className="rounded-xl border border-border overflow-x-auto bg-muted/30 -mx-1 px-1">
                <table className="w-full text-sm min-w-[320px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 font-semibold text-foreground min-w-0">Produto</th>
                      <th className="text-center p-3 font-semibold text-foreground w-16 shrink-0">Qtd</th>
                      <th className="text-right p-3 font-semibold text-foreground min-w-[5rem] shrink-0">Unit.</th>
                      <th className="text-right p-3 font-semibold text-foreground min-w-[5rem] shrink-0">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos.map((produto) => (
                      <tr key={produto.id} className="border-t border-border">
                        <td className="p-3 font-medium text-foreground min-w-0 break-words">{produto.descricao}</td>
                        <td className="p-3 text-center text-muted-foreground shrink-0 whitespace-nowrap">
                          {(Number(produto.quantidade) || 0).toFixed(0)} {produto.unidade || 'UN'}
                        </td>
                        <td className="p-3 text-right text-muted-foreground shrink-0 whitespace-nowrap">
                          {formatCurrency(produto.valor_unitario)}
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground shrink-0 whitespace-nowrap">
                          {formatCurrency(produto.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Esta compra ainda não tem itens detalhados. Use <strong>Escanear Nota</strong> (botão + no app) para fotos de notas fiscais e ver preço de cada produto.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
