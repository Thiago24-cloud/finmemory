import { cn } from '../lib/cn';
import { formatBRL } from '@finmemory/shared/format';

export type PricePinProps = {
  price?: string | number | null;
  label?: string;
  onClick?: () => void;
  className?: string;
};

/** Pin customizado para o mapa (preço no marker). */
export function PricePin({ price, label, onClick, className }: PricePinProps) {
  const displayPrice =
    typeof price === 'number' ? formatBRL(price) : String(price ?? '—');

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
      {label ? <span className="text-xs font-medium opacity-90">{label}</span> : null}
      <span className="text-lg font-bold leading-tight">{displayPrice}</span>
    </div>
  );
}
