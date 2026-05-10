import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function BalanceCard({ balance, className, label, loading = false, income }) {
  const [isVisible, setIsVisible] = useState(true);
  const absBalance = Math.abs(Number(balance) || 0);
  const incomeVal = Number(income) || 0;

  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl p-5 border border-[#1E2A3A]', className)}
      style={{ background: 'linear-gradient(135deg, #0D2B1A 0%, #0A1E2E 100%)' }}
    >
      <div
        className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, #00E676 0%, transparent 70%)', opacity: 0.08, transform: 'translate(30%, -30%)' }}
      />
      <div className="flex items-start justify-between mb-3 relative">
        <p className="text-[#8899AA] text-[13px] font-medium">{label || 'Total de Gastos'}</p>
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
          aria-label={isVisible ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          {isVisible ? (
            <Eye className="h-4 w-4 text-[#8899AA]" />
          ) : (
            <EyeOff className="h-4 w-4 text-[#8899AA]" />
          )}
        </button>
      </div>

      <div className="text-[2rem] font-black text-[#F0F4FF] leading-tight relative" aria-live="polite">
        {loading ? '••••••' : isVisible ? fmt(absBalance) : '••••••'}
      </div>

      {incomeVal > 0 && (
        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-[#00E676]/10 rounded-xl px-3 py-2 border border-[#00E676]/20">
            <p className="text-[#8899AA] text-[11px] mb-0.5">Entradas</p>
            <p className="text-[#00E676] text-[14px] font-bold">
              {isVisible ? fmt(incomeVal) : '••••'}
            </p>
          </div>
          <div className="flex-1 bg-red-500/10 rounded-xl px-3 py-2 border border-red-500/20">
            <p className="text-[#8899AA] text-[11px] mb-0.5">Saídas</p>
            <p className="text-red-400 text-[14px] font-bold">
              {isVisible ? fmt(absBalance) : '••••'}
            </p>
          </div>
        </div>
      )}

      <p className="text-[#8899AA] text-[11px] mt-3 relative">
        {loading ? 'Atualizando saldos…' : 'Atualizado agora'}
      </p>
    </div>
  );
}
