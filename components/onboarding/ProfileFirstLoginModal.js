'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * Primeiro login: nome obrigatório + foto opcional (avatar na bolinha do header).
 */
export function ProfileFirstLoginModal({ open, initialName = '', initialAvatarUrl = null, onComplete }) {
  const [nome, setNome] = useState(initialName);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(initialAvatarUrl);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setNome(typeof initialName === 'string' ? initialName : '');
    setFile(null);
    setPreview(initialAvatarUrl || null);
    setError(null);
  }, [open, initialName, initialAvatarUrl]);

  const onPickFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setError('Use uma imagem de até 2 MB.');
      return;
    }
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }, []);

  const salvar = useCallback(async () => {
    const trimmed = nome.trim();
    if (trimmed.length < 1) {
      setError('Informe como prefere ser chamado.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let imageBase64 = null;
      let mimeType = null;
      if (file) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          imageBase64 = match[2];
        }
      }

      const res = await fetch('/api/user/profile-first-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: trimmed,
          imageBase64,
          mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível salvar.');
        return;
      }
      onComplete({
        displayName: data.displayName || trimmed,
        avatarUrl: data.avatarUrl || null,
      });
    } catch (e) {
      setError(e.message || 'Erro de rede.');
    } finally {
      setSubmitting(false);
    }
  }, [nome, file, onComplete]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-first-login-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#1E2A3A] bg-card p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-1">
          <h2 id="profile-first-login-title" className="text-xl font-black text-foreground">
            Bem-vindo ao FinMemory
          </h2>
          <p className="text-sm text-muted-foreground">Como posso te chamar?</p>
        </div>

        <label className="flex flex-col items-center gap-2 cursor-pointer">
          <span className="sr-only">Foto de perfil (opcional)</span>
          <div className="relative h-24 w-24 rounded-full border-2 border-primary overflow-hidden bg-muted flex items-center justify-center">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl text-primary font-light leading-none">+</span>
            )}
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          <span className="text-xs text-muted-foreground">Foto opcional · toque para escolher</span>
        </label>

        <input
          type="text"
          autoComplete="name"
          placeholder="Seu nome"
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setError(null);
          }}
          className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {error && <p className="text-sm text-red-400 text-center m-0">{error}</p>}

        <button
          type="button"
          onClick={salvar}
          disabled={submitting || !nome.trim()}
          className="w-full rounded-xl bg-primary py-3.5 font-black text-[#0A0E1A] disabled:opacity-40 disabled:pointer-events-none"
        >
          {submitting ? 'Salvando…' : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
