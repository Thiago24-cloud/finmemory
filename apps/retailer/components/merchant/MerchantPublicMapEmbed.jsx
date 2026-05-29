'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { buildConsumerPublicMapUrl } from '../../lib/consumerAppUrl';
import { painelApi } from '../../lib/merchant/painelApiPaths';

function parseCoord(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function MerchantPublicMapEmbed() {
  const router = useRouter();
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(painelApi.context);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setError(data.error || 'Não foi possível carregar os dados da sua loja.');
          }
          return;
        }
        if (!cancelled) setStore(data.store || null);
      } catch {
        if (!cancelled) setError('Erro de rede ao carregar o mapa.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lat = useMemo(() => {
    if (router.isReady) {
      const q = parseCoord(router.query.lat);
      if (q != null) return q;
    }
    return parseCoord(store?.lat ?? store?.latitude);
  }, [router.isReady, router.query.lat, store?.lat, store?.latitude]);

  const lng = useMemo(() => {
    if (router.isReady) {
      const q = parseCoord(router.query.lng);
      if (q != null) return q;
    }
    return parseCoord(store?.lng ?? store?.longitude);
  }, [router.isReady, router.query.lng, store?.lng, store?.longitude]);

  const mapSrc = useMemo(() => buildConsumerPublicMapUrl({ lat, lng, zoom: 16 }), [lat, lng]);

  const storeLabel = store?.name || store?.nome_comercial || 'sua loja';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050508] text-white">
      <header className="shrink-0 flex items-center gap-3 border-b border-white/10 bg-[#0a0a10]/95 px-4 py-3 backdrop-blur-md safe-area-top">
        <Link
          href="/parceiros/painel"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Painel
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold m-0 truncate">Mapa de preços</p>
          <p className="text-[11px] text-white/50 m-0 truncate flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            {loading ? 'Carregando…' : storeLabel}
          </p>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 bg-[#0a0a10]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/60">
            <Loader2 className="h-8 w-8 animate-spin text-[#39FF14]" aria-hidden />
            <p className="text-sm m-0">Abrindo mapa público…</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-sm text-red-300 m-0">{error}</p>
            <Link
              href="/parceiros/painel"
              className="rounded-xl bg-[#39FF14] px-5 py-2.5 text-sm font-bold text-[#050508]"
            >
              Voltar ao painel
            </Link>
          </div>
        ) : (
          <iframe
            title="Mapa de preços FinMemory"
            src={mapSrc}
            className="absolute inset-0 h-full w-full border-0"
            allow="geolocation"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    </div>
  );
}
