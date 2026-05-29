'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';

const UNIDADES = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'kg', label: 'Quilograma (kg)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'L', label: 'Litro (L)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'cx', label: 'Caixa (cx)' },
  { value: 'pct', label: 'Pacote (pct)' },
  { value: 'dz', label: 'Dúzia (dz)' },
];

const EMPTY = {
  nome: '',
  ean: '',
  unidade: 'un',
  estoque_minimo: '',
  quantidade_atual: '',
  custo_medio: '',
  recorrente: true,
};

export function MerchantInsumoForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const estoqueMinimo = form.estoque_minimo === '' ? 0 : parseFloat(String(form.estoque_minimo).replace(',', '.'));
      const quantidadeAtual = form.quantidade_atual === '' ? 0 : parseFloat(String(form.quantidade_atual).replace(',', '.'));
      const custoMedio =
        form.custo_medio === '' ? null : parseFloat(String(form.custo_medio).replace(',', '.'));

      const res = await fetch(painelApi.insumos, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          ean: form.ean || null,
          unidade: form.unidade,
          estoque_minimo: estoqueMinimo,
          quantidade_atual: quantidadeAtual,
          custo_medio: custoMedio,
          recorrente: form.recorrente,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar insumo.');
        return;
      }
      onSaved?.(data.insumo);
      setForm(EMPTY);
    } catch {
      setError('Erro de rede.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 rounded-2xl border border-[#39FF14]/25 bg-[#39FF14]/5 p-4 sm:p-5 space-y-3"
    >
      <p className="text-xs text-white/60 m-0">
        Insumos são matéria-prima e itens de compra (farinha, óleo, embalagem). Depois você registrará entradas por nota
        fiscal — Sprint 2.
      </p>

      <label className="block">
        <span className="text-xs font-medium text-white/70 mb-1 block">Nome do insumo *</span>
        <input
          name="nome"
          value={form.nome}
          onChange={onChange}
          required
          placeholder="Ex.: Farinha de trigo 1kg"
          className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/40"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-white/70 mb-1 block">Código de barras (opcional)</span>
          <input
            name="ean"
            value={form.ean}
            onChange={onChange}
            inputMode="numeric"
            placeholder="789…"
            className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/40"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-white/70 mb-1 block">Unidade</span>
          <select
            name="unidade"
            value={form.unidade}
            onChange={onChange}
            className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#39FF14]/40"
          >
            {UNIDADES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-white/70 mb-1 block">Quantidade atual</span>
          <input
            name="quantidade_atual"
            value={form.quantidade_atual}
            onChange={onChange}
            inputMode="decimal"
            placeholder="0"
            className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/40"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-white/70 mb-1 block">Estoque mínimo</span>
          <input
            name="estoque_minimo"
            value={form.estoque_minimo}
            onChange={onChange}
            inputMode="decimal"
            placeholder="0"
            className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/40"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-white/70 mb-1 block">Custo médio (R$)</span>
          <input
            name="custo_medio"
            value={form.custo_medio}
            onChange={onChange}
            inputMode="decimal"
            placeholder="0,00"
            className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/40"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
        <input
          type="checkbox"
          name="recorrente"
          checked={form.recorrente}
          onChange={onChange}
          className="rounded border-white/30"
        />
        Compra recorrente (entra no relatório mensal — em breve)
      </label>

      {error ? (
        <p className="text-sm text-red-400 m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-bold text-[#050508] hover:brightness-110 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Salvar insumo
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/20 px-5 py-2.5 text-sm text-white/70 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
