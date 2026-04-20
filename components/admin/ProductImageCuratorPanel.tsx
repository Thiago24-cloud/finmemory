'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { extractProductSpecHintsForDisplay } from '../../lib/curatorProductDisplayHints';
import { curatorCandidateImageSrc } from '../../lib/curatorImagePreviewHost';

type CatalogRow = { product_id: string; name: string; gtin: string | null };
type MapNameRow = { product_name: string; norm_key: string };

type Candidate = { url: string };

type GoogleCseErrorBody = {
  message?: string;
  code?: number;
  httpStatus?: number;
};

type RowSearchMeta = { empty: boolean; google_error: GoogleCseErrorBody | null };

function CuratorProductHeading({ fullName }: { fullName: string }) {
  const hints = extractProductSpecHintsForDisplay(fullName);
  return (
    <div>
      <p className="font-medium text-white">{fullName}</p>
      {hints.length > 0 ? (
        <p className="mt-0.5 text-xs text-gray-400">
          <span className="text-gray-500">Detalhe no rótulo:</span> {hints.join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

export default function ProductImageCuratorPanel() {
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [mapNames, setMapNames] = useState<MapNameRow[]>([]);
  const [cseOk, setCseOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [candidatesByKey, setCandidatesByKey] = useState<Record<string, Candidate[]>>({});
  const [searchMetaByKey, setSearchMetaByKey] = useState<Record<string, RowSearchMeta>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/product-image-curator', { credentials: 'include' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setCatalog(Array.isArray(j.catalog_missing) ? j.catalog_missing : []);
      setMapNames(Array.isArray(j.map_names_missing) ? j.map_names_missing : []);
      setCseOk(Boolean(j.google_cse_configured));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function fetchCandidates(key: string, productName: string, productId: string | null) {
    setLoadingKey(key);
    setErr('');
    setCandidatesByKey((prev) => ({ ...prev, [key]: [] }));
    setSearchMetaByKey((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      const r = await fetch('/api/admin/product-image-curator', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          productId
            ? { action: 'candidates', product_id: productId }
            : { action: 'candidates', product_name: productName }
        ),
      });
      const j = await r.json();
      if (process.env.NODE_ENV === 'development') {
        console.debug('[product-image-curator] POST candidates', { status: r.status, body: j });
      }
      if (!r.ok) throw new Error(j.error || r.statusText);
      const list = Array.isArray(j.candidates) ? j.candidates : [];
      setCandidatesByKey((prev) => ({ ...prev, [key]: list }));
      setSearchMetaByKey((prev) => ({
        ...prev,
        [key]: {
          empty: list.length === 0,
          google_error: (j.google_error as GoogleCseErrorBody | null | undefined) ?? null,
        },
      }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro nas sugestões');
    } finally {
      setLoadingKey(null);
    }
  }

  async function selectImage(
    key: string,
    imageUrl: string,
    opts: { product_id?: string | null; product_name?: string | null }
  ) {
    setSavingKey(`${key}:${imageUrl.slice(0, 40)}`);
    setErr('');
    try {
      const r = await fetch('/api/admin/product-image-curator', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'select',
          image_url: imageUrl,
          product_id: opts.product_id || undefined,
          product_name: opts.product_name || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setCandidatesByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSearchMetaByKey((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao gravar');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-gray-100">
      <header className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Link href="/admin" className="text-xs font-medium text-emerald-400/90 underline-offset-2 hover:underline">
            ← Painel operacional
          </Link>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Curador de imagens (Google CSE)</h1>
          <p className="mt-1 text-sm text-gray-400">
            Lista produtos <strong className="text-gray-200">sem foto no catálogo</strong> ou nomes no mapa{' '}
            <strong className="text-gray-200">sem entrada no repositório</strong> (
            <code className="text-gray-500">map_product_image_cache</code>). O <strong className="text-gray-300">nome
            completo</strong> (com gramagem, caixa, etc.) <strong className="text-gray-300">não é alterado</strong> na
            base de dados: só o <strong className="text-gray-300">termo enviado ao Google</strong> é simplificado para
            achar uma foto representativa (marca + tipo). Abaixo de cada título destacamos medidas do rótulo para você
            confirmar a embalagem certa ao escolher a imagem.
          </p>
          {!cseOk ? (
            <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-100">
              Configure <code className="text-amber-200/90">GOOGLE_API_KEY</code> e{' '}
              <code className="text-amber-200/90">GOOGLE_CSE_ID</code> no servidor para as sugestões funcionarem.
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6">
        {err ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">{err}</div>
        ) : null}

        <section>
          <h2 className="text-sm font-semibold text-emerald-300">Catálogo — produtos sem imagem principal</h2>
          {loading ? (
            <p className="mt-3 text-sm text-gray-500">A carregar…</p>
          ) : catalog.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Nenhum produto em falta (ou tabela vazia).</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {catalog.map((row) => {
                const key = `c:${row.product_id}`;
                const cand = candidatesByKey[key] || [];
                const rowMeta = searchMetaByKey[key];
                const busy = loadingKey === key;
                return (
                  <li
                    key={row.product_id}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CuratorProductHeading fullName={row.name} />
                        <p className="mt-1 text-xs text-gray-500">
                          {row.gtin ? `GTIN ${row.gtin} · ` : null}
                          <code className="text-gray-600">{row.product_id}</code>
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!cseOk || busy}
                        onClick={() => fetchCandidates(key, row.name, row.product_id)}
                        className="shrink-0 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-50"
                      >
                        {busy ? 'A buscar…' : 'Buscar 3 sugestões'}
                      </button>
                    </div>
                    {rowMeta?.empty ? (
                      <p className="mt-2 text-xs text-amber-100/90">
                        {rowMeta.google_error?.message
                          ? `Google: ${rowMeta.google_error.message}${
                              rowMeta.google_error.httpStatus != null
                                ? ` (HTTP ${rowMeta.google_error.httpStatus})`
                                : ''
                            }`
                          : 'Nenhuma imagem HTTPS válida encontrada. O nome já foi encurtado e foi feita uma 2.ª busca só com o produto. No plano gratuito do CSE o limite é ~100 consultas/dia.'}
                      </p>
                    ) : null}
                    {cand.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {cand.map((c) => (
                          <div
                            key={c.url}
                            className="flex w-[140px] flex-col gap-2 rounded-lg border border-white/10 bg-black/30 p-2"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={curatorCandidateImageSrc(c.url)}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-24 w-full rounded object-contain bg-white/5"
                            />
                            <button
                              type="button"
                              disabled={Boolean(savingKey)}
                              onClick={() =>
                                selectImage(key, c.url, { product_id: row.product_id, product_name: row.name })
                              }
                              className="rounded bg-emerald-600 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Selecionar
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-emerald-300">Mapa — nomes sem miniatura no repositório</h2>
          <p className="mt-1 text-xs text-gray-500">
            Grava em <code className="text-gray-600">map_product_image_cache</code> (e no Storage); o mapa reutiliza por
            nome normalizado.
          </p>
          {loading ? null : mapNames.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Todos os nomes recentes já têm cache — ou não há price_points.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {mapNames.map((row) => {
                const key = `m:${row.norm_key}`;
                const cand = candidatesByKey[key] || [];
                const rowMeta = searchMetaByKey[key];
                const busy = loadingKey === key;
                return (
                  <li key={row.norm_key} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CuratorProductHeading fullName={row.product_name} />
                        <p className="mt-1 text-xs text-gray-500">
                          chave <code className="text-gray-600">{row.norm_key}</code>
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!cseOk || busy}
                        onClick={() => fetchCandidates(key, row.product_name, null)}
                        className="shrink-0 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-50"
                      >
                        {busy ? 'A buscar…' : 'Buscar 3 sugestões'}
                      </button>
                    </div>
                    {rowMeta?.empty ? (
                      <p className="mt-2 text-xs text-amber-100/90">
                        {rowMeta.google_error?.message
                          ? `Google: ${rowMeta.google_error.message}${
                              rowMeta.google_error.httpStatus != null
                                ? ` (HTTP ${rowMeta.google_error.httpStatus})`
                                : ''
                            }`
                          : 'Nenhuma imagem HTTPS válida encontrada. O nome já foi encurtado e foi feita uma 2.ª busca só com o produto. No plano gratuito do CSE o limite é ~100 consultas/dia.'}
                      </p>
                    ) : null}
                    {cand.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-3">
                        {cand.map((c) => (
                          <div
                            key={c.url}
                            className="flex w-[140px] flex-col gap-2 rounded-lg border border-white/10 bg-black/30 p-2"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={curatorCandidateImageSrc(c.url)}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="h-24 w-full rounded object-contain bg-white/5"
                            />
                            <button
                              type="button"
                              disabled={Boolean(savingKey)}
                              onClick={() => selectImage(key, c.url, { product_name: row.product_name })}
                              className="rounded bg-emerald-600 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                            >
                              Selecionar
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-gray-600">
          <button
            type="button"
            onClick={() => load()}
            className="text-emerald-400 underline-offset-2 hover:underline"
          >
            Atualizar listas
          </button>
        </p>
      </main>
    </div>
  );
}
