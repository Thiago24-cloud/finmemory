'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Calculator, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { safeEvalExpression } from '../../lib/safeExpressionEval';

/**
 * FAB + overlay de calculadora rápida (sem sair da página).
 */
export function FloatingCalculatorFab({ className }) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState('');

  const append = useCallback((ch) => {
    setExpr((prev) => `${prev}${ch}`);
  }, []);

  const clear = useCallback(() => setExpr(''), []);
  const back = useCallback(() => setExpr((prev) => prev.slice(0, -1)), []);

  const result = safeEvalExpression(expr);
  const resultLabel =
    result != null
      ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 8 }).format(result)
      : '—';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed z-[48] right-4 bottom-[5.5rem] sm:bottom-[5.75rem]',
          'h-12 w-12 rounded-2xl shadow-lg border border-border',
          'bg-card/95 backdrop-blur-md text-foreground hover:bg-muted flex items-center justify-center',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ring-offset-background',
          className
        )}
        aria-label="Abrir calculadora rápida"
      >
        <Calculator className="h-6 w-6 text-primary" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-4 bg-black/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Calculadora rápida"
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl p-4 mb-6 sm:mb-0 text-card-foreground"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold">Calculadora rápida</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-2xl bg-[#0b1220] text-white p-3 mb-3 min-h-[3.5rem] flex flex-col justify-center">
              <p className="text-xs text-white/60 m-0 mb-1">Expressão</p>
              <p className="text-sm font-mono break-all m-0 leading-snug">{expr || '0'}</p>
              <p className="text-lg font-bold text-primary m-0 mt-2 tabular-nums">{resultLabel}</p>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {['7', '8', '9', '/'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => append(k)}
                  className="py-3 rounded-xl font-semibold border border-border bg-muted text-foreground shadow-sm hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
                >
                  {k}
                </button>
              ))}
              {['4', '5', '6', '*'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => append(k)}
                  className="py-3 rounded-xl font-semibold border border-border bg-muted text-foreground shadow-sm hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
                >
                  {k}
                </button>
              ))}
              {['1', '2', '3', '-'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => append(k)}
                  className="py-3 rounded-xl font-semibold border border-border bg-muted text-foreground shadow-sm hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
                >
                  {k}
                </button>
              ))}
              {['0', '.', '(', ')'].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => append(k)}
                  className="py-3 rounded-xl font-semibold border border-border bg-muted text-foreground shadow-sm hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
                >
                  {k}
                </button>
              ))}
              <button
                type="button"
                onClick={() => append('+')}
                className="py-3 rounded-xl font-semibold border border-border bg-muted text-foreground shadow-sm hover:bg-muted/80 dark:bg-secondary dark:text-secondary-foreground dark:hover:bg-secondary/90"
              >
                +
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={back}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold bg-secondary/40 text-secondary-foreground hover:bg-secondary/60 dark:bg-muted/40 dark:text-foreground dark:hover:bg-muted/60"
              >
                Apagar
              </button>
              <button
                type="button"
                onClick={clear}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold bg-secondary/40 text-secondary-foreground hover:bg-secondary/60 dark:bg-muted/40 dark:text-foreground dark:hover:bg-muted/60"
              >
                Limpar
              </button>
            </div>
            <Link
              href="/calculadora"
              onClick={() => setOpen(false)}
              className="mt-3 block text-center text-xs font-semibold text-primary hover:underline"
            >
              Abrir calculadora completa
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
