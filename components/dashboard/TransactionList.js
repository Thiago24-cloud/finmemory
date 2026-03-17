import { useState } from 'react';
import Link from 'next/link';
import {
  Car,
  ShoppingBag,
  Utensils,
  Fuel,
  Pill,
  Smartphone,
  Shirt,
  Wrench,
  Receipt,
  Pencil,
  Trash2,
  Search,
  MapPin,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getCategoryColor } from '../../lib/colors';

const categoryIcons = {
  transporte: <Car className="h-5 w-5" />,
  uber: <Car className="h-5 w-5" />,
  supermercado: <ShoppingBag className="h-5 w-5" />,
  mercado: <ShoppingBag className="h-5 w-5" />,
  restaurante: <Utensils className="h-5 w-5" />,
  lanchonete: <Utensils className="h-5 w-5" />,
  alimentação: <Utensils className="h-5 w-5" />,
  combustível: <Fuel className="h-5 w-5" />,
  posto: <Fuel className="h-5 w-5" />,
  farmácia: <Pill className="h-5 w-5" />,
  eletrônicos: <Smartphone className="h-5 w-5" />,
  vestuário: <Shirt className="h-5 w-5" />,
  roupas: <Shirt className="h-5 w-5" />,
  serviços: <Wrench className="h-5 w-5" />,
  padaria: <Receipt className="h-5 w-5" />,
};

