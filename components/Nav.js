import Link from 'next/link';
import { cn } from '../lib/utils';

/** Classes do container dos itens – mesmo estilo dos botões inferiores (QuickActions) */
const linkBoxClasses =
  'rounded-2xl flex items-center justify-center px-4 py-2.5 transition-all shadow-card-lovable bg-white text-[#666] hover:bg-[#f8f9fa] border border-[#e5e7eb] text-sm font-medium hover:text-[#333]';

/**
 * Navegação principal – links para Privacidade, Termos e Dashboard.
 * Cada item usa o mesmo estilo visual dos botões da fileira inferior (Sincronizar, Escanear, Relatórios).
 */
export function Nav({ className }) {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'flex flex-wrap items-center justify-between gap-4 mb-3',
        className
      )}
    >
      <Link
        href="/dashboard"
        className={cn(
          linkBoxClasses,
          'text-[#333] font-semibold hover:text-[#667eea]'
        )}
      >
        FinMemory
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/privacidade" className={linkBoxClasses}>
          Privacidade
        </Link>
        <Link href="/termos" className={linkBoxClasses}>
          Termos de Uso
        </Link>
        <Link href="/mapa" className={linkBoxClasses}>
          Mapa
        </Link>
        <Link href="/dashboard" className={linkBoxClasses}>
          Dashboard
        </Link>
      </div>
    </nav>
  );
}
