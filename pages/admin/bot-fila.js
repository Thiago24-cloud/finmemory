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

function uniqueHttpUrls(values) {
  const out = [];
  const seen = new Set();
  for (const v of values || []) {
    const s = String(v || '').trim();
    if (!s) continue;
    if (!/^https?:\/\//i.test(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function collectArtifactUrls(item) {
  const produtos = Array.isArray(item?.produtos) ? item.produtos : [];
  const fromArtifacts = [];
  const artifacts = item?.artifacts && typeof item.artifacts === 'object' ? item.artifacts : null;
  if (artifacts?.source_page_url) fromArtifacts.push(artifacts.source_page_url);
  if (Array.isArray(artifacts?.flyer_asset_urls)) fromArtifacts.push(...artifacts.flyer_asset_urls);

  const fromProdutos = [];
  for (const p of produtos) {
    const md = p?.metadata && typeof p.metadata === 'object' ? p.metadata : null;
    if (!md) continue;
    fromProdutos.push(
      md.storePageUrl,
      md.source_page_url,
      md.source_url,
      md.flyer_url,
      md.pdf_url
    );
  }
  return uniqueHttpUrls([...fromArtifacts, ...fromProdutos]).slice(0, 20);
}

function getProductValidityInfo(produto) {
  const rawDate =
    produto?.expiry_date ||
    produto?.valid_until ||
    produto?.validade ||
    produto?.expires_at ||
    null;
  const validityInferred = Boolean(produto?.metadata?.validity_inferred);
  if (!rawDate) {
    return {
      modeLabel: validityInferred ? 'Automática' : 'Manual',
      modeTone: validityInferred ? 'amber' : 'emerald',
      dateLabel: 'Sem data',
      daysLeftLabel: '',
    };
  }
  const d = new Date(String(rawDate));
  const validDate = !Number.isNaN(d.getTime());
  const dateLabel = validDate ? d.toLocaleDateString('pt-BR') : String(rawDate);
  let daysLeftLabel = '';
  if (validDate) {
    const ms = d.getTime() - Date.now();
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days > 0) daysLeftLabel = `vence em ${days} dia(s)`;
    else if (days === 0) daysLeftLabel = 'vence hoje';
    else daysLeftLabel = `vencido há ${Math.abs(days)} dia(s)`;
  }
  return {
    modeLabel: validityInferred ? 'Automática' : 'Manual',
    modeTone: validityInferred ? 'amber' : 'emerald',
    dateLabel,
    daysLeftLabel,
  };
}

function OrigemBadge({ origem }) {
  const color =
    origem?.includes('dia') ? 'bg-red-500/15 text-red-200 border border-red-500/30' :
    origem?.includes('assai') ? 'bg-orange-500/15 text-orange-200 border border-orange-500/30' :
    'bg-white/10 text-gray-300 border border-white/15';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {origem || 'desconhecido'}
    </span>
  );
}

