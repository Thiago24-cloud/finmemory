'use client';

import { useState } from 'react';
import { Plus, Utensils } from 'lucide-react';
import { MerchantProductForm } from '../MerchantProductForm';
import { MerchantProductCard } from '../MerchantProductCard';

/**
 * Cardápio do restaurante — produtos vendáveis (produtos_loja).
 */
export function MerchantCardapioSection({ products, onProductSaved, onProductUpdated, loading }) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold m-0 text-white flex items-center gap-2">
            <Utensils className="h-5 w-5 text-[#39FF14]" />
            Cardápio
          </h2>
          <p className="text-xs text-white/50 mt-2 m-0">
            Pratos e bebidas que aparecem no pedido da mesa e no balcão.
          </p>
        </div>
        {!formOpen ? (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#39FF14] px-4 py-2.5 text-sm font-bold text-[#050508]"
          >
            <Plus className="h-4 w-4" />
            Item
          </button>
        ) : null}
      </div>

      {formOpen ? (
        <MerchantProductForm
          onSaved={(data) => {
            onProductSaved(data);
            setFormOpen(false);
          }}
          onCancel={() => setFormOpen(false)}
        />
      ) : null}

      {loading ? (
        <p className="text-sm text-white/50">Carregando cardápio…</p>
      ) : products.length === 0 && !formOpen ? (
        <p className="text-sm text-white/40 m-0">
          Nenhum item no cardápio. Adicione pratos com foto, preço e ingredientes.
        </p>
      ) : (
        <ul className="space-y-3 list-none p-0 m-0">
          {products.map((p) => (
            <MerchantProductCard key={p.id} product={p} onUpdated={onProductUpdated} />
          ))}
        </ul>
      )}
    </div>
  );
}
