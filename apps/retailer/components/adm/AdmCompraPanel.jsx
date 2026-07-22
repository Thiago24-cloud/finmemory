'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
} from 'lucide-react';

const TABS = [
  { id: 'usuarios', label: 'Usuários' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'mercados', label: 'Mercados' },
  { id: 'precos', label: 'Preços' },
  { id: 'alertas', label: 'Alertas' },
];

const emptyUser = {
  nome: '',
  telefone: '',
  cidade: '',
  bairro: '',
  perfil: 'Ambulante',
  produto_principal: '',
  plano: 'Teste grátis',
  dia_compra: 'Segunda-feira',
  status: 'Ativo',
  observacoes: '',
};

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';

export function AdmCompraPanel() {
  const [tab, setTab] = useState('usuarios');
  const [meta, setMeta] = useState({ perfis: [], planos: [], status: [], dias: [] });
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [prices, setPrices] = useState([]);
  const [filters, setFilters] = useState({
    cidade: '',
    bairro: '',
    perfil: '',
    dia_compra: '',
    status: '',
    plano: '',
    alerta_hoje: false,
    q: '',
  });
  const [userForm, setUserForm] = useState(emptyUser);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [listForm, setListForm] = useState({ product_id: '', quantidade_media: '', frequencia: 'Semanal' });
  const [productForm, setProductForm] = useState({
    nome: '',
    categoria: '',
    unidade: 'un.',
    marca: '',
  });
  const [marketForm, setMarketForm] = useState({
    nome: '',
    cidade: '',
    bairro: '',
    endereco: '',
    contato: '',
  });
  const [priceForm, setPriceForm] = useState({
    product_id: '',
    market_id: '',
    preco: '',
    data_preco: new Date().toISOString().slice(0, 10),
    fonte: '',
    observacao: '',
  });
  const [alertPreview, setAlertPreview] = useState(null);
  const [alertUsers, setAlertUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (k === 'alerta_hoje') {
        if (v) params.set('alerta_hoje', '1');
        return;
      }
      if (v) params.set(k, String(v));
    });
    const data = await api(`/api/parceiros/adm/users?${params}`);
    setUsers(data.users || []);
    if (data.meta) setMeta(data.meta);
  }, [filters]);

  const loadCatalog = useCallback(async () => {
    const [p, m, pr] = await Promise.all([
      api('/api/parceiros/adm/products'),
      api('/api/parceiros/adm/markets'),
      api('/api/parceiros/adm/prices'),
    ]);
    setProducts(p.products || []);
    setMarkets(m.markets || []);
    setPrices(pr.prices || []);
  }, []);

  const loadAlertUsers = useCallback(async () => {
    const params = new URLSearchParams({ alerta_hoje: '1' });
    if (filters.cidade) params.set('cidade', filters.cidade);
    if (filters.bairro) params.set('bairro', filters.bairro);
    if (filters.perfil) params.set('perfil', filters.perfil);
    const data = await api(`/api/parceiros/adm/alerts?${params}`);
    setAlertUsers(data.users || []);
  }, [filters.cidade, filters.bairro, filters.perfil]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadUsers(), loadCatalog()]);
      if (tab === 'alertas') await loadAlertUsers();
    } catch (err) {
      setError(err.message || 'Erro ao carregar ADM');
    } finally {
      setLoading(false);
    }
  }, [loadUsers, loadCatalog, loadAlertUsers, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => setSuccess(''), 4000);
    return () => clearTimeout(t);
  }, [success]);

  const openUser = async (id) => {
    setSelectedUserId(id);
    setBusy(true);
    setError('');
    try {
      const data = await api(`/api/parceiros/adm/users/${id}`);
      setUserDetail(data);
      setUserForm({ ...emptyUser, ...data.user });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveUser = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (selectedUserId) {
        await api(`/api/parceiros/adm/users/${selectedUserId}`, {
          method: 'PATCH',
          body: JSON.stringify(userForm),
        });
        setSuccess('Usuário atualizado');
      } else {
        const data = await api('/api/parceiros/adm/users', {
          method: 'POST',
          body: JSON.stringify(userForm),
        });
        setSuccess('Usuário cadastrado');
        setSelectedUserId(data.user.id);
        await openUser(data.user.id);
      }
      await loadUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addListItem = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setBusy(true);
    try {
      await api(`/api/parceiros/adm/users/${selectedUserId}/lista`, {
        method: 'POST',
        body: JSON.stringify(listForm),
      });
      setListForm({ product_id: '', quantidade_media: '', frequencia: 'Semanal' });
      await openUser(selectedUserId);
      setSuccess('Item adicionado à lista');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeListItem = async (itemId) => {
    if (!selectedUserId) return;
    setBusy(true);
    try {
      await api(`/api/parceiros/adm/users/${selectedUserId}/lista`, {
        method: 'DELETE',
        body: JSON.stringify({ item_id: itemId }),
      });
      await openUser(selectedUserId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const generateAlert = async (userId) => {
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/parceiros/adm/alerts', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
      setAlertPreview(data);
      setSuccess('Mensagem gerada');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyMessage = async () => {
    if (!alertPreview?.mensagem) return;
    await navigator.clipboard.writeText(alertPreview.mensagem);
    setSuccess('Mensagem copiada');
  };

  const markSent = async () => {
    if (!alertPreview?.alert?.id) return;
    setBusy(true);
    try {
      await api('/api/parceiros/adm/alerts', {
        method: 'PATCH',
        body: JSON.stringify({ alert_id: alertPreview.alert.id }),
      });
      setSuccess('Marcado como enviado');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const activeProducts = useMemo(() => products.filter((p) => p.ativo !== false), [products]);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/parceiros/painel"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao painel
          </Link>
          <h1 className="text-xl font-bold m-0">ADM FinMemory Compra</h1>
          <p className="text-sm text-muted-foreground m-0 mt-1">
            Cadastre usuários, listas e preços. Gere alertas e abra o WhatsApp manualmente.
          </p>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-3 py-2 m-0" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded-xl px-3 py-2 m-0" role="status">
          {success}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : null}

      {!loading && tab === 'usuarios' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground m-0">Filtros</p>
              <div className="grid grid-cols-2 gap-2">
                <input className={inputClass} placeholder="Cidade" value={filters.cidade} onChange={(e) => setFilters((f) => ({ ...f, cidade: e.target.value }))} />
                <input className={inputClass} placeholder="Bairro" value={filters.bairro} onChange={(e) => setFilters((f) => ({ ...f, bairro: e.target.value }))} />
                <select className={inputClass} value={filters.perfil} onChange={(e) => setFilters((f) => ({ ...f, perfil: e.target.value }))}>
                  <option value="">Perfil</option>
                  {(meta.perfis || []).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <select className={inputClass} value={filters.dia_compra} onChange={(e) => setFilters((f) => ({ ...f, dia_compra: e.target.value }))}>
                  <option value="">Dia compra</option>
                  {(meta.dias || []).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select className={inputClass} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">Status</option>
                  {(meta.status || []).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select className={inputClass} value={filters.plano} onChange={(e) => setFilters((f) => ({ ...f, plano: e.target.value }))}>
                  <option value="">Plano</option>
                  {(meta.planos || []).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={filters.alerta_hoje}
                  onChange={(e) => setFilters((f) => ({ ...f, alerta_hoje: e.target.checked }))}
                />
                Quem precisa receber alerta hoje
              </label>
              <button type="button" onClick={() => void refresh()} className="text-xs font-semibold text-primary">
                Aplicar filtros
              </button>
            </div>

            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <span className="text-sm font-semibold">{users.length} usuários</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                  onClick={() => {
                    setSelectedUserId(null);
                    setUserDetail(null);
                    setUserForm(emptyUser);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Novo
                </button>
              </div>
              <ul className="divide-y divide-border max-h-[420px] overflow-y-auto list-none m-0 p-0">
                {users.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => void openUser(u.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-muted/40 ${selectedUserId === u.id ? 'bg-primary/10' : ''}`}
                    >
                      <p className="text-sm font-semibold m-0">{u.nome}</p>
                      <p className="text-[11px] text-muted-foreground m-0">
                        {u.perfil} · {u.bairro || u.cidade || '—'} · {u.dia_compra || 'sem dia'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-3">
            <form onSubmit={saveUser} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <p className="text-sm font-bold m-0">{selectedUserId ? 'Editar usuário' : 'Cadastrar usuário'}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label="Nome">
                  <input required className={inputClass} value={userForm.nome} onChange={(e) => setUserForm((f) => ({ ...f, nome: e.target.value }))} />
                </Field>
                <Field label="WhatsApp">
                  <input required className={inputClass} placeholder="55 11 99999-9999" value={userForm.telefone} onChange={(e) => setUserForm((f) => ({ ...f, telefone: e.target.value }))} />
                </Field>
                <Field label="Cidade">
                  <input className={inputClass} value={userForm.cidade || ''} onChange={(e) => setUserForm((f) => ({ ...f, cidade: e.target.value }))} />
                </Field>
                <Field label="Bairro">
                  <input className={inputClass} value={userForm.bairro || ''} onChange={(e) => setUserForm((f) => ({ ...f, bairro: e.target.value }))} />
                </Field>
                <Field label="Perfil">
                  <select className={inputClass} value={userForm.perfil} onChange={(e) => setUserForm((f) => ({ ...f, perfil: e.target.value }))}>
                    {(meta.perfis || []).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Produto principal">
                  <input className={inputClass} value={userForm.produto_principal || ''} onChange={(e) => setUserForm((f) => ({ ...f, produto_principal: e.target.value }))} />
                </Field>
                <Field label="Plano">
                  <select className={inputClass} value={userForm.plano} onChange={(e) => setUserForm((f) => ({ ...f, plano: e.target.value }))}>
                    {(meta.planos || []).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Dia de compra">
                  <select className={inputClass} value={userForm.dia_compra || ''} onChange={(e) => setUserForm((f) => ({ ...f, dia_compra: e.target.value }))}>
                    <option value="">—</option>
                    {(meta.dias || []).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select className={inputClass} value={userForm.status} onChange={(e) => setUserForm((f) => ({ ...f, status: e.target.value }))}>
                    {(meta.status || []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Observações">
                <textarea className={inputClass} rows={2} value={userForm.observacoes || ''} onChange={(e) => setUserForm((f) => ({ ...f, observacoes: e.target.value }))} />
              </Field>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
              >
                {busy ? 'Salvando…' : 'Salvar usuário'}
              </button>
            </form>

            {selectedUserId && userDetail ? (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold m-0">Lista de compra</p>
                  <button
                    type="button"
                    onClick={() => void generateAlert(selectedUserId)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Gerar WhatsApp
                  </button>
                </div>
                <ul className="space-y-1.5 list-none m-0 p-0">
                  {(userDetail.list || []).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                      <span>
                        <strong>{item.product?.nome || 'Produto'}</strong>
                        <span className="text-muted-foreground text-xs"> · {item.quantidade_media || '—'} · {item.frequencia}</span>
                      </span>
                      <button type="button" onClick={() => void removeListItem(item.id)} aria-label="Remover">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                  {(userDetail.list || []).length === 0 ? (
                    <li className="text-xs text-muted-foreground">Nenhum item ainda.</li>
                  ) : null}
                </ul>
                <form onSubmit={addListItem} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                  <Field label="Produto">
                    <select required className={inputClass} value={listForm.product_id} onChange={(e) => setListForm((f) => ({ ...f, product_id: e.target.value }))}>
                      <option value="">Selecione</option>
                      {activeProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Qtd">
                    <input className={inputClass} placeholder="5 kg" value={listForm.quantidade_media} onChange={(e) => setListForm((f) => ({ ...f, quantidade_media: e.target.value }))} />
                  </Field>
                  <Field label="Freq.">
                    <input className={inputClass} value={listForm.frequencia} onChange={(e) => setListForm((f) => ({ ...f, frequencia: e.target.value }))} />
                  </Field>
                  <button type="submit" className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground h-[38px]">
                    +
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && tab === 'produtos' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <form
            className="rounded-2xl border border-border bg-card p-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api('/api/parceiros/adm/products', { method: 'POST', body: JSON.stringify(productForm) });
                setProductForm({ nome: '', categoria: '', unidade: 'un.', marca: '' });
                await loadCatalog();
                setSuccess('Produto cadastrado');
              } catch (err) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm font-bold m-0">Novo produto</p>
            <Field label="Nome"><input required className={inputClass} value={productForm.nome} onChange={(e) => setProductForm((f) => ({ ...f, nome: e.target.value }))} /></Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Categoria"><input className={inputClass} value={productForm.categoria} onChange={(e) => setProductForm((f) => ({ ...f, categoria: e.target.value }))} /></Field>
              <Field label="Unidade"><input className={inputClass} value={productForm.unidade} onChange={(e) => setProductForm((f) => ({ ...f, unidade: e.target.value }))} /></Field>
              <Field label="Marca"><input className={inputClass} value={productForm.marca} onChange={(e) => setProductForm((f) => ({ ...f, marca: e.target.value }))} /></Field>
            </div>
            <button type="submit" className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">Salvar produto</button>
          </form>
          <ul className="rounded-2xl border border-border divide-y divide-border list-none m-0 p-0 max-h-[520px] overflow-y-auto">
            {products.map((p) => (
              <li key={p.id} className="px-3 py-2.5 text-sm flex justify-between gap-2">
                <span>
                  <strong>{p.nome}</strong>
                  <span className="text-xs text-muted-foreground"> · {p.unidade}{p.categoria ? ` · ${p.categoria}` : ''}</span>
                </span>
                <span className={`text-[10px] font-semibold ${p.ativo ? 'text-primary' : 'text-muted-foreground'}`}>
                  {p.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading && tab === 'mercados' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <form
            className="rounded-2xl border border-border bg-card p-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api('/api/parceiros/adm/markets', { method: 'POST', body: JSON.stringify(marketForm) });
                setMarketForm({ nome: '', cidade: '', bairro: '', endereco: '', contato: '' });
                await loadCatalog();
                setSuccess('Mercado cadastrado');
              } catch (err) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm font-bold m-0">Novo mercado</p>
            <Field label="Nome"><input required className={inputClass} value={marketForm.nome} onChange={(e) => setMarketForm((f) => ({ ...f, nome: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cidade"><input className={inputClass} value={marketForm.cidade} onChange={(e) => setMarketForm((f) => ({ ...f, cidade: e.target.value }))} /></Field>
              <Field label="Bairro"><input className={inputClass} value={marketForm.bairro} onChange={(e) => setMarketForm((f) => ({ ...f, bairro: e.target.value }))} /></Field>
            </div>
            <Field label="Endereço"><input className={inputClass} value={marketForm.endereco} onChange={(e) => setMarketForm((f) => ({ ...f, endereco: e.target.value }))} /></Field>
            <Field label="WhatsApp / site"><input className={inputClass} value={marketForm.contato} onChange={(e) => setMarketForm((f) => ({ ...f, contato: e.target.value }))} /></Field>
            <button type="submit" className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">Salvar mercado</button>
          </form>
          <ul className="rounded-2xl border border-border divide-y divide-border list-none m-0 p-0 max-h-[520px] overflow-y-auto">
            {markets.map((m) => (
              <li key={m.id} className="px-3 py-2.5 text-sm">
                <strong>{m.nome}</strong>
                <p className="text-xs text-muted-foreground m-0">{[m.bairro, m.cidade].filter(Boolean).join(' · ') || '—'}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!loading && tab === 'precos' ? (
        <div className="space-y-4">
          <form
            className="rounded-2xl border border-border bg-card p-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api('/api/parceiros/adm/prices', {
                  method: 'POST',
                  body: JSON.stringify({ ...priceForm, preco: Number(String(priceForm.preco).replace(',', '.')) }),
                });
                setPriceForm((f) => ({ ...f, preco: '', observacao: '' }));
                await loadCatalog();
                setSuccess('Preço cadastrado');
              } catch (err) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="text-sm font-bold m-0">Cadastrar preço</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <Field label="Produto">
                <select required className={inputClass} value={priceForm.product_id} onChange={(e) => setPriceForm((f) => ({ ...f, product_id: e.target.value }))}>
                  <option value="">Selecione</option>
                  {activeProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </Field>
              <Field label="Mercado">
                <select required className={inputClass} value={priceForm.market_id} onChange={(e) => setPriceForm((f) => ({ ...f, market_id: e.target.value }))}>
                  <option value="">Selecione</option>
                  {markets.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}{m.bairro ? ` (${m.bairro})` : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="Preço (R$)">
                <input required className={inputClass} value={priceForm.preco} onChange={(e) => setPriceForm((f) => ({ ...f, preco: e.target.value }))} />
              </Field>
              <Field label="Data">
                <input type="date" className={inputClass} value={priceForm.data_preco} onChange={(e) => setPriceForm((f) => ({ ...f, data_preco: e.target.value }))} />
              </Field>
              <Field label="Fonte">
                <input className={inputClass} placeholder="encarte / WhatsApp / site" value={priceForm.fonte} onChange={(e) => setPriceForm((f) => ({ ...f, fonte: e.target.value }))} />
              </Field>
              <Field label="Observação">
                <input className={inputClass} value={priceForm.observacao} onChange={(e) => setPriceForm((f) => ({ ...f, observacao: e.target.value }))} />
              </Field>
            </div>
            <button type="submit" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Salvar preço</button>
          </form>
          <div className="rounded-2xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Mercado</th>
                  <th className="px-3 py-2 font-medium">Preço</th>
                  <th className="px-3 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2">{row.product?.nome}</td>
                    <td className="px-3 py-2">{row.market?.nome}{row.market?.bairro ? ` · ${row.market.bairro}` : ''}</td>
                    <td className="px-3 py-2 font-semibold">R$ {Number(row.preco).toFixed(2).replace('.', ',')}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.data_preco}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading && tab === 'alertas' ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
              <p className="text-sm font-bold m-0">Alertas de hoje</p>
              <button type="button" className="text-xs font-semibold text-primary" onClick={() => void loadAlertUsers()}>
                Atualizar
              </button>
            </div>
            <ul className="divide-y divide-border list-none m-0 p-0">
              {alertUsers.map((u) => (
                <li key={u.id} className="px-3 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold m-0">{u.nome}</p>
                    <p className="text-[11px] text-muted-foreground m-0">
                      {u.perfil} · {u.bairro || '—'} · {u.dia_compra}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void generateAlert(u.id)}
                    className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                  >
                    Gerar WhatsApp
                  </button>
                </li>
              ))}
              {alertUsers.length === 0 ? (
                <li className="px-3 py-6 text-sm text-muted-foreground text-center">
                  Nenhum usuário com dia de compra = hoje. Ajuste o dia no cadastro ou use a aba Usuários.
                </li>
              ) : null}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-bold m-0">Mensagem gerada</p>
            {alertPreview ? (
              <>
                <pre className="whitespace-pre-wrap text-sm bg-muted/40 rounded-xl p-3 m-0 border border-border font-sans">
                  {alertPreview.mensagem}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyMessage()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar mensagem
                  </button>
                  {alertPreview.whatsapp_url ? (
                    <a
                      href={alertPreview.whatsapp_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#16a34a] px-3 py-2 text-xs font-bold text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir WhatsApp
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void markSent()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold"
                  >
                    Marcar como enviado
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground m-0">
                Clique em Gerar WhatsApp para montar a mensagem com os melhores preços da lista do cliente.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