function getCategoryIcon(category, merchant) {
  const lowerCategory = (category || '').toLowerCase();
  const lowerMerchant = (merchant || '').toLowerCase();
  for (const [key, icon] of Object.entries(categoryIcons)) {
    if (lowerCategory.includes(key) || lowerMerchant.includes(key)) return icon;
  }
  return <Receipt className="h-5 w-5" />;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(value) {
  if (value == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/** Compra pode ser divulgada no mapa se foi feita nos últimos 7 dias. */
function canPublishToMap(transaction) {
  if (!transaction?.data) return false;
  const txDateStr = String(transaction.data).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txDateStr)) return false;
  const txDate = new Date(txDateStr + 'T12:00:00Z');
  const now = new Date();
  const diffDays = Math.floor((now - txDate) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= 7;
}

/**
 * Lista de transações – dados reais do Supabase (transacoes + produtos).
 * Editar: link para /transaction/[id]/edit. Deletar: botão com confirmação, chama onDeleted após sucesso.
 * emptyState: 'default' | 'search' – quando 'search', mostra mensagem de "nenhum resultado" em vez de "nenhuma transação ainda".
 */
export function TransactionList({ transactions, userId, onDeleted, onPublishedToMap, className, emptyState = 'default' }) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [publishedToMapIds, setPublishedToMapIds] = useState(new Set());

  const handleDelete = async (id) => {
    if (!userId || !onDeleted) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const json = await res.json();
      if (json.success) {
        setConfirmId(null);
        onDeleted();
      }
    } catch (e) {
      console.error('Erro ao deletar:', e);
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublishToMap = async (transaction) => {
    const id = transaction.id;
    if (!id || publishingId) return;
    setPublishingId(id);
    let lat = null;
    let lng = null;
    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, enableHighAccuracy: true });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch (_) {
      // Sem localização; API usará geocoding do estabelecimento
    }
    try {
      const res = await fetch(`/api/transactions/${id}/publish-to-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lat != null && lng != null ? { lat, lng } : {})
      });
      const json = await res.json();
      if (json.success) {
        setPublishedToMapIds((prev) => new Set(prev).add(id));
        if (typeof onPublishedToMap === 'function') onPublishedToMap(json.mapPointsAdded);
        alert(`Pronto! ${json.mapPointsAdded || 0} preço(s) no mapa. Abra a aba Mapa e toque em "Atualizar preços" se não aparecer.`);
      } else {
        alert(json.error || 'Não foi possível divulgar no mapa.');
      }
    } catch (e) {
      console.error('Erro ao divulgar no mapa:', e);
      alert('Erro ao divulgar no mapa. Tente de novo.');
    } finally {
      setPublishingId(null);
    }
  };

  if (!transactions || transactions.length === 0) {
    if (emptyState === 'search') {
      return (
        <div className={cn('text-center py-12', className)}>
          <Search className="h-16 w-16 mx-auto text-[#999] mb-4" />
          <h3 className="text-lg font-medium text-[#333] mb-2">Nenhum resultado</h3>
          <p className="text-sm text-[#666]">
            Nenhuma transação encontrada para sua busca. Tente outro termo.
          </p>
        </div>
      );
    }
    return (
      <div className={cn('text-center py-12', className)}>
        <ShoppingBag className="h-16 w-16 mx-auto text-[#999] mb-4" />
        <h3 className="text-lg font-medium text-[#333] mb-2">Nenhuma transação ainda</h3>
        <p className="text-sm text-[#666]">
          Sincronize seu Gmail ou escaneie uma nota fiscal
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-[#333]">Histórico</h2>
        <span className="text-sm text-[#666]">
          {transactions.length} transação(ões)
        </span>
      </div>
      <p className="text-xs text-[#666] mb-4">
        Toque em uma compra para ver <strong>preços e produtos</strong>. Compras dos últimos 7 dias podem ser divulgadas no mapa (ícone 🗺️). Ative a localização do site se pedir.
      </p>

      <div className="card-lovable overflow-hidden divide-y divide-[#e5e7eb]">
        {transactions.map((transaction) => {
          const total = Number(transaction.total) || 0;
          const isIncome = total < 0;
          const displayValue = Math.abs(total);
          const nomeLoja = (transaction.estabelecimento && String(transaction.estabelecimento).trim()) || 'Local não informado';
          const produtos = transaction.produtos || [];
          const numItens = Array.isArray(produtos) ? produtos.length : 0;

          const showConfirm = confirmId === transaction.id;
          const isDeleting = deletingId === transaction.id;

          return (
            <div key={transaction.id} className="bg-white">
              <Link href={`/transaction/${transaction.id}`} className="block active:bg-[#f8f9fa]">
                <div className="flex gap-3 p-4 sm:p-4">
                  {/* Ícone por categoria */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white flex-shrink-0"
                    style={{ backgroundColor: getCategoryColor(transaction.categoria, transaction.estabelecimento).main }}
                  >
                    {getCategoryIcon(transaction.categoria, transaction.estabelecimento)}
                  </div>

                  {/* Nome da loja em destaque + valor na mesma linha */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-[#111] text-base sm:text-lg leading-snug line-clamp-2">
                        {nomeLoja}
                      </h3>
                      <span
                        className={cn(
                          'font-bold text-base shrink-0 whitespace-nowrap',
                          isIncome ? 'text-[#16a34a]' : 'text-[#333]'
                        )}
                      >
                        {isIncome ? '+' : '−'} {formatCurrency(displayValue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-sm text-[#666]">
                        {formatDate(transaction.data)}
                      </span>
                      {numItens > 0 && (
                        <span className="text-xs text-[#2ECC49] font-medium">
                          {numItens} {numItens === 1 ? 'item' : 'itens'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>

              {/* Ações: Divulgar no mapa (24h), Editar e Excluir */}
              {userId && (
                <div className="flex items-center justify-end gap-1 px-4 pb-3 pt-0 flex-wrap">
                  {canPublishToMap(transaction) && (
                    publishedToMapIds.has(transaction.id) ? (
                      <span className="flex items-center gap-1.5 text-xs text-[#059669] px-2.5 py-1.5" title="Já divulgado no mapa">
                        <MapPin className="h-4 w-4" /> No mapa
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePublishToMap(transaction); }}
                        disabled={publishingId === transaction.id}
                        className="p-2.5 rounded-xl text-[#059669] hover:bg-[#ecfdf5] transition-colors disabled:opacity-50 flex items-center gap-1"
                        title="Divulgar preços no mapa (compras dos últimos 7 dias)"
                      >
                        {publishingId === transaction.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <>
                            <MapPin className="h-4 w-4" />
                            <span className="text-xs font-medium">Mapa</span>
                          </>
                        )}
                      </button>
                    )
                  )}
                  <Link
                    href={`/transaction/${transaction.id}/edit`}
                    className="p-2.5 rounded-xl text-[#666] hover:bg-[#e5e7eb] hover:text-[#333] transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {!showConfirm ? (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(transaction.id); }}
                      className="p-2.5 rounded-xl text-[#666] hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Excluir"
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(transaction.id); }}
                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium"
                      >
                        {isDeleting ? '...' : 'Excluir'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmId(null); }}
                        className="px-3 py-1.5 bg-gray-200 text-gray-800 rounded-lg font-medium"
                      >
                        Cancelar
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
