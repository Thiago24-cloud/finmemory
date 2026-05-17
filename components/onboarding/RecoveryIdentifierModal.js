'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * Segundo passo do onboarding: telefone OU CPF para recuperação de conta.
 * Se o dado já existir em outra conta do mesmo dono, confirma com email + senha dessa conta.
 */
export function RecoveryIdentifierModal({ open, onComplete }) {
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [needsClaim, setNeedsClaim] = useState(false);
  const [conflictField, setConflictField] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setPhone('');
    setDocument('');
    setClaimEmail('');
    setClaimPassword('');
    setNeedsClaim(false);
    setConflictField(null);
    setError(null);
  }, [open]);

  const salvar = useCallback(async () => {
    const p = phone.trim();
    const d = document.trim();
    if (!p && !d) {
      setError('Informe ao menos seu celular (com DDD) ou seu CPF.');
      return;
    }
    if (needsClaim && (!claimEmail.trim() || !claimPassword)) {
      setError('Informe o email e a senha da conta que já usa este telefone ou CPF.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        phone: p || undefined,
        document: d || undefined,
      };
      if (needsClaim) {
        payload.claim_email = claimEmail.trim();
        payload.claim_password = claimPassword;
      }

      const res = await fetch('/api/user/recovery-identifiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.needs_claim) {
          setNeedsClaim(true);
          setConflictField(data.conflict_field || null);
          setError(
            data.conflict_field === 'phone'
              ? 'Este celular já está em outra conta sua. Confirme o email e a senha dessa conta abaixo.'
              : data.conflict_field === 'document'
                ? 'Este CPF já está em outra conta sua. Confirme o email e a senha dessa conta abaixo.'
                : 'Este telefone ou CPF já está em outra conta sua. Confirme email e senha dessa conta.'
          );
          return;
        }
        setError(data.error || 'Não foi possível salvar.');
        return;
      }
      onComplete?.();
    } catch (e) {
      setError(e.message || 'Erro de rede.');
    } finally {
      setSubmitting(false);
    }
  }, [phone, document, claimEmail, claimPassword, needsClaim, onComplete]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[205] flex items-center justify-center bg-black/80 backdrop-blur-sm p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-identifier-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#1E2A3A] bg-card p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="text-center space-y-1">
          <h2 id="recovery-identifier-title" className="text-xl font-black text-foreground">
            Mais uma etapa para sua segurança
          </h2>
          <p className="text-sm text-muted-foreground">
            Adicione <strong className="text-foreground">celular ou CPF</strong> — usamos se você esquecer o email de cadastro ou a senha.
          </p>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">Celular (com DDD)</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 99999-0000"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError(null);
            }}
            className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        <div className="flex items-center gap-2 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] text-muted-foreground font-semibold uppercase">ou</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground mb-1 block">CPF</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={document}
            onChange={(e) => {
              setDocument(e.target.value);
              setError(null);
            }}
            className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>

        {needsClaim ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-xs text-foreground font-semibold leading-relaxed m-0">
              {conflictField === 'phone'
                ? 'Confirme a conta que já tem este celular'
                : conflictField === 'document'
                  ? 'Confirme a conta que já tem este CPF'
                  : 'Confirme a outra conta'}
            </p>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">Email da outra conta</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="email@exemplo.com"
                value={claimEmail}
                onChange={(e) => {
                  setClaimEmail(e.target.value);
                  setError(null);
                }}
                className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground mb-1 block">Senha da outra conta</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Sua senha"
                value={claimPassword}
                onChange={(e) => {
                  setClaimPassword(e.target.value);
                  setError(null);
                }}
                className="w-full rounded-xl border border-[#1E2A3A] bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-400 text-center m-0">{error}</p> : null}

        <button
          type="button"
          onClick={salvar}
          disabled={submitting}
          className="w-full rounded-xl bg-primary py-3.5 font-black text-[#0A0E1A] disabled:opacity-40 disabled:pointer-events-none"
        >
          {submitting ? 'Salvando…' : needsClaim ? 'Confirmar e continuar' : 'Continuar'}
        </button>

        <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
          Você só precisa de um dos dois dados. São armazenados de forma restrita conforme nossa política de privacidade.
        </p>
      </div>
    </div>
  );
}

