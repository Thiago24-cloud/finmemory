'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, Search, Trash2, Utensils } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { SkipButton } from '../skip/SkipButton';
import { MerchantMenuItemForm } from './MerchantMenuItemForm';

function formatBRL(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Cardápio do restaurante (UX Skip) — busca, Novo Item, lista por categoria.
 * Não usa oferta relâmpago nem publicação no mapa de preços.
 */
export function MerchantCardapioSection({ products, onProductSaved, onProductUpdated, onProductDeleted, loading }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!deleteId || typeof document === 'undefined') return undefined;
    const { body, documentElement } = document;
    const prevBody = body.style.overflow;
    const prevHtml = documentElement.style.overflow;
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      documentElement.style.overflow = prevHtml;
    };
  }, [deleteId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = Array.isArray(products) ? products : [];
    if (!q) return list;
    return list.filter((item) => {
      const name = String(item.name || item.nome || '').toLowerCase();
      const cat = String(item.categoria || item.category || '').toLowerCase();
      return name.includes(q) || cat.includes(q);
    });
  }, [products, search]);

  const grouped = useMemo(() => {
    return filtered.reduce((acc, item) => {
      const cat = item.categoria || item.category || 'Outros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [filtered]);

  const handleAdd = () => {
    setEditItem(null);
    setFormOpen(true);
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(painelApi.product(deleteId), { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao remover item.');
        return;
      }
      onProductDeleted?.(deleteId);
      setDeleteId(null);
    } catch {
      setError('Erro de rede ao remover item.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="flex items-center gap-2">
        <Utensils className="w-5 h-5 text-primary shrink-0" />
        <h1 className="text-xl font-bold m-0">Gerenciar Cardápio</h1>
      </div>
      <p className="text-sm text-muted-foreground m-0">
        Adicione, edite e remova itens do cardápio. Inclua ingredientes e fotos para informar seus
        clientes.
      </p>

      <div className="flex items-center justify-between gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item ou categoria..."
            className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <SkipButton onClick={handleAdd} size="sm" className="shrink-0 rounded-md">
          <Plus className="w-4 h-4" />
          Novo Item
        </SkipButton>
      </div>

      {error ? <p className="text-sm text-destructive m-0">{error}</p> : null}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Utensils className="w-8 h-8 animate-pulse text-primary" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Utensils className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground m-0">Nenhum item encontrado</p>
          <SkipButton onClick={handleAdd} variant="outline" size="sm">
            <Plus className="w-4 h-4" />
            Adicionar primeiro item
          </SkipButton>
        </div>
      ) : (
        Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide m-0">
              {category}
            </h3>
            <div className="space-y-2">
              {categoryItems.map((item) => {
                const img =
                  item.image_optimized_url || item.image_url || item.url_imagem || null;
                const name = item.name || item.nome || 'Item';
                const ingredients = item.ingredients || item.ingredientes || '';
                const description = item.description || item.descricao || '';
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        img ||
                        `https://img.usecurling.com/p/64/64?q=${encodeURIComponent(name)}`
                      }
                      alt={name}
                      className="w-14 h-14 rounded-lg object-cover shrink-0 bg-muted"
                      onError={(e) => {
                        e.currentTarget.src = 'https://img.usecurling.com/p/64/64?q=dish';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate m-0">{name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-1 m-0 mt-0.5">
                        {ingredients || description || 'Sem descrição'}
                      </p>
                      <p className="text-sm font-bold text-primary mt-0.5 m-0">
                        {formatBRL(item.price ?? item.preco_oferta)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <SkipButton
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleEdit(item)}
                        aria-label="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </SkipButton>
                      <SkipButton
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(item.id)}
                        aria-label="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </SkipButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <MerchantMenuItemForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editItem={editItem}
        onSaved={(data) => {
          if (editItem?.id && data?.product) {
            onProductUpdated?.(data.product);
          }
          onProductSaved?.({ ...data, menu_item: true });
          setFormOpen(false);
          setEditItem(null);
        }}
      />

      {deleteId && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
              <button
                type="button"
                className="absolute inset-0 z-0 bg-black/50 backdrop-blur-sm"
                aria-label="Fechar"
                onClick={() => !deleting && setDeleteId(null)}
              />
              <div
                role="alertdialog"
                className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-semibold m-0">Remover item do cardápio?</h3>
                <p className="text-sm text-muted-foreground m-0">
                  Esta ação não pode ser desfeita. O item será permanentemente removido.
                </p>
                <div className="flex justify-end gap-2">
                  <SkipButton
                    variant="outline"
                    onClick={() => setDeleteId(null)}
                    disabled={deleting}
                  >
                    Cancelar
                  </SkipButton>
                  <SkipButton variant="destructive" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Removendo…' : 'Remover'}
                  </SkipButton>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
