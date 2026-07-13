'use client';

import { useCallback, useEffect, useState } from 'react';
import { Hash, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';

const STATUS_LABEL = {
  livre: { label: 'Livre', className: 'text-primary' },
  ocupada: { label: 'Ocupada', className: 'text-amber-600' },
  reservada: { label: 'Reservada', className: 'text-blue-600' },
  fechada: { label: 'Fechada', className: 'text-muted-foreground' },
};

export function MerchantMesasSection() {
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newNum, setNewNum] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(painelApi.mesas);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || 'Erro ao carregar mesas.');
        setMesas([]);
        return;
      }
      setMesas(json.mesas || []);
    } catch {
      setError('Erro de rede.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addMesa = async () => {
    const numero = parseInt(newNum, 10);
    if (!Number.isFinite(numero) || numero < 0) return;
    setBusy(true);
    try {
      const res = await fetch(painelApi.mesas, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero, capacidade: 4 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(json.error || 'Erro ao criar mesa.');
        return;
      }
      setNewNum('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const removeMesa = async (id) => {
    if (!window.confirm('Remover esta mesa?')) return;
    setBusy(true);
    try {
      await fetch(painelApi.mesa(id), { method: 'DELETE' });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (mesa) => {
    const next = mesa.status === 'livre' ? 'ocupada' : 'livre';
    setBusy(true);
    try {
      await fetch(painelApi.mesa(mesa.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const nextSuggested = mesas.length ? Math.max(...mesas.map((m) => m.numero)) + 1 : 1;

  return (
    <div className="animate-fade-in-up">
      <SkipPageHeader
        icon={Hash}
        title="Mesas"
        description="Numere mesas digitalmente. Use os QR codes na aba Códigos para o cliente pedir pelo celular."
      />

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          min="0"
          value={newNum}
          onChange={(e) => setNewNum(e.target.value)}
          placeholder={`Nº (sug.: ${nextSuggested})`}
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <SkipButton disabled={busy} onClick={() => void addMesa()}>
          <Plus className="h-4 w-4" />
          Mesa
        </SkipButton>
      </div>

      {error ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 m-0 mb-4">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Carregando mesas…
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none p-0 m-0">
          {mesas.map((mesa) => {
            const st = STATUS_LABEL[mesa.status] || STATUS_LABEL.livre;
            return (
              <li key={mesa.id}>
                <SkipCard className="shadow-subtle h-full">
                  <SkipCardContent className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-black">#{mesa.numero}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeMesa(mesa.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                        aria-label="Remover mesa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className={`text-xs font-semibold m-0 ${st.className}`}>{st.label}</p>
                    <p className="text-[10px] text-muted-foreground m-0 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      até {mesa.capacidade} pessoas
                    </p>
                    <SkipButton
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void toggleStatus(mesa)}
                    >
                      {mesa.status === 'livre' ? 'Marcar ocupada' : 'Liberar mesa'}
                    </SkipButton>
                  </SkipCardContent>
                </SkipCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
