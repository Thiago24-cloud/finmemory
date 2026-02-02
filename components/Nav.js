import Link from 'next/link';
import { cn } from '../lib/utils';

/**
 * Navegação principal – links para Privacidade, Termos e Dashboard.
 * Estilo alinhado ao design do finmemory-import (muted-foreground, hover).
 */
export function Nav({ className }) {
  return (
    <nav
      className={cn(
        'flex justify-end items-center gap-6 mb-3',
        className
      )}
    >
      <Link
        href="/privacidade"
        className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
      >
        Privacidade
      </Link>
      <Link
        href="/termos"
        className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
      >
        Termos de Uso
      </Link>
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
      >
        Dashboard
      </Link>
    </nav>
  );
}