export default function BotFilaPage() {
  const [items, setItems] = useState([]);
  const [sortBy, setSortBy] = useState('desconto');
  const [scopeFilter, setScopeFilter] = useState('todos');
  const [cityView, setCityView] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [legacyGroups, setLegacyGroups] = useState([]);
  const [ingestRejections, setIngestRejections] = useState([]);
  const [extractionHealth, setExtractionHealth] = useState({ total: 0, jsonPercent: 0, htmlPercent: 0 });
  const [showIngestLog, setShowIngestLog] = useState(false);
  const [legacyFilter, setLegacyFilter] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [migrateModal, setMigrateModal] = useState(false);
  const [migratePreview, setMigratePreview] = useState(null);
  const [migrateBusy, setMigrateBusy] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sort: sortBy,
        scope: scopeFilter,
        cityView,
        city: cityFilter,
        limit: '250',
      });
      const res = await fetch(`/api/admin/bot-fila?${params.toString()}`);
      const json = await res.json();
      setItems(json.items || []);
      setLegacyGroups(json.legacyGroups || []);
      setIngestRejections(json.ingestRejections || []);
      setExtractionHealth(json.extractionHealth || { total: 0, jsonPercent: 0, htmlPercent: 0 });
    } catch {
      showToast('Erro ao carregar fila', false);
    } finally {
      setLoading(false);
    }
  }, [scopeFilter, sortBy, cityView, cityFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (items.length === 0) return 0;
      if (prev < 0) return 0;
      if (prev >= items.length) return items.length - 1;
      return prev;
    });
  }, [items.length]);

  useEffect(() => {
    const handler = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || event.target?.isContentEditable;
      if (isTyping) return;
      if (event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, items.length - 1)));
      } else if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if ((event.key === 'v' || event.key === 'V') && items[selectedIndex]) {
        event.preventDefault();
        setExpandedId((prev) => (prev === items[selectedIndex].id ? null : items[selectedIndex].id));
      } else if ((event.key === 'a' || event.key === 'A') && items[selectedIndex]) {
        event.preventDefault();
        act(items[selectedIndex].id, 'aprovar');
      } else if ((event.key === 'r' || event.key === 'R') && items[selectedIndex]) {
        event.preventDefault();
        act(items[selectedIndex].id, 'rejeitar');
      } else if (event.key === 'Backspace' && items[selectedIndex]) {
        event.preventDefault();
        act(items[selectedIndex].id, 'rejeitar');
      } else if (event.key === '1') {
        event.preventDefault();
        setCityView('all');
      } else if (event.key === '2') {
        event.preventDefault();
        setCityView('capital');
      } else if (event.key === '3') {
        event.preventDefault();
        setCityView('interior');
      } else if (event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        setShowIngestLog((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [items, selectedIndex]);

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
      <div className="min-h-screen bg-[#090d12] text-[#e8edf2]">
        <header className="border-b border-[#2ECC49]/30 bg-[#0f1720]/90 backdrop-blur px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Fila do Bot</h1>
              <p className="text-sm text-gray-300">Promoções enviadas pelo scraper aguardando aprovação.</p>
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
                toast.ok ? 'bg-[#2ECC49]/15 text-[#a7f3b5] border border-[#2ECC49]/35' : 'bg-red-500/10 text-red-200 border border-red-500/40'
              }`}
            >
              {toast.msg}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#2ECC49]/30 bg-[#101820] p-3">
            <p className="text-sm text-gray-300">
              {loading ? 'Carregando…' : `${items.length} entrada(s) pendente(s)`}
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-[#2ECC49]/40 bg-[#0b1118] px-3 py-1.5 text-sm text-[#d7ffe0]"
              >
                <option value="desconto">Maior desconto</option>
                <option value="expiracao">Expira primeiro</option>
                <option value="recentes">Mais recentes</option>
              </select>
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                className="rounded-lg border border-[#2ECC49]/40 bg-[#0b1118] px-3 py-1.5 text-sm text-[#d7ffe0]"
              >
                <option value="todos">Todas regiões</option>
                <option value="Estadual">Estadual</option>
                <option value="Grande SP">Grande SP</option>
                <option value="cidade">Cidade</option>
              </select>
              <select
                value={cityView}
                onChange={(e) => setCityView(e.target.value)}
                className="rounded-lg border border-[#2ECC49]/40 bg-[#0b1118] px-3 py-1.5 text-sm text-[#d7ffe0]"
              >
                <option value="all">1: Estado Todo</option>
                <option value="capital">2: Capital</option>
                <option value="interior">3: Interior</option>
              </select>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="rounded-lg border border-[#2ECC49]/40 bg-[#0b1118] px-3 py-1.5 text-sm text-[#d7ffe0]"
              >
                <option value="all">Cidade: todas</option>
                {Array.from(new Set(items.map((it) => it?.locality_city).filter(Boolean))).sort().map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <button
                onClick={openMigrateModal}
                className="rounded-lg border border-amber-300/50 bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-200 hover:bg-amber-500/25"
              >
                🔄 Migrar Dia Legacy
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-lg border border-[#2ECC49]/40 bg-[#0b1118] px-3 py-1.5 text-sm font-medium text-[#d7ffe0] hover:bg-[#112219] disabled:opacity-50"
              >
                Atualizar
              </button>
            </div>
          </div>
          <p className="mb-4 text-xs text-gray-400">
            Atalhos: <span className="text-[#2ECC49]">J/K</span> navegar · <span className="text-[#2ECC49]">V</span> expandir · <span className="text-[#2ECC49]">A</span> aprovar · <span className="text-[#2ECC49]">R</span> rejeitar
            {' '}· <span className="text-[#2ECC49]">Backspace</span> descartar · <span className="text-[#2ECC49]">1/2/3</span> Estado/Capital/Interior · <span className="text-[#2ECC49]">L</span> log de rejeições
          </p>
          {showIngestLog && (
            <section className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-red-200">Área de Erros (últimas 5 rejeições)</h3>
                <span className="text-[11px] text-red-100/90">
                  Saúde fontes ({extractionHealth.total || 0} ofertas): {extractionHealth.jsonPercent || 0}% via JSON, {extractionHealth.htmlPercent || 0}% via HTML
                </span>
                <button
                  onClick={() => setShowIngestLog(false)}
                  className="text-xs text-red-200 underline"
                >
                  ocultar
                </button>
              </div>
              {ingestRejections.length === 0 ? (
                <p className="text-xs text-red-100/80">Nenhuma rejeição registrada.</p>
              ) : (
                <ul className="space-y-2">
                  {ingestRejections.slice(0, 5).map((row, idx) => (
                    <li key={`${row.timestamp}-${idx}`} className="rounded-lg border border-red-500/30 bg-black/20 px-3 py-2 text-xs text-red-100">
                      <span className="font-semibold">{row.provider}</span> · {row.field} · {row.reason}
                      {row.productName ? ` · ${row.productName}` : ''}
                      {row.runId ? ` · run ${row.runId}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

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
            {items.map((item, index) => {
              const produtos = Array.isArray(item.produtos) ? item.produtos : [];
              const artifactUrls = collectArtifactUrls(item);
              const isExpanded = expandedId === item.id;
              const isBusy = busy === item.id + 'aprovar' || busy === item.id + 'rejeitar';

              return (
                <li
                  key={item.id}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`rounded-2xl border shadow-sm ${
                    selectedIndex === index
                      ? 'border-[#2ECC49] bg-[#0f1720] ring-1 ring-[#2ECC49]/60'
                      : 'border-white/10 bg-[#101820]'
                  }`}
                >
                  <div className="flex flex-wrap items-start gap-3 p-4 sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#e8edf2]">{item.store_name}</span>
                        <OrigemBadge origem={item.origem} />
                        <span className="rounded-full bg-[#2ECC49]/15 px-2 py-0.5 text-xs font-semibold text-[#8bf9a3]">
                          {item.locality_scope || 'Estadual'}{item.locality_city ? ` · ${item.locality_city}` : ''}
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-gray-300">
                          fonte: {item.extraction_strategy || 'unknown'}
                        </span>
                        {item.locality_region ? (
                          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-200">
                            {item.locality_region}
                          </span>
                        ) : null}
                      </div>
                      {item.store_address && (
                        <p className="mt-0.5 text-xs text-gray-400">{item.store_address}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        {produtos.length} produto(s) · recebido em {formatDate(item.created_at)}
                        {item.max_discount_percent != null ? ` · desconto máx ${item.max_discount_percent}%` : ''}
                        {item.nearest_expiry_at ? ` · expira ${formatDate(item.nearest_expiry_at)}` : ''}
                      </p>
                      {artifactUrls.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <a
                            href={artifactUrls[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20"
                          >
                            Ver folheto original
                          </a>
                          <a
                            href={`/api/admin/bot-fila-artifact?url=${encodeURIComponent(artifactUrls[0])}`}
                            className="rounded-md border border-indigo-400/35 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/20"
                          >
                            Baixar folheto
                          </a>
                        </div>
                      ) : null}
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
                      {artifactUrls.length > 0 ? (
                        <div className="mb-3 rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-3">
                          <p className="text-xs font-semibold text-cyan-100">
                            Folheto/artefatos de origem (fallback para curadoria manual)
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {artifactUrls.map((url, idx) => (
                              <div key={`${item.id}-art-${idx}`} className="flex flex-wrap gap-1">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-md border border-cyan-300/35 bg-cyan-500/15 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-500/25"
                                >
                                  Ver origem {idx + 1}
                                </a>
                                <a
                                  href={`/api/admin/bot-fila-artifact?url=${encodeURIComponent(url)}`}
                                  className="rounded-md border border-indigo-300/35 bg-indigo-500/15 px-2 py-1 text-[11px] text-indigo-100 hover:bg-indigo-500/25"
                                >
                                  Baixar
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {produtos.map((p, i) => (
                          (() => {
                            const validity = getProductValidityInfo(p);
                            const validityClass =
                              validity.modeTone === 'amber'
                                ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                                : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
                            return (
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
                              <p className="truncate text-sm font-medium">{p.product_name || p.nome || p.name || '—'}</p>
                              {p.current_price != null || p.preco != null ? (
                                <p className="text-sm font-semibold text-[#2ECC49]">
                                  R$ {Number(p.current_price ?? p.preco).toFixed(2)}
                                </p>
                              ) : null}
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${validityClass}`}>
                                  Validade {validity.modeLabel}
                                </span>
                                <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                                  {validity.dateLabel}
                                </span>
                                {validity.daysLeftLabel ? (
                                  <span className="rounded-full border border-zinc-400/35 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-100">
                                    {validity.daysLeftLabel}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                            );
                          })()
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
