'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, Zap } from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';

const EMPTY = {
  name: '',
  price: '',
  priceOriginal: '',
  description: '',
  image_url: '',
  em_oferta: true,
};

export function MerchantProductForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const uploadFile = async (file) => {
    if (!file.type.startsWith('image/')) {
      setError('Selecione uma imagem (JPG, PNG ou WebP).');
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
      setForm((f) => ({ ...f, image_url: data.url }));
    } catch {
      setError('Erro ao enviar foto.');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const precoOferta = parseFloat(String(form.price).replace(',', '.'));
      const precoOriginal = form.priceOriginal
        ? parseFloat(String(form.priceOriginal).replace(',', '.'))
        : null;

      const res = await fetch(painelApi.products, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          price: precoOferta,
          preco_original: precoOriginal,
          description: form.description,
          image_url: form.image_url,
          em_oferta: form.em_oferta,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Erro ao salvar.');
        return;
      }
      onSaved?.(data);
      setForm(EMPTY);
    } catch {
      setError('Erro de rede.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
      <h2 className="text-lg font-bold m-0">Nova oferta</h2>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative shrink-0 w-full sm:w-32 h-32 rounded-xl border-2 border-dashed border-white/20 bg-[#0a0a10] flex flex-col items-center justify-center gap-2 hover:border-[#39FF14]/50 transition-colors overflow-hidden"
        >
          {form.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <>
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" aria-hidden />
              ) : (
                <Camera className="h-8 w-8 text-white/40" aria-hidden />
              )}
              <span className="text-xs text-white/50">Foto do produto</span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f);
            e.target.value = '';
          }}
        />
        <div className="flex-1 space-y-3 min-w-0">
          <Field
            label="Nome do produto"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            required
            placeholder="Milk-shake de Morango"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Preço promocional (R$)"
              value={form.price}
              onChange={(v) => setForm((f) => ({ ...f, price: v }))}
              required
              placeholder="10,00"
              inputMode="decimal"
            />
            <Field
              label="Preço de balcão (opcional)"
              value={form.priceOriginal}
              onChange={(v) => setForm((f) => ({ ...f, priceOriginal: v }))}
              placeholder="15,00"
              inputMode="decimal"
            />
          </div>
        </div>
      </div>

      <Field
        label="Descrição (opcional)"
        value={form.description}
        onChange={(v) => setForm((f) => ({ ...f, description: v }))}
        placeholder="Retirada em até 15 min · válido hoje"
      />

      <label className="flex items-start gap-3 rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/10 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={form.em_oferta}
          onChange={(e) => setForm((f) => ({ ...f, em_oferta: e.target.checked }))}
          className="mt-1 h-4 w-4 accent-[#39FF14]"
        />
        <span>
          <span className="flex items-center gap-2 font-bold text-[#39FF14] text-sm">
            <Zap className="h-4 w-4" aria-hidden />
            Oferta relâmpago
          </span>
          <span className="block text-xs text-white/55 mt-1">
            Publica no mapa para clientes num raio de ~3 km da sua loja (válida por 3 dias).
          </span>
        </span>
      </label>

      {error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="submit"
          disabled={saving || uploading}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#39FF14] py-3 font-bold text-[#050508] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
          Salvar{form.em_oferta ? ' e publicar no mapa' : ''}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, value, onChange, required, placeholder, inputMode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-white/70 mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full rounded-xl border border-white/15 bg-[#0a0a10] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/50"
      />
    </label>
  );
}
