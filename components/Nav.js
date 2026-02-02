import Link from 'next/link';
import { cn } from '../lib/utils';

/**
 * Navegação principal – links para Privacidade, Termos e Dashboard.
 * Estilo alinhado ao design do finmemory-import (muted-foreground, hover).
 */
export function Nav({ className }) {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'flex justify-between items-center gap-4 mb-3',
        className
      )}
    >
      <Link
        href="/dashboard"
        className="text-[#333] font-semibold text-sm hover:text-[#667eea] transition-colors"
      >
        FinMemory
      </Link>
      <div className="flex items-center gap-4">
      <Link
        href="/privacidade"
        className="text-[#666] hover:text-[#333] text-sm font-medium transition-colors"
      >
        Privacidade
      </Link>
      <Link
        href="/termos"
        className="text-[#666] hover:text-[#333] text-sm font-medium transition-colors"
      >
        Termos de Uso
      </Link>
      <Link
        href="/dashboard"
        className="text-[#666] hover:text-[#333] text-sm font-medium transition-colors"
      >
        Dashboard
      </Link>
      </div>
    </nav>
  );
}
