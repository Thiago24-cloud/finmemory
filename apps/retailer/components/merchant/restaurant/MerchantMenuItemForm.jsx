'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImageIcon, Link2, Loader2, Upload, X } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { SkipButton } from '../skip/SkipButton';
import { cn } from '../../../lib/skip/cn';

const CATEGORIES = ['Pratos Principais', 'Entradas', 'Bebidas', 'Sobremesas', 'Outros'];

/**
 * Formulário do cardápio (igual Skip) — sem oferta relâmpago / mapa de preços.
 */
export function MerchantMenuItemForm({ open, onOpenChange, onSaved, editItem = null }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setName(editItem?.name || editItem?.nome || '');
    const p = editItem?.price ?? editItem?.preco_oferta;
    setPrice(p != null && p !== '' ? String(p) : '');
    setIngredients(editItem?.ingredients || editItem?.ingredientes || '');
    setDescription(editItem?.description || editItem?.descricao || '');
    setCategory(editItem?.categoria || editItem?.category || '');
    const img = editItem?.image_url || editItem?.url_imagem || editItem?.image_optimized_url || null;
    setImageUrl('');
    setImagePreview(img);
    setFieldErrors({});
    setError('');
  }, [open, editItem]);

  if (!open) return null;

  const uploadFile = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      setError('Selecione um arquivo de imagem.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setImagePreview(dataUrl);
      const res = await fetch(painelApi.uploadImage, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Falha no upload da foto.');
        return;
      }
      setImageUrl(data.url);
      setImagePreview(data.url);
    } catch {
      setError('Erro ao enviar foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlChange = (url) => {
    setImageUrl(url);
    if (url.trim()) {
      setImagePreview(url.trim());
    } else {
      setImagePreview(editItem?.image_url || editItem?.url_imagem || null);
    }
  };

  const clearImage = () => {
    setImageUrl('');
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const validate = () => {
    const errors = {};
    if (!name.trim()) errors.name = 'Nome é obrigatório';
    if (!ingredients.trim()) errors.ingredients = 'Lista de ingredientes é obrigatória';
    if (!String(price).trim()) errors.price = 'Preço é obrigatório';
    else {
      const n = parseFloat(String(price).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) errors.price = 'Preço inválido';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setError('Preencha os campos obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        menu_item: true,
        source: 'cardapio',
        name: name.trim(),
        price: parseFloat(String(price).replace(',', '.')),
        ingredients: ingredients.trim(),
        description: description.trim() || null,
        category: category.trim() || 'Outros',
        image_url: imageUrl.trim() || imagePreview || null,
        em_oferta: false,
        publishToMap: false,
      };

      const isEdit = Boolean(editItem?.id);
      const res = await fetch(isEdit ? painelApi.product(editItem.id) : painelApi.products, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar item.');
        return;
      }
      onSaved?.(data);
      onOpenChange?.(false);
    } catch {
      setError('Erro de rede.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'w-full h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary';
  const areaClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        aria-label="Fechar"
        onClick={() => onOpenChange?.(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-item-form-title"
        className="relative z-10 flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 id="menu-item-form-title" className="text-lg font-semibold m-0 text-foreground">
            {editItem ? 'Editar Item' : 'Novo Item do Cardápio'}
          </h2>
          <button
            type="button"
            onClick={() => onOpenChange?.(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-1.5">
              <label htmlFor="menu-item-name" className="text-sm font-medium text-foreground">
                Nome <span className="text-destructive">*</span>
              </label>
              <input
                id="menu-item-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pizza Margherita"
                className={cn(fieldClass, fieldErrors.name && 'border-destructive')}
              />
              {fieldErrors.name ? (
                <p className="text-xs text-destructive m-0">{fieldErrors.name}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="menu-item-price" className="text-sm font-medium text-foreground">
                Preço (R$) <span className="text-destructive">*</span>
              </label>
              <input
                id="menu-item-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
                className={cn(fieldClass, fieldErrors.price && 'border-destructive')}
              />
              {fieldErrors.price ? (
                <p className="text-xs text-destructive m-0">{fieldErrors.price}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="menu-item-ingredients" className="text-sm font-medium text-foreground">
                Ingredientes <span className="text-destructive">*</span>
              </label>
              <textarea
                id="menu-item-ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Ex: Farinha de trigo, molho de tomate, mussarela de búfala, manjericão, azeite..."
                rows={3}
                className={cn(
                  areaClass,
                  'min-h-[80px]',
                  fieldErrors.ingredients && 'border-destructive'
                )}
              />
              {fieldErrors.ingredients ? (
                <p className="text-xs text-destructive m-0">{fieldErrors.ingredients}</p>
              ) : (
                <p className="text-xs text-muted-foreground m-0">
                  Informe todos os ingredientes para clientes com alergias ou restrições alimentares.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="menu-item-description" className="text-sm font-medium text-foreground">
                Modo de Preparo / Descrição
              </label>
              <textarea
                id="menu-item-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva como o prato é preparado..."
                rows={2}
                className={cn(areaClass, 'min-h-[64px]')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="menu-item-category" className="text-sm font-medium text-foreground">
                Categoria
              </label>
              <input
                id="menu-item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Pratos Principais"
                list="menu-category-suggestions"
                className={fieldClass}
              />
              <datalist id="menu-category-suggestions">
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground m-0">Imagem do Produto</p>
              <div className="flex gap-2 flex-wrap">
                <SkipButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="w-4 h-4" />
                  Tirar Foto
                </SkipButton>
                <SkipButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Enviar Arquivo
                </SkipButton>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(file);
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="Ou cole uma URL de imagem"
                  className={cn(fieldClass, 'flex-1')}
                />
              </div>
              {imagePreview ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Pré-visualização"
                    className="w-24 h-24 rounded-lg object-cover border border-border"
                    onError={() => setImagePreview(null)}
                  />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 hover:scale-110 transition-transform"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>

            {error ? <p className="text-sm text-destructive m-0">{error}</p> : null}
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-card px-5 py-4">
            <SkipButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
              disabled={saving || uploading}
            >
              Cancelar
            </SkipButton>
            <SkipButton type="submit" disabled={saving || uploading}>
              {saving ? 'Salvando...' : editItem ? 'Salvar Alterações' : 'Criar Item'}
            </SkipButton>
          </div>
        </form>
      </div>
    </div>
  );
}
