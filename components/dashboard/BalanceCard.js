import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Card de saldo total – usa valor real calculado das transações. Botão para ocultar/mostrar.
 */
export function BalanceCard({ balance, className }) {
  const [isVisible, setIsVisible] = useState(true);

  const formattedBalance = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(balance);

  return (
    <div className={cn('card-nubank', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted-foreground text-sm">Saldo Total</span>
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="p-2 rounded-full hover:bg-muted hover:text-accent transition-colors"
          aria-label={isVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          {isVisible ? (
            <Eye className="h-5 w-5 text-muted-foreground" />
          ) : (
            <EyeOff className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>
      <div className="text-[2rem] md:text-[2.25rem] font-bold text-foreground leading-tight" aria-live="polite">
        {isVisible ? formattedBalance : '••••••'}
      </div>
      <p className="text-muted-foreground text-xs mt-2">Atualizado agora</p>
    </div>
  );
}
