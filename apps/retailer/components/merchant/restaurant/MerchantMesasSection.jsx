'use client';

import { useCallback, useEffect, useState } from 'react';
import { Hash, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';

const STATUS_LABEL = {
  livre: { label: 'Livre', className: 'text-green-400' },
  ocupada: { label: 'Ocupada', className: 'text-amber-400' },
  reservada: { label: 'Reservada', className: 'text-blue-400' },
  fechada: { label: 'Fechada', className: 'text-white/40' },
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
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold m-0 text-white flex items-center gap-2">
          <Hash className="h-5 w-5 text-[#39FF14]" />
          Mesas
        </h2>
        <p className="text-xs text-white/50 mt-2 m-0">
          Numere mesas digitalmente. Use os QR codes na aba Códigos para o cliente pedir pelo celular.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          value={newNum}
          onChange={(e) => setNewNum(e.target.value)}
          placeholder={`Nº (sug.: ${nextSuggested})`}
          className="flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void addMesa()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-bold text-[#050508] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Mesa
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 m-0">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-white/60 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#39FF14]" />
          Carregando mesas…
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 list-none p-0 m-0">
          {mesas.map((mesa) => {
            const st = STATUS_LABEL[mesa.status] || STATUS_LABEL.livre;
            return (
              <li
                key={mesa.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-black text-white">#{mesa.numero}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeMesa(mesa.id)}
                    className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5"
                    aria-label="Remover mesa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className={`text-xs font-semibold m-0 ${st.className}`}>{st.label}</p>
                <p className="text-[10px] text-white/40 m-0 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  até {mesa.capacidade} pessoas
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleStatus(mesa)}
                  className="text-xs font-semibold rounded-lg border border-white/15 py-2 hover:bg-white/5 text-white/80"
                >
                  {mesa.status === 'livre' ? 'Marcar ocupada' : 'Liberar mesa'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
