import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { canAccessAdminRoutes } from '../../lib/adminAccess';
import { canAccess } from '../../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/admin/bot-fila', permanent: false } };
    }
    const allowed = await canAccessAdminRoutes(session.user.email, () => canAccess(session.user.email));
    if (!allowed) {
      return { redirect: { destination: '/?msg=sem-acesso-admin', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[admin/bot-fila getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/admin/bot-fila', permanent: false } };
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function OrigemBadge({ origem }) {
  const color =
    origem?.includes('dia') ? 'bg-red-100 text-red-700' :
    origem?.includes('assai') ? 'bg-orange-100 text-orange-700' :
    'bg-gray-100 text-gray-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {origem || 'desconhecido'}
    </span>
  );
}

export default function BotFilaPage() {
  const [items, setItems] = useState([]);
  const [legacyGroups, setLegacyGroups] = useState([]);
  const [legacyFilter, setLegacyFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [migrateModal, setMigrateModal] = useState(false);
  const [migratePreview, setMigratePreview] = useState(null);
  const [migrateBusy, setMigrateBusy] = useState(false);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/bot-fila');
      const json = await res.json();
      setItems(json.items || []);
      setLegacyGroups(json.legacyGroups || []);
    } catch {
      showToast('Erro ao carregar fila', false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openMigrateModal = async () => {
    setMigrateModal(true);
    setMigratePreview(null);
    try {
      const res = await fetch('/api/admin/migrate-dia-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const json = await res.json();
      setMigratePreview(json);
    } catch {
      setMigratePreview({ error: 'Erro ao pré-visualizar' });
    }
  };

  const confirmMigration = async () => {
    setMigrateBusy(true);
    try {
      const res = await fetch('/api/admin/migrate-dia-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro');
      setMigrateModal(false);
      showToast(`✅ Migração concluída: ${json.lojas} loja(s), ${json.produtos} produto(s) enviados para fila`);
      load();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setMigrateBusy(false);
    }
  };

  const act = async (id, action) => {
    setBusy(id + action);
    try {
      const res = await fetch('/api/admin/bot-fila', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro');
      const keepInQueue = action === 'aprovar' && (json.pending_image || json.invalid_price);
      if (action === 'aprovar') {
        if (json.pending_image || json.invalid_price) {
          showToast(
            `⚠️ Publicado parcial: ${json.inserted || 0} no mapa, ${json.pending_image || 0} sem imagem, ${json.invalid_price || 0} sem preço válido`,
            false
          );
        } else {
          showToast(`✅ Aprovado — ${json.inserted} produto(s) publicados no mapa`);
        }
      } else {
        showToast('❌ Rejeitado');
      }
      if (keepInQueue) {
        await load();
      } else {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setBusy(null);
    }
  };

  const reprocessLegacy = async (storeName) => {
    setBusy(`legacy:${storeName}`);
    try {
      const res = await fetch('/api/admin/bot-fila', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reprocessar_legado', store_name: storeName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erro');
      showToast(`✅ Legado enviado para fila: ${json.enqueued || 0} produto(s)`);
      await load();
    } catch (e) {
      showToast(e.message, false);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Head>
        <title>Fila do Bot — FinMemory Admin</title>
      </Head>
      <div className="min-h-screen bg-[#f4f1ec] text-[#1a1a1a]">
        <header className="border-b border-black/10 bg-white/90 backdrop-blur px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Fila do Bot</h1>
              <p className="text-sm text-gray-600">Promoções enviadas pelo scraper aguardando aprovação.</p>
            </div>
            <Link href="/admin" className="text-sm font-medium text-[#2ECC49] hover:underline">
              ← Admin
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {toast && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
                toast.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {toast.msg}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-600">
              {loading ? 'Carregando…' : `${items.length} entrada(s) pendente(s)`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={openMigrateModal}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 hover:bg-amber-100"
              >
                🔄 Migrar Dia Legacy
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Atualizar
              </button>
            </div>
          </div>

          <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">Legado no mapa (invisível ao público)</h2>
            <p className="mt-1 text-xs text-amber-800">
              Itens com <code>source=legado</code> ou nulo. Não são apagados; podem ser reenviados para revisão no painel.
            </p>

            {legacyGroups.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {[
                  { key: 'todos', label: 'Todos', count: legacyGroups.length },
                  { key: 'sem_imagem', label: 'Sem imagem', count: legacyGroups.filter((g) => g.sem_imagem > 0).length },
                  { key: 'preco_zero', label: 'Preço zero', count: legacyGroups.filter((g) => g.preco_zero > 0).length },
                  { key: 'imagem_suja', label: 'Img c/ preço', count: legacyGroups.filter((g) => g.imagem_suja > 0).length },
                ].map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setLegacyFilter(key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      legacyFilter === key
                        ? 'bg-amber-600 text-white'
                        : 'border border-amber-300 bg-white text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    {label} <span className="opacity-70">({count})</span>
                  </button>
                ))}
              </div>
            )}

            {legacyGroups.length === 0 ? (
              <p className="mt-2 text-xs text-amber-700">Nenhum legado pendente.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {legacyGroups
                  .filter((g) => {
                    if (legacyFilter === 'sem_imagem') return g.sem_imagem > 0;
                    if (legacyFilter === 'preco_zero') return g.preco_zero > 0;
                    if (legacyFilter === 'imagem_suja') return g.imagem_suja > 0;
                    return true;
                  })
                  .slice(0, 12)
                  .map((g) => (
                  <li key={g.store_name} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
                    <span>
                      <strong>{g.store_name}</strong> · {g.count} item(ns)
                      {g.sem_imagem > 0 && <span className="ml-2 text-orange-500">{g.sem_imagem} s/img</span>}
                      {g.preco_zero > 0 && <span className="ml-1 text-red-500">{g.preco_zero} s/preço</span>}
                      {g.imagem_suja > 0 && <span className="ml-1 text-purple-500">{g.imagem_suja} img↑preço</span>}
                    </span>
                    <button
                      onClick={() => reprocessLegacy(g.store_name)}
                      disabled={busy === `legacy:${g.store_name}`}
                      className="rounded-md border border-amber-300 bg-amber-100 px-2 py-1 font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                    >
                      {busy === `legacy:${g.store_name}` ? 'Enviando…' : 'Enviar para fila'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Modal de confirmação da migração */}
          {migrateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <h2 className="text-lg font-bold text-[#111]">Migrar Dia Legacy</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Move registros do bot Dia de <code className="rounded bg-black/5 px-1">price_points</code> para a fila de aprovação, agrupados por loja.
                </p>

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  ⚠️ Esta ação <strong>remove</strong> os registros de <code>price_points</code> e cria entradas na fila. Os dados só voltam ao mapa após aprovação.
                </div>

                <div className="mt-4">
                  {!migratePreview && (
                    <p className="text-sm text-gray-400">Verificando dados…</p>
                  )}
                  {migratePreview?.error && (
                    <p className="text-sm text-red-600">{migratePreview.error}</p>
                  )}
                  {migratePreview && !migratePreview.error && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        Encontrados: <span className="text-[#111]">{migratePreview.lojas} loja(s)</span> · {migratePreview.produtos} produto(s)
                      </p>
                      {migratePreview.lojas === 0 && (
                        <p className="mt-1 text-sm text-gray-500">Nenhum registro Dia encontrado em price_points.</p>
                      )}
                      {Array.isArray(migratePreview.preview) && migratePreview.preview.length > 0 && (
                        <ul className="mt-2 max-h-40 overflow-y-auto space-y-1">
                          {migratePreview.preview.map((l, i) => (
                            <li key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                              <span className="font-medium">{l.store_name}</span>
                              <span className="text-gray-500">{l.produtos} produto(s)</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setMigrateModal(false)}
                    disabled={migrateBusy}
                    className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmMigration}
                    disabled={migrateBusy || !migratePreview || migratePreview.lojas === 0}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {migrateBusy ? 'Migrando…' : 'Confirmar migração'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-10 text-center text-gray-500">
              Nenhuma promoção aguardando revisão.
            </div>
          )}

          <ul className="space-y-3">
            {items.map((item) => {
              const produtos = Array.isArray(item.produtos) ? item.produtos : [];
              const isExpanded = expandedId === item.id;
              const isBusy = busy === item.id + 'aprovar' || busy === item.id + 'rejeitar';

              return (
                <li
                  key={item.id}
                  className="rounded-2xl border border-black/10 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-start gap-3 p-4 sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#111]">{item.store_name}</span>
                        <OrigemBadge origem={item.origem} />
                      </div>
                      {item.store_address && (
                        <p className="mt-0.5 text-xs text-gray-500">{item.store_address}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {produtos.length} produto(s) · recebido em {formatDate(item.created_at)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                      >
                        {isExpanded ? 'Ocultar' : 'Ver produtos'}
                      </button>
                      <button
                        onClick={() => act(item.id, 'rejeitar')}
                        disabled={isBusy}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        ❌ Rejeitar
                      </button>
                      <button
                        onClick={() => act(item.id, 'aprovar')}
                        disabled={isBusy}
                        className="rounded-lg bg-[#2ECC49] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#22a83a] disabled:opacity-50"
                      >
                        {busy === item.id + 'aprovar' ? 'Publicando…' : '✅ Aprovar'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-black/5 px-4 pb-4 pt-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {produtos.map((p, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-xl border border-black/5 bg-gray-50 p-3"
                          >
                            {(p.imagem_url || p.image_url) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.imagem_url || p.image_url}
                                alt=""
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{p.nome || p.name || '—'}</p>
                              {p.preco != null && (
                                <p className="text-sm font-semibold text-[#2ECC49]">
                                  R$ {Number(p.preco).toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </main>
      </div>
    </>
  );
}
