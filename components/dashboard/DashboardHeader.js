'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, LogOut, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';
import { XPBar } from '../gamification/XPBar';
import { useGamification } from '../../hooks/useGamification';
import { toast } from 'sonner';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Mantém sobrenomes ao editar só o primeiro nome no header. */
function mergeFirstNameIntoFullName(fullName, newFirst) {
  const first = String(newFirst || '').trim();
  if (!first) return '';
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) return first;
  return `${first} ${parts.slice(1).join(' ')}`.trim();
}

export function DashboardHeader({ user, onSignOut, className }) {
  const { update } = useSession();
  const userName = user?.name || 'Usuário';
  const firstName = userName.split(/\s+/)[0] || 'Usuário';
  const avatarUrl = user?.image;
  const initials = userName.slice(0, 2).toUpperCase();
  const { xp_points, level, streak_current, loading } = useGamification();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(firstName);
  const [savingName, setSavingName] = useState(false);
  const inputRef = useRef(null);
  const skipBlurSaveRef = useRef(false);

  useEffect(() => {
    if (!editingName) setNameDraft(firstName);
  }, [firstName, editingName]);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  const cancelEdit = useCallback(() => {
    skipBlurSaveRef.current = true;
    setNameDraft(firstName);
    setEditingName(false);
  }, [firstName]);

  const saveName = useCallback(async () => {
    const trimmedFirst = nameDraft.trim();
    if (!trimmedFirst) {
      toast.error('Informe um nome válido.');
      return;
    }

    const newFullName = mergeFirstNameIntoFullName(userName, trimmedFirst);
    if (newFullName === userName.trim()) {
      setEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFullName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || `Erro ${res.status}`);
      }

      await update({ name: json.name || newFullName });
      setEditingName(false);
      toast.success('Nome atualizado');
    } catch (e) {
      console.error('[DashboardHeader] save name:', e);
      toast.error(e?.message || 'Não foi possível salvar o nome');
    } finally {
      setSavingName(false);
    }
  }, [nameDraft, update, userName]);

  const onNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  return (
    <header className={cn('bg-card border-b border-border px-5 pt-5 pb-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-11 w-11 rounded-full border-2 border-primary overflow-hidden bg-muted flex items-center justify-center text-foreground text-sm flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
              {getGreeting()},
            </p>
            {editingName ? (
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={onNameKeyDown}
                  onBlur={() => {
                    if (skipBlurSaveRef.current) {
                      skipBlurSaveRef.current = false;
                      return;
                    }
                    if (!savingName) saveName();
                  }}
                  disabled={savingName}
                  maxLength={80}
                  className="w-full max-w-[200px] rounded-lg border border-primary/50 bg-background px-2 py-1 text-[18px] font-black leading-tight text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  aria-label="Editar nome"
                />
                {savingName ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-left text-foreground font-black text-[18px] leading-tight truncate max-w-full hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded px-0.5 -mx-0.5"
                title="Toque para editar seu nome"
                aria-label={`${firstName}. Toque para editar.`}
              >
                {firstName}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/notifications"
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Lembretes e notificações"
          >
            <Bell className="h-5 w-5 text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Sair"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {!loading && (
        <XPBar xp={xp_points} level={level} streak={streak_current} className="mt-4" />
      )}
    </header>
  );
}
