'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, Plus, Trash2, Users } from 'lucide-react';
import { painelApi } from '../../../lib/merchant/painelApiPaths';
import { SkipPageHeader } from '../skip/SkipPageHeader';
import { SkipCard, SkipCardContent } from '../skip/SkipCard';
import { SkipButton } from '../skip/SkipButton';
import { SkipBadge } from '../skip/SkipBadge';

const PAPEIS = [
  { id: 'garcom', label: 'Garçom' },
  { id: 'cozinha', label: 'Cozinha' },
  { id: 'caixa', label: 'Caixa' },
];

export function MerchantEquipeSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [codigo, setCodigo] = useState('');
  const [counts, setCounts] = useState({ garcom: 0, cozinha: 0, caixa: 0, total: 0 });
  const [membros, setMembros] = useState([]);
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState('garcom');
  const [telefone, setTelefone] = useState('');
  const [pin, setPin] = useState('');
  const [createdPin, setCreatedPin] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(painelApi.equipe);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Não foi possível carregar a equipe.');
        return;
      }
      setCodigo(data.codigo_equipe || '');
      setCounts(data.counts || { garcom: 0, cozinha: 0, caixa: 0, total: 0 });
      setMembros(data.membros || []);
    } catch {
      setError('Erro de rede.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyCodigo = () => {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const cadastrar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setCreatedPin(null);
    try {
      const res = await fetch(painelApi.equipe, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, papel, telefone, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Falha ao cadastrar.');
        return;
      }
      setCreatedPin({
        nome: data.membro?.nome,
        pin: data.pin_plain,
        papel: data.membro?.papel_label || papel,
      });
      setNome('');
      setTelefone('');
      setPin('');
      await load();
    } catch {
      setError('Erro de rede ao cadastrar.');
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (m) => {
    await fetch(painelApi.equipeMembro(m.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !m.ativo }),
    });
    await load();
  };

  const remover = async (m) => {
    if (!window.confirm(`Remover ${m.nome} da equipe?`)) return;
    await fetch(painelApi.equipeMembro(m.id), { method: 'DELETE' });
    await load();
  };

  return (
    <div className="animate-fade-in-up space-y-4">
      <SkipPageHeader
        icon={Users}
        title="Equipe"
        description="Cadastre garçons e cozinha com PIN — cada um só vê a tela do seu papel."
      />

      {error ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 m-0">
          {error}
        </p>
      ) : null}

      <SkipCard className="shadow-subtle">
        <SkipCardContent className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground m-0 mb-1">
            Código da loja (para o celular da equipe)
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-widest text-primary">{codigo || '—'}</span>
            <SkipButton variant="outline" size="icon" onClick={copyCodigo} className="h-9 w-9" aria-label="Copiar">
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </SkipButton>
          </div>
          <p className="text-xs text-muted-foreground m-0 mt-2">
            Link da equipe:{' '}
            <a href="/parceiros/equipe/entrar" className="text-primary underline font-medium">
              /parceiros/equipe/entrar
            </a>
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-2xl font-black m-0">{counts.garcom}</p>
              <p className="text-[10px] text-muted-foreground m-0">Garçons</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-2xl font-black m-0">{counts.cozinha}</p>
              <p className="text-[10px] text-muted-foreground m-0">Cozinha</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <p className="text-2xl font-black m-0">{counts.caixa}</p>
              <p className="text-[10px] text-muted-foreground m-0">Caixa</p>
            </div>
          </div>
        </SkipCardContent>
      </SkipCard>

      <SkipCard className="shadow-subtle">
        <SkipCardContent className="p-4">
          <p className="font-bold m-0 mb-3">Cadastrar funcionário</p>
          <form onSubmit={cadastrar} className="space-y-3">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome (ex: João)"
              required
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="grid grid-cols-3 gap-2">
              {PAPEIS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPapel(p.id)}
                  className={`h-11 rounded-xl border text-sm font-bold cursor-pointer ${
                    papel === p.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-input text-muted-foreground'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Telefone (opcional)"
              inputMode="tel"
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="PIN de 4 a 6 dígitos"
              inputMode="numeric"
              required
              minLength={4}
              maxLength={6}
              className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm font-mono tracking-widest outline-none focus:ring-2 focus:ring-ring"
            />
            <SkipButton type="submit" disabled={saving} className="w-full h-11 rounded-xl font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cadastrar
            </SkipButton>
          </form>
          {createdPin ? (
            <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm">
              <p className="font-bold m-0">{createdPin.nome} ({createdPin.papel}) cadastrado</p>
              <p className="m-0 mt-1">
                PIN: <strong className="font-mono text-lg tracking-widest">{createdPin.pin}</strong>
              </p>
              <p className="text-xs text-muted-foreground m-0 mt-1">Anote agora — não mostramos de novo.</p>
            </div>
          ) : null}
        </SkipCardContent>
      </SkipCard>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <ul className="space-y-2 list-none p-0 m-0">
          {membros.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 m-0">
              Nenhum funcionário ainda. Cadastre o primeiro garçom ou a cozinha.
            </p>
          ) : (
            membros.map((m) => (
              <li key={m.id}>
                <SkipCard className="shadow-subtle">
                  <SkipCardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{m.nome}</span>
                        <SkipBadge className="bg-primary/10 text-primary border-primary/20">
                          {m.papel_label}
                        </SkipBadge>
                        {!m.ativo ? (
                          <SkipBadge className="bg-muted text-muted-foreground">inativo</SkipBadge>
                        ) : null}
                      </div>
                      {m.telefone ? (
                        <p className="text-xs text-muted-foreground m-0 mt-0.5">{m.telefone}</p>
                      ) : null}
                    </div>
                    <SkipButton variant="outline" size="sm" onClick={() => void toggleAtivo(m)}>
                      {m.ativo ? 'Pausar' : 'Ativar'}
                    </SkipButton>
                    <SkipButton
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => void remover(m)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </SkipButton>
                  </SkipCardContent>
                </SkipCard>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
