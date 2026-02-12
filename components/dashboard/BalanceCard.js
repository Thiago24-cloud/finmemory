import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Card de saldo total – usa valor real calculado das transações. Botão para ocultar/mostrar.
 * label: opcional, ex. "Gasto do mês" quando filtrado por mês.
 */
export function BalanceCard({ balance, className, label }) {
  const [isVisible, setIsVisible] = useState(true);

  const formattedBalance = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(balance);

  return (
    <div className={cn('card-lovable', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#666] text-sm">{label || 'Saldo Total'}</span>
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="p-2 rounded-full hover:bg-[#f8f9fa] hover:text-[#667eea] transition-colors"
          aria-label={isVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          {isVisible ? (
            <Eye className="h-5 w-5 text-[#666]" />
          ) : (
            <EyeOff className="h-5 w-5 text-[#666]" />
          )}
        </button>
      </div>
      <div className="text-[2rem] md:text-[2.25rem] font-bold text-[#333] leading-tight" aria-live="polite">
        {isVisible ? formattedBalance : '••••••'}
      </div>
      <p className="text-[#666] text-xs mt-2">Atualizado agora</p>
    </div>
  );
}
