'use client';

import { useState } from 'react';
import { FileSpreadsheet, FileText, Loader2, Share2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { sharePurchaseCsv, sharePurchasePdf } from '../../lib/sharePurchaseExport';

/**
 * Compartilhar compra inteira em planilha (CSV) ou PDF — Share Sheet nativo.
 */
export function PurchaseShareExport({ purchase, className, compact = false }) {
  const [busy, setBusy] = useState(null);
  const [hint, setHint] = useState(null);

  const run = async (kind) => {
    setBusy(kind);
    setHint(null);
    try {
      const result =
        kind === 'csv' ? await sharePurchaseCsv(purchase) : await sharePurchasePdf(purchase);
      if (result === 'shared') {
        setHint(kind === 'csv' ? 'Planilha enviada pelo compartilhamento do sistema.' : 'PDF enviado.');
      } else if (result === 'fallback') {
        setHint(
          kind === 'csv'
            ? 'Arquivo baixado — envie pelo app que preferir (e-mail, Drive, etc.).'
            : 'PDF baixado no aparelho.'
        );
      }
    } catch {
      setHint('Não foi possível exportar. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {!compact ? (
        <>
          <h3 className="text-sm font-bold text-foreground m-0 flex items-center gap-2">
            <Share2 className="h-4 w-4 text-primary" aria-hidden />
            Exportar compra completa
          </h3>
          <p className="text-xs text-muted-foreground m-0 leading-relaxed">
            Envie a lista de produtos e valores da nota em planilha ou PDF — ideal para prestação de contas,
            reembolso ou arquivo. Os valores vêm do que foi lido na nota fiscal.
          </p>
        </>
      ) : null}

      <div className={cn('flex flex-col gap-2', compact && 'flex-row')}>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run('csv')}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-colors',
            compact ? 'flex-1 py-2.5' : 'w-full py-3',
            'bg-primary/15 text-primary border border-primary/35 hover:bg-primary/25 disabled:opacity-50'
          )}
        >
          {busy === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          Planilha (CSV)
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run('pdf')}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-colors',
            compact ? 'flex-1 py-2.5' : 'w-full py-3',
            'bg-card text-foreground border border-border hover:bg-muted/50 disabled:opacity-50'
          )}
        >
          {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          PDF da compra
        </button>
      </div>

      {hint ? <p className="text-xs text-muted-foreground m-0">{hint}</p> : null}
    </div>
  );
}
