import { cn } from '../../lib/utils';

/**
 * Pin customizado para o mapa (preço no marker).
 * Placeholder: substitua pelo componente exportado do Lovable.
 * Uso: criar elemento DOM com este conteúdo para Mapbox/MapLibre popup ou custom marker.
 *
 * @param {string|number} price - Valor a exibir (ex: "R$ 42,90" ou 42.9)
 * @param {string} [label] - Rótulo opcional (ex: nome do estabelecimento)
 * @param {() => void} [onClick] - Clique no pin
 * @param {string} [className]
 */
export function PricePin({ price, label, onClick, className }) {
  const displayPrice =
    typeof price === 'number'
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)
      : String(price ?? '—');

  return (
    <div
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex flex-col items-center rounded-xl bg-[#2ECC49] text-white px-3 py-2 shadow-lg border-2 border-white cursor-pointer',
        onClick && 'hover:bg-[#22a83a]',
        className
      )}
    >
      <span className="text-xs font-medium opacity-90">{label}</span>
      <span className="text-lg font-bold leading-tight">{displayPrice}</span>
    </div>
  );
}
