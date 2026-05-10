import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Card de saldo total – usa valor real calculado das transações. Botão para ocultar/mostrar.
 * label: opcional, ex. "Gasto do mês" quando filtrado por mês.
 */
export function BalanceCard({ balance, className, label, loading = false }) {
  const [isVisible, setIsVisible] = useState(true);

  const formattedBalance = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(balance);

  return (
    <div className={cn('card-lovable relative overflow-hidden', className)}>
      {/* Glow decorativo no dark mode */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5 dark:opacity-10 bg-primary pointer-events-none" style={{ transform: 'translate(30%, -30%)' }} />
      <div className="flex items-center justify-between mb-2 relative">
        <span className="text-muted-foreground text-sm">{label || 'Saldo Total'}</span>
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="p-2 rounded-full hover:bg-muted hover:text-primary transition-colors"
          aria-label={isVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          {isVisible ? (
            <Eye className="h-5 w-5 text-muted-foreground" />
          ) : (
            <EyeOff className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
      </div>
      <div className="text-[2rem] md:text-[2.25rem] font-bold text-foreground leading-tight relative" aria-live="polite">
        {loading ? '••••••' : isVisible ? formattedBalance : '••••••'}
      </div>
      <p className="text-muted-foreground text-xs mt-2">{loading ? 'Atualizando saldos…' : 'Atualizado agora'}</p>
    </div>
  );
}
