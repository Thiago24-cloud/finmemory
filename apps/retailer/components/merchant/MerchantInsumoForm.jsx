'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';
import { SkipButton } from './skip/SkipButton';

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

const inputClass =
  'w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

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
      className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5 space-y-3 shadow-subtle"
    >
      <p className="text-xs text-muted-foreground m-0">
        Insumos são matéria-prima e itens de compra (farinha, óleo, embalagem). Depois você registrará entradas por nota fiscal.
      </p>

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground mb-1 block">Nome do insumo *</span>
        <input
          name="nome"
          value={form.nome}
          onChange={onChange}
          required
          placeholder="Ex.: Farinha de trigo 1kg"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground mb-1 block">Código de barras (opcional)</span>
          <input
            name="ean"
            value={form.ean}
            onChange={onChange}
            inputMode="numeric"
            placeholder="789…"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground mb-1 block">Unidade</span>
          <select name="unidade" value={form.unidade} onChange={onChange} className={inputClass}>
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
          <span className="text-xs font-medium text-muted-foreground mb-1 block">Quantidade atual</span>
          <input name="quantidade_atual" value={form.quantidade_atual} onChange={onChange} inputMode="decimal" placeholder="0" className={inputClass} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground mb-1 block">Estoque mínimo</span>
          <input name="estoque_minimo" value={form.estoque_minimo} onChange={onChange} inputMode="decimal" placeholder="0" className={inputClass} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground mb-1 block">Custo médio (R$)</span>
          <input name="custo_medio" value={form.custo_medio} onChange={onChange} inputMode="decimal" placeholder="0,00" className={inputClass} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" name="recorrente" checked={form.recorrente} onChange={onChange} className="accent-primary rounded" />
        Compra recorrente
      </label>

      {error ? (
        <p className="text-sm text-destructive m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <SkipButton type="submit" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Salvar insumo
        </SkipButton>
        <SkipButton type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </SkipButton>
      </div>
    </form>
  );
}
