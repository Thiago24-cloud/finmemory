import Link from 'next/link';
import { cn } from '../../lib/utils';

/**
 * Linha da tabela/listagem de transações.
 * Placeholder: substitua pelo componente exportado do Lovable e conecte aos dados do Supabase.
 *
 * @param {string} id - ID da transação (para link de edição)
 * @param {string} estabelecimento - Nome do estabelecimento
 * @param {string} data - Data (ex: "2026-02-10" ou formatada)
 * @param {number} total - Valor total
 * @param {React.ReactNode} [icon] - Ícone de categoria
 * @param {() => void} [onDelete] - Callback ao deletar (opcional)
 * @param {boolean} [isDeleting] - Estado de loading do delete
 * @param {string} [className]
 */
export function TransactionRow({
  id,
  estabelecimento,
  data,
  total,
  icon,
  onDelete,
  isDeleting,
  className,
}) {
  const formattedDate =
    data &&
    (data.includes('-')
      ? new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      : data);
  const formattedTotal =
    total != null
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)
      : '—';

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border border-[#e5e7eb] bg-white hover:bg-[#f8f9fa] transition-colors',
        className
      )}
    >
      {icon && <span className="text-[#2ECC49] flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <Link
          prefetch={false}
          href={`/transaction/${id}/edit`}
          className="font-medium text-[#333] hover:text-[#2ECC49] truncate block"
        >
          {estabelecimento || 'Sem nome'}
        </Link>
        <span className="text-xs text-[#666]">{formattedDate}</span>
      </div>
      <span className="font-semibold text-[#333] flex-shrink-0">{formattedTotal}</span>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className="p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
          aria-label="Excluir"
        >
          {isDeleting ? '…' : '🗑'}
        </button>
      )}
    </div>
  );
}
