'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/Sheet';
import { cn } from '../../lib/utils';

const fmt = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

const confidenceLabel = {
  alta: 'Alta confiança',
  media: 'Recorrente',
  baixa: 'Possível',
};

/**
 * Assinaturas detectadas via Pluggy — validação antes de gravar em `cobrancas`.
 */
export default function DetectedSubscriptionsPanel({ userId, onConfirmed }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detected, setDetected] = useState([]);
  const [selected, setSelected] = useState(new Set());

  const pending = useMemo(
    () => detected.filter((d) => !d.ja_cadastrada),
    [detected]
  );

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/finance/detected-subscriptions?days=120', {
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'Falha ao analisar');
      const list = json.pending ?? json.detected ?? [];
      setDetected(list);
      setSelected(new Set(list.map((d) => d.id)));
    } catch (e) {
      toast.error(e?.message || 'Não foi possível detectar assinaturas');
      setDetected([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmSelected = async () => {
    const ids = [...selected];
    if (!ids.length) {
      toast.message('Selecione pelo menos uma assinatura');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/finance/detected-subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: ids.map((id) => ({ id })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'Falha ao guardar');
      const n = json.created_count ?? 0;
      toast.success(n ? `${n} cobrança(s) adicionada(s)` : 'Nenhuma cobrança nova');
      setOpen(false);
      await load();
      onConfirmed?.();
    } catch (e) {
      toast.error(e?.message || 'Erro ao confirmar');
    } finally {
      setSaving(false);
    }
  };

  if (!userId) return null;

  const showBanner = pending.length > 0;

  return (
    <>
      {showBanner && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full mb-3 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/80 to-indigo-950/60 p-4 text-left shadow-[0_0_24px_rgba(139,92,246,0.12)] transition hover:border-violet-400/50"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-violet-300" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {pending.length} assinatura{pending.length === 1 ? '' : 's'} detectada
                {pending.length === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Netflix, Spotify e similares no seu cartão — confirme antes de salvar nas cobranças.
              </p>
            </div>
            <span className="text-xs font-medium text-violet-300 shrink-0">Revisar</span>
          </div>
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-2xl border-t border-violet-500/20">
          <SheetHeader className="text-left pb-2">
            <SheetTitle className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              Assinaturas detectadas
            </SheetTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Com base nas transações Pluggy (Open Finance). Marque as que quer acompanhar como cobrança
              mensal.
            </p>
          </SheetHeader>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Analisando transações…
            </div>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma assinatura nova para confirmar. Sincronize o banco ou volte mais tarde.
            </p>
          ) : (
            <ul className="space-y-2 overflow-y-auto max-h-[50vh] pr-1 pb-4">
              {pending.map((d) => {
                const on = selected.has(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => toggle(d.id)}
                      className={cn(
                        'w-full rounded-xl border p-3 text-left transition',
                        on
                          ? 'border-violet-500/50 bg-violet-500/10'
                          : 'border-[#1E2A3A] bg-card/80 opacity-80'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{d.nome_amigavel}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {d.descricao_original}
                          </p>
                          <p className="text-[10px] text-violet-300/90 mt-1">
                            {confidenceLabel[d.confianca] || d.confianca}
                            {d.dia_cobranca_esperado != null
                              ? ` · dia ${d.dia_cobranca_esperado}`
                              : ''}
                            {d.repeticoes_meses > 1 ? ` · ${d.repeticoes_meses} meses` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-foreground">{fmt(d.valor)}</p>
                          {on ? (
                            <CheckCircle2 className="h-4 w-4 text-violet-400 ml-auto mt-1" />
                          ) : (
                            <span className="inline-block w-4 h-4 rounded-full border border-zinc-600 mt-1 ml-auto" />
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex gap-2 pt-2 border-t border-[#1E2A3A]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-[#1E2A3A] py-3 text-sm font-medium text-muted-foreground"
            >
              Depois
            </button>
            <button
              type="button"
              disabled={saving || pending.length === 0 || selected.size === 0}
              onClick={() => void confirmSelected()}
              className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 py-3 text-sm font-semibold text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              ) : (
                `Confirmar (${selected.size})`
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="w-full mt-2 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Atualizar análise
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
